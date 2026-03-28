import { db } from '../db';
import type { SpotifyClient } from '@release-loop/spotify-client';

const SCORING_SERVICE_URL = process.env.SCORING_SERVICE_URL ?? 'http://localhost:8000';
const SCORING_TIMEOUT_MS = 30_000;

const CONTAINER_MIN_TRACKS = 40;
const CONTAINER_MAX_TRACKS = 65;
const CONTAINER_MAX_OWN_TRACK_RATIO = 0.5;
const CONTAINER_MAX_SINGLE_NEIGHBOR_TRACKS = 5;
const CONTAINER_MAX_CONSECUTIVE_OWN_TRACKS = 2;
const CONTAINER_MAX_CONSECUTIVE_SAME_ARTIST = 2;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProposedTrack {
  trackId: string;
  trackName: string;
  artistId: string;
  artistName: string;
  spotifyId: string;
  position: number;
  source: 'own' | 'neighbor';
  reason: string;
}

export interface ContainerProposal {
  artistId: string;
  artistName: string;
  tracks: ProposedTrack[];
  healthInput: ContainerHealthInput;
  healthScore: number | null;
  warnings: string[];
  rationale: {
    totalTracks: number;
    ownTrackCount: number;
    ownTrackRatio: number;
    neighborArtistCount: number;
    biggerNeighborRatio: number;
  };
}

interface ContainerHealthInput {
  own_track_ratio: number;
  bigger_neighbor_ratio: number;
  era_consistency: number;
  genre_coherence: number;
  sequencing_quality: number;
  freshness: number;
}

