import { db } from '../db';

const SCORING_SERVICE_URL = process.env.SCORING_SERVICE_URL ?? 'http://localhost:8000';

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
  // Load source artist with their related artists and latest track release date
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
        slightlyLarger: 0,
        similar: 0,
        smaller: 0,
        muchLarger: 0,
        averageAdjacencyScore: 0,
      },
    };
  }

  const sourceLatestRelease = artist.tracks[0]?.releaseDate ?? null;

  // Score each related artist via the scoring service
  const scoredNeighbors = await scoreAllNeighbors(
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

  // Overall closed loop risk based on the proportion of smaller/similar neighbors
  const smallerRatio = (bucketCounts.smaller + bucketCounts.similar) / scoredNeighbors.length;
  const overallClosedLoopRisk: 'low' | 'medium' | 'high' =
    smallerRatio >= 0.7 ? 'high' : smallerRatio >= 0.5 ? 'medium' : 'low';

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
): Promise<ScoredNeighbor[]> {
  const results: ScoredNeighbor[] = [];

  // Batch scoring calls to avoid overwhelming the service
  for (let i = 0; i < relatedArtists.length; i += MAX_CONCURRENT_SCORING) {
    const batch = relatedArtists.slice(i, i + MAX_CONCURRENT_SCORING);

    const batchResults = await Promise.all(
      batch.map(async (candidate) => {
        // Get candidate's latest release date from DB
        const candidateTrack = await db.track.findFirst({
          where: { artistId: candidate.id },
          orderBy: { releaseDate: 'desc' },
          select: { releaseDate: true },
        });

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
            latest_release_date: candidateTrack?.releaseDate ?? null,
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
      if (result) results.push(result);
    }
  }

  return results;
}

async function callScoringService(request: ScoringRequest): Promise<ScoringResponse> {
  const response = await fetch(`${SCORING_SERVICE_URL}/api/v1/neighbor-intelligence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Scoring service error (${response.status}): ${body}`);
  }

  return response.json();
}
