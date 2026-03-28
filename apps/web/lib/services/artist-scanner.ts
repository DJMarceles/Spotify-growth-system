import type {
  SpotifyClient,
  SpotifyArtistResponse,
  SpotifyTrackResponse,
} from '@release-loop/spotify-client';
import { db } from '../db';

export interface ScanResult {
  artist: {
    id: string;
    spotifyId: string;
    name: string;
    genres: string[];
    followerCount: number;
    popularity: number;
    imageUrl: string | null;
  };
  relatedArtists: Array<{
    id: string;
    spotifyId: string;
    name: string;
    genres: string[];
    followerCount: number;
    popularity: number;
    imageUrl: string | null;
  }>;
  topTracks: Array<{
    id: string;
    spotifyId: string;
    name: string;
    artistName: string;
    albumName: string;
    durationMs: number;
    popularity: number;
    releaseDate: string;
  }>;
}

/**
 * Scans an artist by Spotify ID:
 * 1. Fetches artist profile from Spotify
 * 2. Fetches related artists
 * 3. Fetches top tracks
 * 4. Normalizes and persists all data
 * 5. Returns the scan result
 */
export async function scanArtist(
  spotifyClient: SpotifyClient,
  spotifyArtistId: string,
): Promise<ScanResult> {
  // Fetch all data from Spotify in parallel
  const [spotifyArtist, spotifyRelated, spotifyTracks] = await Promise.all([
    spotifyClient.getArtist(spotifyArtistId),
    spotifyClient.getRelatedArtists(spotifyArtistId),
    spotifyClient.getArtistTopTracks(spotifyArtistId),
  ]);

  // Persist the main artist
  const artist = await upsertArtist(spotifyArtist);

  // Persist related artists in parallel
  const relatedArtists = await Promise.all(
    spotifyRelated.map((sa) => upsertArtist(sa)),
  );

  // Persist top tracks
  const topTracks = await Promise.all(
    spotifyTracks.map((st) => upsertTrack(st, artist.id)),
  );

  // Also persist top tracks for each related artist (fetch in background)
  // We do this so we have track data available for playlist building later.
  // Run with limited concurrency to avoid rate limits.
  await persistRelatedArtistTracks(spotifyClient, relatedArtists);

  return {
    artist: {
      id: artist.id,
      spotifyId: artist.spotifyId,
      name: artist.name,
      genres: artist.genres,
      followerCount: artist.followerCount,
      popularity: artist.popularity,
      imageUrl: artist.imageUrl,
    },
    relatedArtists: relatedArtists.map((ra) => ({
      id: ra.id,
      spotifyId: ra.spotifyId,
      name: ra.name,
      genres: ra.genres,
      followerCount: ra.followerCount,
      popularity: ra.popularity,
      imageUrl: ra.imageUrl,
    })),
    topTracks: topTracks.map((t) => ({
      id: t.id,
      spotifyId: t.spotifyId,
      name: t.name,
      artistName: t.artistName,
      albumName: t.albumName,
      durationMs: t.durationMs,
      popularity: t.popularity,
      releaseDate: t.releaseDate,
    })),
  };
}

/**
 * Fetches a previously scanned artist from the database.
 * Returns null if the artist hasn't been scanned.
 */
export async function getScannedArtist(artistId: string) {
  const artist = await db.artist.findUnique({
    where: { id: artistId },
    include: {
      tracks: {
        orderBy: { popularity: 'desc' },
        take: 10,
      },
      neighborsAsSource: {
        include: {
          neighborArtist: true,
        },
        orderBy: { adjacencyScore: 'desc' },
      },
    },
  });

  return artist;
}

/**
 * Lists all scanned artists, ordered by most recently fetched.
 */
export async function listScannedArtists() {
  return db.artist.findMany({
    orderBy: { lastFetchedAt: 'desc' },
    select: {
      id: true,
      spotifyId: true,
      name: true,
      genres: true,
      followerCount: true,
      popularity: true,
      imageUrl: true,
      lastFetchedAt: true,
      _count: {
        select: {
          tracks: true,
          neighborsAsSource: true,
        },
      },
    },
  });
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function upsertArtist(sa: SpotifyArtistResponse) {
  const imageUrl = sa.images.length > 0
    ? sa.images.sort((a, b) => b.width - a.width)[0].url
    : null;

  return db.artist.upsert({
    where: { spotifyId: sa.id },
    create: {
      spotifyId: sa.id,
      name: sa.name,
      genres: sa.genres,
      followerCount: sa.followers.total,
      popularity: sa.popularity,
      imageUrl,
      spotifyUrl: sa.external_urls.spotify,
      lastFetchedAt: new Date(),
    },
    update: {
      name: sa.name,
      genres: sa.genres,
      followerCount: sa.followers.total,
      popularity: sa.popularity,
      imageUrl,
      spotifyUrl: sa.external_urls.spotify,
      lastFetchedAt: new Date(),
    },
  });
}

function upsertTrack(st: SpotifyTrackResponse, artistId: string) {
  const primaryArtist = st.artists[0];

  return db.track.upsert({
    where: { spotifyId: st.id },
    create: {
      spotifyId: st.id,
      name: st.name,
      artistId,
      artistName: primaryArtist?.name ?? 'Unknown',
      albumName: st.album.name,
      durationMs: st.duration_ms,
      popularity: st.popularity,
      releaseDate: st.album.release_date,
      previewUrl: st.preview_url,
      spotifyUrl: st.external_urls.spotify,
    },
    update: {
      name: st.name,
      artistName: primaryArtist?.name ?? 'Unknown',
      albumName: st.album.name,
      durationMs: st.duration_ms,
      popularity: st.popularity,
      releaseDate: st.album.release_date,
      previewUrl: st.preview_url,
    },
  });
}

const MAX_CONCURRENT_RELATED = 5;

async function persistRelatedArtistTracks(
  spotifyClient: SpotifyClient,
  relatedArtists: Array<{ id: string; spotifyId: string }>,
) {
  // Process in batches to respect rate limits
  for (let i = 0; i < relatedArtists.length; i += MAX_CONCURRENT_RELATED) {
    const batch = relatedArtists.slice(i, i + MAX_CONCURRENT_RELATED);
    await Promise.all(
      batch.map(async (ra) => {
        try {
          const tracks = await spotifyClient.getArtistTopTracks(ra.spotifyId);
          await Promise.all(tracks.map((t) => upsertTrack(t, ra.id)));
        } catch {
          // Non-critical: log and continue. We can retry later.
          console.warn(`Failed to fetch tracks for related artist ${ra.spotifyId}`);
        }
      }),
    );
  }
}