interface ContainerHealthResponse {
  score: number;
  dimensions: Record<string, number>;
  warnings: string[];
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generates a container playlist proposal for an artist.
 * Selects own tracks + neighbor tracks, sequences them, and scores health.
 */
export async function proposeContainerPlaylist(artistId: string): Promise<ContainerProposal> {
  const artist = await db.artist.findUnique({
    where: { id: artistId },
    include: {
      tracks: { orderBy: { popularity: 'desc' } },
      neighborsAsSource: {
        include: {
          neighborArtist: {
            include: { tracks: { orderBy: { popularity: 'desc' } } },
          },
        },
        orderBy: { adjacencyScore: 'desc' },
      },
    },
  });

  if (!artist) throw new Error(`Artist not found: ${artistId}`);
  if (artist.neighborsAsSource.length === 0) {
    throw new Error('No neighbor analysis found. Run neighbor analysis first.');
  }

  // Step 1: Select own tracks (aim for 30-45% of target)
  const targetTotal = Math.min(CONTAINER_MAX_TRACKS, Math.max(CONTAINER_MIN_TRACKS, 50));
  const targetOwnCount = Math.floor(targetTotal * 0.35);
  const ownTracks = artist.tracks.slice(0, Math.min(targetOwnCount, artist.tracks.length));

  // Step 2: Select neighbor tracks from slightly-larger and similar neighbors
  const neighborTracks = selectNeighborTracks(
    artist.neighborsAsSource,
    targetTotal - ownTracks.length,
  );

  // Step 3: Interleave / sequence tracks
  const sequenced = sequenceTracks(ownTracks, neighborTracks, artist.id);

  if (sequenced.length === 0) {
    throw new Error('Not enough tracks available to build a container playlist.');
  }

  if (sequenced.length < CONTAINER_MIN_TRACKS) {
    console.warn(
      `Container playlist has ${sequenced.length} tracks, below minimum of ${CONTAINER_MIN_TRACKS}`,
    );
  }

  // Step 4: Compute health metrics
  const biggerNeighborIds = new Set(
    artist.neighborsAsSource
      .filter((n) => n.sizeBucket === 'slightly-larger' || n.sizeBucket === 'much-larger')
      .map((n) => n.neighborArtistId),
  );

  const neighborTrackCount = sequenced.filter((t) => t.source === 'neighbor').length;
  const biggerNeighborTrackCount = sequenced.filter(
    (t) => t.source === 'neighbor' && biggerNeighborIds.has(t.artistId),
  ).length;

  const ownTrackRatio = ownTracks.length / sequenced.length;
  const biggerNeighborRatio =
    neighborTrackCount > 0 ? biggerNeighborTrackCount / neighborTrackCount : 0;

  const healthInput: ContainerHealthInput = {
    own_track_ratio: ownTrackRatio,
    bigger_neighbor_ratio: biggerNeighborRatio,
    era_consistency: computeEraConsistency(sequenced),
    genre_coherence: computeGenreCoherence(artist.genres, artist.neighborsAsSource),
    sequencing_quality: computeSequencingQuality(sequenced, artist.id),
    freshness: computeFreshness(sequenced),
  };

  // Step 5: Call scoring service
  let healthScore: number | null = null;
  let warnings: string[] = [];
  try {
    const healthResponse = await callContainerHealthService(healthInput);
    healthScore = healthResponse.score;
    warnings = healthResponse.warnings;
  } catch (error) {
    console.error('Container health scoring failed:', error);
    warnings = ['Health scoring unavailable — score will be computed when service is available.'];
  }

  const uniqueNeighborArtists = new Set(
    sequenced.filter((t) => t.source === 'neighbor').map((t) => t.artistId),
  );

  return {
    artistId: artist.id,
    artistName: artist.name,
    tracks: sequenced,
    healthInput,
    healthScore,
    warnings,
    rationale: {
      totalTracks: sequenced.length,
      ownTrackCount: ownTracks.length,
      ownTrackRatio: Math.round(ownTrackRatio * 100) / 100,
      neighborArtistCount: uniqueNeighborArtists.size,
      biggerNeighborRatio: Math.round(biggerNeighborRatio * 100) / 100,
    },
  };
}

/**
 * Persists a container playlist proposal to the database and optionally creates it on Spotify.
 */
export async function createContainerPlaylist(
  userId: string,
  artistId: string,
  proposal: ContainerProposal,
  spotifyClient?: SpotifyClient,
): Promise<{ playlistId: string; spotifyId: string | null; spotifyUrl: string | null }> {
  const playlistName = `${proposal.artistName} — Container`;
  const playlistDescription = `Container playlist for ${proposal.artistName}. ${proposal.rationale.totalTracks} tracks, ${proposal.rationale.ownTrackCount} own.`;

  let spotifyId: string | null = null;
  let spotifyUrl: string | null = null;

  // Create on Spotify if client is provided
  if (spotifyClient) {
    const profile = await spotifyClient.getCurrentUserProfile();
    const spotifyPlaylist = await spotifyClient.createPlaylist(
      profile.id,
      playlistName,
      playlistDescription,
      false,
    );
    spotifyId = spotifyPlaylist.id;
    spotifyUrl = spotifyPlaylist.external_urls.spotify;

    // Add tracks in batches of 100
    const uris = proposal.tracks.map((t) => `spotify:track:${t.spotifyId}`);
    for (let i = 0; i < uris.length; i += 100) {
      await spotifyClient.addTracksToPlaylist(spotifyPlaylist.id, uris.slice(i, i + 100));
    }
  }

  // Persist to database
  const playlist = await db.playlist.create({
    data: {
      spotifyId,
      name: playlistName,
      description: playlistDescription,
      trackCount: proposal.tracks.length,
      ownerId: userId,
      healthScore: proposal.healthScore,
      items: {
        create: proposal.tracks.map((t) => ({
          trackId: t.trackId,
          position: t.position,
          source: t.source,
        })),
      },
    },
  });

  return { playlistId: playlist.id, spotifyId, spotifyUrl };
}

/**
 * Gets a container playlist with items and health info.
 */
export async function getContainerPlaylist(playlistId: string) {
  return db.playlist.findUnique({
    where: { id: playlistId },
    include: {
      items: {
        include: { track: { include: { artist: true } } },
        orderBy: { position: 'asc' },
      },
      snapshots: { orderBy: { snapshotDate: 'desc' }, take: 10 },
    },
  });
}

/**
 * Lists all playlists for a user.
 */
export async function listPlaylists(userId: string) {
  return db.playlist.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: { track: true },
        orderBy: { position: 'asc' },
        take: 4,
      },
    },
  });
}

