import { db } from '../db';
import type { SpotifyClient } from '@release-loop/spotify-client';

const SCORING_SERVICE_URL = process.env.SCORING_SERVICE_URL ?? 'http://localhost:8000';
const SCORING_TIMEOUT_MS = 30_000;

const STALE_TRACK_AGE_DAYS = 14;
const MAX_TRACKS_TO_REPLACE = 8;
const CONTAINER_MAX_SINGLE_NEIGHBOR_TRACKS = 5;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RefreshResult {
  tracksRemoved: Array<{ trackId: string; name: string; reason: string }>;
  tracksAdded: Array<{ trackId: string; name: string; source: 'own' | 'neighbor' }>;
  newHealthScore: number | null;
  warnings: string[];
}

export interface SnapshotResult {
  id: string;
  followerCount: number;
  trackCount: number;
  healthScore: number | null;
  snapshotDate: Date;
}

export interface SyncResult {
  synced: boolean;
  tracksInDb: number;
  tracksOnSpotify: number;
  action: 'no-change' | 'replaced' | 'spotify-not-linked';
}

// ─── Snapshots ──────────────────────────────────────────────────────────────

/**
 * Takes a health snapshot of a playlist.
 * Fetches current follower count from Spotify if client is provided.
 */
export async function takePlaylistSnapshot(
  playlistId: string,
  spotifyClient?: SpotifyClient,
): Promise<SnapshotResult> {
  const playlist = await db.playlist.findUnique({
    where: { id: playlistId },
    include: {
      items: { include: { track: true }, orderBy: { position: 'asc' } },
    },
  });

  if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);

  // Get follower count from Spotify
  let followerCount = 0;
  if (spotifyClient && playlist.spotifyId) {
    try {
      const spotifyPlaylist = await spotifyClient.getPlaylist(playlist.spotifyId);
      followerCount = spotifyPlaylist.followers.total;
    } catch (error) {
      console.warn('Failed to fetch Spotify playlist followers:', error);
    }
  }

  // Compute health score
  const healthScore = await computePlaylistHealth(playlist);

  // Create snapshot
  const snapshot = await db.playlistSnapshot.create({
    data: {
      playlistId,
      followerCount,
      trackCount: playlist.items.length,
      healthScore,
    },
  });

  // Update playlist health score
  await db.playlist.update({
    where: { id: playlistId },
    data: { healthScore },
  });

  return {
    id: snapshot.id,
    followerCount: snapshot.followerCount,
    trackCount: snapshot.trackCount,
    healthScore: snapshot.healthScore,
    snapshotDate: snapshot.snapshotDate,
  };
}

// ─── Refresh ────────────────────────────────────────────────────────────────

/**
 * Refreshes a container playlist by replacing stale tracks with fresh candidates.
 */
