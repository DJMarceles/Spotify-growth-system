import { db } from '../db';

const SCORING_SERVICE_URL = process.env.SCORING_SERVICE_URL ?? 'http://localhost:8000';
const SCORING_TIMEOUT_MS = 30_000;

interface ScoringRequest {
  source_artist: {
    follower_count: number;
    popularity: number;
    genres: string[];
    latest_release_date: string | null;
  };
  candidate_artist: {
    follower_count: number;
    popularity: number;
    genres: string[];
    latest_release_date: string | null;
  };
}

interface ScoringResponse {
  adjacency_score: number;
  follower_ratio_score: number;
  popularity_gap_score: number;
  genre_overlap_score: number;
  era_similarity_score: number;
  size_bucket: string;
  closed_loop_risk: string;
  explanation: string;
}

export interface AnalysisResult {
  artistId: string;
  artistName: string;
  overallClosedLoopRisk: 'low' | 'medium' | 'high';
  neighbors: Array<{
    neighborId: string;
    neighborName: string;
    adjacencyScore: number;
    sizeBucket: string;
    closedLoopRisk: string;
    explanation: string;
  }>;
  summary: {
    totalAnalyzed: number;
    totalFailed: number;
    slightlyLarger: number;
    similar: number;
    smaller: number;
    muchLarger: number;
    averageAdjacencyScore: number;
  };
}

/**
 * Analyzes all related artists for a source artist using the scoring service.
 * Persists ArtistNeighbor records and computes overall closed-loop risk.
 */
export async function analyzeNeighbors(artistId: string): Promise<AnalysisResult> {
  const artist = await db.artist.findUnique({
    where: { id: artistId },
    include: {
      relatedFrom: {
        include: { relatedArtist: true },
      },
      tracks: {
        orderBy: { releaseDate: 'desc' },
        take: 1,
        select: { releaseDate: true },
      },
    },
  });

  if (!artist) {
    throw new Error(`Artist not found: ${artistId}`);
  }

  const relatedArtists = artist.relatedFrom.map((edge) => edge.relatedArtist);

  if (relatedArtists.length === 0) {
    return {
      artistId: artist.id,
      artistName: artist.name,
      overallClosedLoopRisk: 'high',
      neighbors: [],
      summary: {
        totalAnalyzed: 0,
        totalFailed: 0,
        slightlyLarger: 0,
        similar: 0,
        smaller: 0,
        muchLarger: 0,
        averageAdjacencyScore: 0,
      },
    };
  }

  const sourceLatestRelease = artist.tracks[0]?.releaseDate ?? null;

  const { scored: scoredNeighbors, failedCount } = await scoreAllNeighbors(
    artist,
    sourceLatestRelease,
    relatedArtists,
  );

  // Persist to ArtistNeighbor table (replace existing)
  await db.artistNeighbor.deleteMany({
    where: { sourceArtistId: artistId },
  });

  if (scoredNeighbors.length > 0) {
    await db.artistNeighbor.createMany({
      data: scoredNeighbors.map((sn) => ({
        sourceArtistId: artistId,
        neighborArtistId: sn.neighborId,
        adjacencyScore: sn.adjacencyScore,
        followerRatioScore: sn.followerRatioScore,
        popularityGapScore: sn.popularityGapScore,
        genreOverlapScore: sn.genreOverlapScore,
        eraSimilarityScore: sn.eraSimilarityScore,
        sizeBucket: sn.sizeBucket,
        closedLoopRisk: sn.closedLoopRisk,
        explanation: sn.explanation,
      })),
      skipDuplicates: true,
    });
  }

  // Compute summary
  const bucketCounts = { smaller: 0, similar: 0, 'slightly-larger': 0, 'much-larger': 0 };
  let totalScore = 0;

  for (const sn of scoredNeighbors) {
    const bucket = sn.sizeBucket as keyof typeof bucketCounts;
    if (bucket in bucketCounts) bucketCounts[bucket]++;
    totalScore += sn.adjacencyScore;
  }

  const avgScore = scoredNeighbors.length > 0 ? totalScore / scoredNeighbors.length : 0;

  // Overall closed-loop risk: consistent with per-neighbor Python logic.
  // A neighbor is "high risk" if it's smaller + low adjacency, or smaller/similar + moderate adjacency.
  const overallClosedLoopRisk = computeOverallClosedLoopRisk(scoredNeighbors);

  return {
    artistId: artist.id,
    artistName: artist.name,
    overallClosedLoopRisk,
    neighbors: scoredNeighbors.map((sn) => ({
      neighborId: sn.neighborId,
      neighborName: sn.neighborName,
      adjacencyScore: sn.adjacencyScore,
      sizeBucket: sn.sizeBucket,
      closedLoopRisk: sn.closedLoopRisk,
      explanation: sn.explanation,
    })),
    summary: {
      totalAnalyzed: scoredNeighbors.length,
      totalFailed: failedCount,
      slightlyLarger: bucketCounts['slightly-larger'],
      similar: bucketCounts.similar,
      smaller: bucketCounts.smaller,
      muchLarger: bucketCounts['much-larger'],
      averageAdjacencyScore: Math.round(avgScore * 10) / 10,
    },
  };
}