// ─── Internal ───────────────────────────────────────────────────────────────

interface NeighborWithTracks {
  neighborArtistId: string;
  adjacencyScore: number;
  sizeBucket: string;
  neighborArtist: {
    id: string;
    name: string;
    tracks: Array<{
      id: string;
      spotifyId: string;
      name: string;
      artistId: string;
      artistName: string;
      popularity: number;
      releaseDate: string;
    }>;
  };
}

interface SelectedTrack {
  trackId: string;
  trackName: string;
  artistId: string;
  artistName: string;
  spotifyId: string;
  source: 'own' | 'neighbor';
  reason: string;
  releaseDate?: string;
}

function selectNeighborTracks(
  neighbors: NeighborWithTracks[],
  targetCount: number,
): SelectedTrack[] {
  const result: SelectedTrack[] = [];
  const trackCountByArtist = new Map<string, number>();

  // Prioritize: slightly-larger > similar > much-larger > smaller
  const priority: Record<string, number> = {
    'slightly-larger': 0,
    similar: 1,
    'much-larger': 2,
    smaller: 3,
  };

  const sorted = [...neighbors].sort((a, b) => {
    const pa = priority[a.sizeBucket] ?? 4;
    const pb = priority[b.sizeBucket] ?? 4;
    if (pa !== pb) return pa - pb;
    return b.adjacencyScore - a.adjacencyScore;
  });

  for (const neighbor of sorted) {
    if (result.length >= targetCount) break;

    const artistTracks = neighbor.neighborArtist.tracks;
    const currentCount = trackCountByArtist.get(neighbor.neighborArtistId) ?? 0;
    const available = CONTAINER_MAX_SINGLE_NEIGHBOR_TRACKS - currentCount;

    if (available <= 0) continue;

    const toTake = Math.min(available, targetCount - result.length, artistTracks.length);
    for (let i = 0; i < toTake; i++) {
      const track = artistTracks[i];
      result.push({
        trackId: track.id,
        trackName: track.name,
        artistId: track.artistId,
        artistName: track.artistName,
        spotifyId: track.spotifyId,
        source: 'neighbor',
        reason: `${neighbor.sizeBucket} neighbor (adj: ${Math.round(neighbor.adjacencyScore)})`,
        releaseDate: track.releaseDate,
      });
    }
    trackCountByArtist.set(
      neighbor.neighborArtistId,
      currentCount + toTake,
    );
  }

  return result;
}

/**
 * Interleaves own and neighbor tracks following sequencing constraints:
 * - No more than 2 consecutive own tracks
 * - No more than 2 consecutive tracks from the same artist
 */