export async function refreshPlaylist(
  playlistId: string,
  spotifyClient?: SpotifyClient,
): Promise<RefreshResult> {
  const playlist = await db.playlist.findUnique({
    where: { id: playlistId },
    include: {
      items: {
        include: { track: { include: { artist: true } } },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);

  // Find the source artist (owner of 'own' tracks)
  const ownItems = playlist.items.filter((item) => item.source === 'own');
  if (ownItems.length === 0) {
    return { tracksRemoved: [], tracksAdded: [], newHealthScore: playlist.healthScore, warnings: ['No own tracks found in playlist.'] };
  }

  const sourceArtistId = ownItems[0].track.artistId;

  // Step 1: Identify stale tracks
  const staleTracks = identifyStaleTracks(playlist.items);

  if (staleTracks.length === 0) {
    return {
      tracksRemoved: [],
      tracksAdded: [],
      newHealthScore: playlist.healthScore,
      warnings: ['No stale tracks detected.'],
    };
  }

  // Step 2: Find replacement candidates
  const tracksToReplace = staleTracks.slice(0, MAX_TRACKS_TO_REPLACE);
  const replacements = await findReplacementTracks(
    sourceArtistId,
    tracksToReplace,
    playlist.items,
  );

  // Step 3: Apply replacements in database
  const tracksRemoved: RefreshResult['tracksRemoved'] = [];
  const tracksAdded: RefreshResult['tracksAdded'] = [];

  for (const replacement of replacements) {
    // Remove old item
    await db.playlistItem.delete({ where: { id: replacement.oldItemId } });
    tracksRemoved.push({
      trackId: replacement.oldTrackId,
      name: replacement.oldTrackName,
      reason: replacement.reason,
    });

    // Add new item at same position
    await db.playlistItem.create({
      data: {
        playlistId,
        trackId: replacement.newTrack.id,
        position: replacement.position,
        source: replacement.newSource,
      },
    });
    tracksAdded.push({
      trackId: replacement.newTrack.id,
      name: replacement.newTrack.name,
      source: replacement.newSource,
    });
  }

  // Step 4: Update track count
  const newCount = await db.playlistItem.count({ where: { playlistId } });
  await db.playlist.update({
    where: { id: playlistId },
    data: { trackCount: newCount, lastRefreshedAt: new Date() },
  });

  // Step 5: Sync to Spotify if linked
  if (spotifyClient && playlist.spotifyId) {
    await syncPlaylistToSpotify(playlistId, spotifyClient);
  }

  // Step 6: Recompute health
  const refreshedPlaylist = await db.playlist.findUnique({
    where: { id: playlistId },
    include: { items: { include: { track: true }, orderBy: { position: 'asc' } } },
  });
  const newHealthScore = refreshedPlaylist ? await computePlaylistHealth(refreshedPlaylist) : null;

  if (newHealthScore !== null) {
    await db.playlist.update({
      where: { id: playlistId },
      data: { healthScore: newHealthScore },
    });
  }

  const warnings: string[] = [];
  if (tracksToReplace.length > replacements.length) {
    warnings.push(
      `Could only replace ${replacements.length} of ${tracksToReplace.length} stale tracks (not enough candidates).`,
    );
  }

  return { tracksRemoved, tracksAdded, newHealthScore, warnings };
}

// ─── Sync ───────────────────────────────────────────────────────────────────

/**
 * Syncs the current database playlist state to Spotify.
 */
export async function syncPlaylistToSpotify(
  playlistId: string,
  spotifyClient: SpotifyClient,
): Promise<SyncResult> {
  const playlist = await db.playlist.findUnique({
    where: { id: playlistId },
    include: {
      items: {
        include: { track: true },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);

  if (!playlist.spotifyId) {
    return { synced: false, tracksInDb: playlist.items.length, tracksOnSpotify: 0, action: 'spotify-not-linked' };
  }

  const dbTrackUris = playlist.items.map((item) => `spotify:track:${item.track.spotifyId}`);

  // Get current Spotify state
  const spotifyPlaylist = await spotifyClient.getPlaylist(playlist.spotifyId);
  const spotifyUris = spotifyPlaylist.tracks.items.map((item) => `spotify:track:${item.track.id}`);

  // Check if already in sync
  const inSync =
    dbTrackUris.length === spotifyUris.length &&
    dbTrackUris.every((uri, i) => uri === spotifyUris[i]);

  if (inSync) {
    return {
      synced: true,
      tracksInDb: dbTrackUris.length,
      tracksOnSpotify: spotifyUris.length,
      action: 'no-change',
    };
  }

  // Replace all tracks on Spotify with DB state (atomic operation)
  if (dbTrackUris.length <= 100) {
    await spotifyClient.replacePlaylistTracks(playlist.spotifyId, dbTrackUris);
  } else {
    // Replace first 100, then add rest in batches
    await spotifyClient.replacePlaylistTracks(playlist.spotifyId, dbTrackUris.slice(0, 100));
    for (let i = 100; i < dbTrackUris.length; i += 100) {
      await spotifyClient.addTracksToPlaylist(playlist.spotifyId, dbTrackUris.slice(i, i + 100));
    }
  }

  return {
    synced: true,
    tracksInDb: dbTrackUris.length,
    tracksOnSpotify: dbTrackUris.length,
    action: 'replaced',
  };
}

// ─── Health History ─────────────────────────────────────────────────────────

/**
 * Gets playlist health history with trend analysis.
 */
export async function getPlaylistHealthHistory(playlistId: string) {
  const snapshots = await db.playlistSnapshot.findMany({
    where: { playlistId },
    orderBy: { snapshotDate: 'asc' },
  });

  if (snapshots.length < 2) {
    return { snapshots, trend: 'insufficient-data' as const, followerGrowth: 0 };
  }

  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];
  const first = snapshots[0];

  const healthTrend =
    latest.healthScore !== null && previous.healthScore !== null
      ? latest.healthScore > previous.healthScore
        ? 'improving'
        : latest.healthScore < previous.healthScore
          ? 'declining'
          : 'stable'
      : 'unknown';

  const followerGrowth = latest.followerCount - first.followerCount;

  return {
    snapshots,
    trend: healthTrend as 'improving' | 'declining' | 'stable' | 'unknown',
    followerGrowth,
  };
}

// ─── Internal ───────────────────────────────────────────────────────────────

interface PlaylistWithItems {
  id: string;
  items: Array<{
    id: string;
    source: string;
    addedAt: Date;
    track: {
      id: string;
      spotifyId: string;
      name: string;
      artistId: string;
      artistName: string;
      popularity: number;
      releaseDate: string;
    };
  }>;
}

interface StaleTrack {
  itemId: string;
  trackId: string;
  trackName: string;
  position: number;
  source: string;
  reason: string;
}

function identifyStaleTracks(
  items: Array<{
    id: string;
    position: number;
    source: string;
    addedAt: Date;
    track: {
      id: string;
      name: string;
      popularity: number;
      releaseDate: string;
    };
  }>,
): StaleTrack[] {
  const now = Date.now();
  const staleThreshold = STALE_TRACK_AGE_DAYS * 24 * 60 * 60 * 1000;
  const results: StaleTrack[] = [];

  for (const item of items) {
    const ageInPlaylist = now - item.addedAt.getTime();
    const isOld = ageInPlaylist > staleThreshold;
    const isLowPopularity = item.track.popularity < 20;

    if (isOld && isLowPopularity) {
      results.push({
        itemId: item.id,
        trackId: item.track.id,
        trackName: item.track.name,
        position: item.position,
        source: item.source,
        reason: `Low popularity (${item.track.popularity}) and in playlist for ${Math.floor(ageInPlaylist / (24 * 60 * 60 * 1000))} days`,
      });
    }
  }

  // Sort: most stale first (lowest popularity, oldest)
  results.sort((a, b) => {
    const itemA = items.find((i) => i.id === a.itemId)!;
    const itemB = items.find((i) => i.id === b.itemId)!;
    return itemA.track.popularity - itemB.track.popularity;
  });

  return results;
}

interface Replacement {
  oldItemId: string;
  oldTrackId: string;
  oldTrackName: string;
  position: number;
  reason: string;
  newTrack: { id: string; spotifyId: string; name: string; artistId: string; artistName: string };
  newSource: 'own' | 'neighbor';
}

async function findReplacementTracks(
  sourceArtistId: string,
  staleTracks: StaleTrack[],
  currentItems: Array<{ track: { id: string; artistId: string } }>,
): Promise<Replacement[]> {
  const currentTrackIds = new Set(currentItems.map((i) => i.track.id));
  const artistTrackCounts = new Map<string, number>();
  for (const item of currentItems) {
    artistTrackCounts.set(
      item.track.artistId,
      (artistTrackCounts.get(item.track.artistId) ?? 0) + 1,
    );
  }

  // Get neighbor artists with high adjacency
  const neighbors = await db.artistNeighbor.findMany({
    where: { sourceArtistId },
    include: {
      neighborArtist: {
        include: { tracks: { orderBy: { popularity: 'desc' } } },
      },
    },
    orderBy: { adjacencyScore: 'desc' },
  });

  // Also get source artist's own tracks not in playlist
  const ownTracks = await db.track.findMany({
    where: { artistId: sourceArtistId, id: { notIn: [...currentTrackIds] } },
    orderBy: { popularity: 'desc' },
    take: 10,
  });

  // Build candidate pool
  const candidates: Array<{
    track: { id: string; spotifyId: string; name: string; artistId: string; artistName: string };
    source: 'own' | 'neighbor';
    priority: number;
  }> = [];

  // Add own tracks as candidates
  for (const track of ownTracks) {
    candidates.push({
      track: { id: track.id, spotifyId: track.spotifyId, name: track.name, artistId: track.artistId, artistName: track.artistName },
      source: 'own',
      priority: track.popularity,
    });
  }

  // Add neighbor tracks as candidates
  for (const neighbor of neighbors) {
    const existingCount = artistTrackCounts.get(neighbor.neighborArtistId) ?? 0;
    if (existingCount >= CONTAINER_MAX_SINGLE_NEIGHBOR_TRACKS) continue;

    let addedFromNeighbor = 0;
    for (const track of neighbor.neighborArtist.tracks) {
      if (currentTrackIds.has(track.id)) continue;
      if (addedFromNeighbor + existingCount >= CONTAINER_MAX_SINGLE_NEIGHBOR_TRACKS) break;

      candidates.push({
        track: { id: track.id, spotifyId: track.spotifyId, name: track.name, artistId: track.artistId, artistName: track.artistName },
        source: 'neighbor',
        priority: track.popularity + neighbor.adjacencyScore,
      });
      addedFromNeighbor++;
    }
  }

  // Sort candidates by priority (best first)
  candidates.sort((a, b) => b.priority - a.priority);

  // Match replacements
  const replacements: Replacement[] = [];
  const usedCandidates = new Set<string>();

  for (const stale of staleTracks) {
    // Prefer same source type, but accept either
    const preferSameSource = stale.source;
    const candidate =
      candidates.find((c) => !usedCandidates.has(c.track.id) && c.source === preferSameSource) ??
      candidates.find((c) => !usedCandidates.has(c.track.id));

    if (!candidate) break;

    usedCandidates.add(candidate.track.id);
    replacements.push({
      oldItemId: stale.itemId,
      oldTrackId: stale.trackId,
      oldTrackName: stale.trackName,
      position: stale.position,
      reason: stale.reason,
      newTrack: candidate.track,
      newSource: candidate.source,
    });
  }

  return replacements;
}

async function computePlaylistHealth(
  playlist: PlaylistWithItems,
): Promise<number | null> {
  const items = playlist.items;
  if (items.length === 0) return null;

  const ownCount = items.filter((i) => i.source === 'own').length;
  const neighborItems = items.filter((i) => i.source === 'neighbor');

  // We need the source artist to determine bigger neighbors
  const ownItem = items.find((i) => i.source === 'own');
  if (!ownItem) return null;

  const sourceArtistId = ownItem.track.artistId;
  const neighbors = await db.artistNeighbor.findMany({
    where: { sourceArtistId },
  });

  const biggerNeighborIds = new Set(
    neighbors
      .filter((n) => n.sizeBucket === 'slightly-larger' || n.sizeBucket === 'much-larger')
      .map((n) => n.neighborArtistId),
  );

  const biggerNeighborTrackCount = neighborItems.filter((i) =>
    biggerNeighborIds.has(i.track.artistId),
  ).length;

  const ownTrackRatio = ownCount / items.length;
  const biggerNeighborRatio =
    neighborItems.length > 0 ? biggerNeighborTrackCount / neighborItems.length : 0;

  const input = {
    own_track_ratio: ownTrackRatio,
    bigger_neighbor_ratio: biggerNeighborRatio,
    era_consistency: 0.7,
    genre_coherence: 0.75,
    sequencing_quality: computeSequencingQuality(items, sourceArtistId),
    freshness: computeFreshness(items),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCORING_TIMEOUT_MS);

    try {
      const response = await fetch(`${SCORING_SERVICE_URL}/api/v1/container-health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.score ?? null;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

function computeSequencingQuality(
  items: Array<{ source: string; track: { artistId: string } }>,
  sourceArtistId: string,
): number {
  if (items.length === 0) return 0;

  let violations = 0;
  let consecutiveOwn = 0;
  let consecutiveSameArtist = 0;
  let lastArtistId = '';

  for (const item of items) {
    if (item.source === 'own') {
      consecutiveOwn++;
      if (consecutiveOwn > 2) violations++;
    } else {
      consecutiveOwn = 0;
    }

    if (item.track.artistId === lastArtistId) {
      consecutiveSameArtist++;
      if (consecutiveSameArtist > 2) violations++;
    } else {
      consecutiveSameArtist = 1;
      lastArtistId = item.track.artistId;
    }
  }

  return Math.max(0, 1 - violations / items.length);
}

function computeFreshness(
  items: Array<{ addedAt: Date; track: { releaseDate: string } }>,
): number {
  if (items.length === 0) return 0;

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  let freshCount = 0;

  for (const item of items) {
    const releaseDate = new Date(item.track.releaseDate);
    if (releaseDate >= sixMonthsAgo) freshCount++;
  }

  return freshCount / items.length;
}