/**
 * Returns existing neighbor analysis from the database, or null if not yet analyzed.
 */
export async function getNeighborAnalysis(artistId: string) {
  const neighbors = await db.artistNeighbor.findMany({
    where: { sourceArtistId: artistId },
    include: { neighborArtist: true },
    orderBy: { adjacencyScore: 'desc' },
  });

  return neighbors;
}

// ─── Internal ────────────────────────────────────────────────────────────────

interface ScoredNeighbor {
  neighborId: string;
  neighborName: string;
  adjacencyScore: number;
  followerRatioScore: number;
  popularityGapScore: number;
  genreOverlapScore: number;
  eraSimilarityScore: number;
  sizeBucket: string;
  closedLoopRisk: string;
  explanation: string;
}

/**
 * Computes overall closed-loop risk consistent with per-neighbor Python logic.
 * Uses the per-neighbor closedLoopRisk field (which factors in both size bucket
 * AND adjacency score) rather than just counting buckets.
 */
function computeOverallClosedLoopRisk(
  scoredNeighbors: ScoredNeighbor[],
): 'low' | 'medium' | 'high' {
  if (scoredNeighbors.length === 0) return 'high';

  let highRisk = 0;
  let mediumRisk = 0;

  for (const sn of scoredNeighbors) {
    if (sn.closedLoopRisk === 'high') highRisk++;
    else if (sn.closedLoopRisk === 'medium') mediumRisk++;
  }

  const riskRatio = (highRisk + mediumRisk) / scoredNeighbors.length;

  if (riskRatio >= 0.7 || highRisk / scoredNeighbors.length >= 0.5) return 'high';
  if (riskRatio >= 0.4) return 'medium';
  return 'low';
}

const MAX_CONCURRENT_SCORING = 5;

async function scoreAllNeighbors(
  sourceArtist: { followerCount: number; popularity: number; genres: string[] },
  sourceLatestRelease: string | null,
  relatedArtists: Array<{
    id: string;
    name: string;
    followerCount: number;
    popularity: number;
    genres: string[];
  }>,
): Promise<{ scored: ScoredNeighbor[]; failedCount: number }> {
  const results: ScoredNeighbor[] = [];
  let failedCount = 0;

  for (let i = 0; i < relatedArtists.length; i += MAX_CONCURRENT_SCORING) {
    const batch = relatedArtists.slice(i, i + MAX_CONCURRENT_SCORING);

    // Batch-fetch latest track release dates to avoid N+1 queries
    const candidateIds = batch.map((c) => c.id);
    const latestTracks = await db.track.findMany({
      where: { artistId: { in: candidateIds } },
      orderBy: { releaseDate: 'desc' },
      distinct: ['artistId'],
      select: { artistId: true, releaseDate: true },
    });
    const latestReleaseByArtist = new Map(
      latestTracks.map((t) => [t.artistId, t.releaseDate]),
    );

    const batchResults = await Promise.all(
      batch.map(async (candidate) => {
        const request: ScoringRequest = {
          source_artist: {
            follower_count: sourceArtist.followerCount,
            popularity: sourceArtist.popularity,
            genres: sourceArtist.genres,
            latest_release_date: sourceLatestRelease,
          },
          candidate_artist: {
            follower_count: candidate.followerCount,
            popularity: candidate.popularity,
            genres: candidate.genres,
            latest_release_date: latestReleaseByArtist.get(candidate.id) ?? null,
          },
        };

        try {
          const response = await callScoringService(request);
          return {
            neighborId: candidate.id,
            neighborName: candidate.name,
            adjacencyScore: response.adjacency_score,
            followerRatioScore: response.follower_ratio_score,
            popularityGapScore: response.popularity_gap_score,
            genreOverlapScore: response.genre_overlap_score,
            eraSimilarityScore: response.era_similarity_score,
            sizeBucket: response.size_bucket,
            closedLoopRisk: response.closed_loop_risk,
            explanation: response.explanation,
          };
        } catch (error) {
          console.error(`Scoring failed for ${candidate.name}:`, error);
          return null;
        }
      }),
    );

    for (const result of batchResults) {
      if (result) {
        results.push(result);
      } else {
        failedCount++;
      }
    }
  }

  return { scored: results, failedCount };
}

async function callScoringService(request: ScoringRequest): Promise<ScoringResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCORING_TIMEOUT_MS);

  try {
    const response = await fetch(`${SCORING_SERVICE_URL}/api/v1/neighbor-intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Scoring service error (${response.status}): ${body}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