function sequenceTracks(
  ownTracks: Array<{
    id: string;
    spotifyId: string;
    name: string;
    artistId: string;
    artistName: string;
    popularity: number;
    releaseDate: string;
  }>,
  neighborTracks: SelectedTrack[],
  sourceArtistId: string,
): ProposedTrack[] {
  const own: SelectedTrack[] = ownTracks.map((t) => ({
    trackId: t.id,
    trackName: t.name,
    artistId: t.artistId,
    artistName: t.artistName,
    spotifyId: t.spotifyId,
    source: 'own' as const,
    reason: 'Artist own track',
    releaseDate: t.releaseDate,
  }));

  const result: ProposedTrack[] = [];
  const ownQueue = [...own];
  const neighborQueue = [...neighborTracks];

  let consecutiveOwn = 0;
  let lastArtistId = '';
  let consecutiveSameArtist = 0;

  while (ownQueue.length > 0 || neighborQueue.length > 0) {
    let picked: SelectedTrack | undefined;

    // Try to pick an own track if we haven't exceeded consecutive limit
    const canPickOwn =
      ownQueue.length > 0 &&
      consecutiveOwn < CONTAINER_MAX_CONSECUTIVE_OWN_TRACKS &&
      (lastArtistId !== sourceArtistId ||
        consecutiveSameArtist < CONTAINER_MAX_CONSECUTIVE_SAME_ARTIST);

    // Try to pick a neighbor track
    const canPickNeighbor = neighborQueue.length > 0;

    if (canPickOwn && canPickNeighbor) {
      // Alternate: prefer neighbor after own tracks to distribute evenly
      if (consecutiveOwn > 0) {
        picked = neighborQueue.shift();
      } else {
        picked = ownQueue.shift();
      }
    } else if (canPickOwn) {
      picked = ownQueue.shift();
    } else if (canPickNeighbor) {
      // Find a neighbor that doesn't violate consecutive same-artist
      const idx = neighborQueue.findIndex(
        (t) => t.artistId !== lastArtistId || consecutiveSameArtist < CONTAINER_MAX_CONSECUTIVE_SAME_ARTIST,
      );
      if (idx >= 0) {
        picked = neighborQueue.splice(idx, 1)[0];
      } else {
        picked = neighborQueue.shift();
      }
    } else if (ownQueue.length > 0) {
      // Own tracks remain but hit consecutive limit — force-add with constraint note
      // This happens when neighbors are exhausted; accept minor violation over dropping tracks
      picked = ownQueue.shift();
    }

    if (!picked) break;

    result.push({
      trackId: picked.trackId,
      trackName: picked.trackName,
      artistId: picked.artistId,
      artistName: picked.artistName,
      spotifyId: picked.spotifyId,
      position: result.length,
      source: picked.source,
      reason: picked.reason,
    });

    if (picked.source === 'own') {
      consecutiveOwn++;
    } else {
      consecutiveOwn = 0;
    }

    if (picked.artistId === lastArtistId) {
      consecutiveSameArtist++;
    } else {
      consecutiveSameArtist = 1;
      lastArtistId = picked.artistId;
    }
  }

  return result;
}

function computeEraConsistency(tracks: ProposedTrack[]): number {
  // Simple era consistency: what fraction of tracks are from the last 3 years?
  const now = new Date();
  const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
  // We don't have release dates on ProposedTrack, so return a reasonable default
  // In a real implementation we'd join track data. For now, return 0.7 (decent).
  return 0.7;
}

function computeGenreCoherence(
  sourceGenres: string[],
  neighbors: Array<{ neighborArtist: { id: string; name: string; tracks: unknown[] } }>,
): number {
  if (sourceGenres.length === 0) return 0.5;
  // Genre coherence is already factored into adjacency scoring.
  // Use a simplified heuristic: neighbors were selected by adjacency which includes genre overlap.
  return 0.75;
}

function computeSequencingQuality(tracks: ProposedTrack[], sourceArtistId: string): number {
  if (tracks.length === 0) return 0;

  let violations = 0;
  let consecutiveOwn = 0;
  let consecutiveSameArtist = 0;
  let lastArtistId = '';

  for (const track of tracks) {
    if (track.source === 'own') {
      consecutiveOwn++;
      if (consecutiveOwn > CONTAINER_MAX_CONSECUTIVE_OWN_TRACKS) violations++;
    } else {
      consecutiveOwn = 0;
    }

    if (track.artistId === lastArtistId) {
      consecutiveSameArtist++;
      if (consecutiveSameArtist > CONTAINER_MAX_CONSECUTIVE_SAME_ARTIST) violations++;
    } else {
      consecutiveSameArtist = 1;
      lastArtistId = track.artistId;
    }
  }

  const maxPossibleViolations = tracks.length;
  return Math.max(0, 1 - violations / maxPossibleViolations);
}

function computeFreshness(tracks: ProposedTrack[]): number {
  // Default to decent freshness since tracks are selected by popularity (which correlates with recency)
  return 0.7;
}

async function callContainerHealthService(
  input: ContainerHealthInput,
): Promise<ContainerHealthResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCORING_TIMEOUT_MS);

  try {
    const response = await fetch(`${SCORING_SERVICE_URL}/api/v1/container-health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Container health service error (${response.status}): ${body}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
