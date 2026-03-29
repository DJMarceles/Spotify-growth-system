import { db } from '../db';

const SCORING_SERVICE_URL = process.env.SCORING_SERVICE_URL ?? 'http://localhost:8000';
const SCORING_TIMEOUT_MS = 30_000;

interface ArtistInput {
  follower_count: number;
  popularity: number;
  genres: string[];
  latest_release_date: string | null;
}

interface ScoringRequest {
  source_artist: ArtistInput;
  candidate_artist: ArtistInput;
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

  if (scoredNeighbors.length === 0 && relatedArtists.length > 0) {
    throw new Error(
      `All ${relatedArtists.length} neighbor scoring attempts failed. ` +
      'Check scoring service connectivity.',
    );
  }

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

let scoringServiceAvailable: boolean | null = null;

async function callScoringService(request: ScoringRequest): Promise<ScoringResponse> {
  // If we already know the service is down, skip the network call
  if (scoringServiceAvailable === false) {
    return computeScoreLocally(request);
  }

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

    scoringServiceAvailable = true;
    return response.json();
  } catch (error) {
    // Connection refused / timeout → fall back to local scoring
    if (scoringServiceAvailable === null) {
      console.warn('Scoring service unavailable, using local TypeScript scoring');
      scoringServiceAvailable = false;
    }
    return computeScoreLocally(request);
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Local TypeScript scoring (mirrors Python neighbor_intelligence.py) ──────

const IDEAL_RATIO_MIN = 1.0;
const IDEAL_RATIO_MAX = 10.0;
const IDEAL_RATIO_SWEET = 3.0;
const IDEAL_POP_GAP_MAX = 20;

const WEIGHT_FOLLOWER_RATIO = 0.30;
const WEIGHT_POPULARITY_GAP = 0.25;
const WEIGHT_GENRE_OVERLAP = 0.25;
const WEIGHT_ERA_SIMILARITY = 0.20;

function clamp(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
}

function computeScoreLocally(req: ScoringRequest): ScoringResponse {
  const src = req.source_artist;
  const cand = req.candidate_artist;

  const followerRatioScore = scoreFollowerRatio(src.follower_count, cand.follower_count);
  const popularityGapScore = scorePopularityGap(src.popularity, cand.popularity);
  const genreOverlapScore = scoreGenreOverlap(src.genres, cand.genres);
  const eraSimilarityScore = scoreEraSimilarity(src.latest_release_date, cand.latest_release_date);

  const adjacencyScore =
    followerRatioScore * WEIGHT_FOLLOWER_RATIO +
    popularityGapScore * WEIGHT_POPULARITY_GAP +
    genreOverlapScore * WEIGHT_GENRE_OVERLAP +
    eraSimilarityScore * WEIGHT_ERA_SIMILARITY;

  const sizeBucket = determineSizeBucket(src.follower_count, cand.follower_count);
  const closedLoopRisk = determineClosedLoopRisk(sizeBucket, adjacencyScore);
  const explanation = buildExplanation(sizeBucket, followerRatioScore, popularityGapScore, genreOverlapScore);

  return {
    adjacency_score: clamp(adjacencyScore),
    follower_ratio_score: clamp(followerRatioScore),
    popularity_gap_score: clamp(popularityGapScore),
    genre_overlap_score: clamp(genreOverlapScore),
    era_similarity_score: clamp(eraSimilarityScore),
    size_bucket: sizeBucket,
    closed_loop_risk: closedLoopRisk,
    explanation,
  };
}

function scoreFollowerRatio(sourceFollowers: number, candidateFollowers: number): number {
  if (sourceFollowers === 0) return 50;
  const ratio = candidateFollowers / sourceFollowers;

  if (ratio < 0.5) {
    return Math.max(0, 20 * ratio);
  } else if (ratio < IDEAL_RATIO_MIN) {
    return 10 + 40 * ratio;
  } else if (ratio <= IDEAL_RATIO_MAX) {
    const distanceFromSweet = Math.abs(ratio - IDEAL_RATIO_SWEET);
    const maxDistance = Math.max(IDEAL_RATIO_SWEET - IDEAL_RATIO_MIN, IDEAL_RATIO_MAX - IDEAL_RATIO_SWEET);
    return 100 - (distanceFromSweet / maxDistance) * 30;
  } else {
    const over = ratio - IDEAL_RATIO_MAX;
    return Math.max(0, 70 - over * 3);
  }
}

function scorePopularityGap(sourcePop: number, candidatePop: number): number {
  const gap = candidatePop - sourcePop;

  if (gap < -10) {
    return Math.max(0, 30 + gap * 2);
  } else if (gap < 0) {
    return 50 + gap * 2;
  } else if (gap <= IDEAL_POP_GAP_MAX) {
    return 100 - Math.abs(gap - 10) * 2;
  } else {
    const over = gap - IDEAL_POP_GAP_MAX;
    return Math.max(0, 80 - over * 4);
  }
}

function scoreGenreOverlap(sourceGenres: string[], candidateGenres: string[]): number {
  if (!sourceGenres.length || !candidateGenres.length) return 30;

  const sourceSet = new Set(sourceGenres.map((g) => g.toLowerCase()));
  const candidateSet = new Set(candidateGenres.map((g) => g.toLowerCase()));

  let intersection = 0;
  for (const g of sourceSet) {
    if (candidateSet.has(g)) intersection++;
  }
  const union = new Set([...sourceSet, ...candidateSet]).size;

  if (union === 0) return 30;

  const jaccard = intersection / union;
  return Math.min(100, jaccard * 120);
}

function scoreEraSimilarity(sourceDate: string | null, candidateDate: string | null): number {
  if (!sourceDate || !candidateDate) return 50;

  try {
    const srcDate = parseReleaseDate(sourceDate);
    const candDate = parseReleaseDate(candidateDate);
    const diffDays = Math.abs(srcDate.getTime() - candDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays <= 365) return 100;
    if (diffDays <= 730) return 80;
    if (diffDays <= 1825) return 50;
    return Math.max(10, 50 - ((diffDays - 1825) / 365) * 10);
  } catch {
    return 50;
  }
}

function parseReleaseDate(dateStr: string): Date {
  // Try YYYY-MM-DD, then YYYY-MM, then YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr);
  if (/^\d{4}-\d{2}$/.test(dateStr)) return new Date(`${dateStr}-01`);
  if (/^\d{4}$/.test(dateStr)) return new Date(`${dateStr}-01-01`);
  throw new Error(`Cannot parse date: ${dateStr}`);
}

function determineSizeBucket(sourceFollowers: number, candidateFollowers: number): string {
  if (sourceFollowers === 0) return 'similar';
  const ratio = candidateFollowers / sourceFollowers;

  if (ratio < 0.8) return 'smaller';
  if (ratio <= 1.5) return 'similar';
  if (ratio <= 10) return 'slightly-larger';
  return 'much-larger';
}

function determineClosedLoopRisk(sizeBucket: string, adjacencyScore: number): string {
  if (sizeBucket === 'smaller' && adjacencyScore < 40) return 'high';
  if ((sizeBucket === 'smaller' || sizeBucket === 'similar') && adjacencyScore < 60) return 'medium';
  return 'low';
}

function buildExplanation(
  sizeBucket: string,
  followerScore: number,
  popScore: number,
  genreScore: number,
): string {
  const parts: string[] = [];

  const bucketLabels: Record<string, string> = {
    smaller: 'smaller than source',
    similar: 'similar size to source',
    'slightly-larger': 'slightly larger than source (ideal)',
    'much-larger': 'much larger than source',
  };
  parts.push(`Artist is ${bucketLabels[sizeBucket] ?? sizeBucket}.`);

  if (followerScore >= 70) parts.push('Good follower ratio for audience adjacency.');
  else if (followerScore >= 40) parts.push('Moderate follower ratio.');
  else parts.push('Follower ratio is outside ideal range.');

  if (genreScore >= 70) parts.push('Strong genre alignment.');
  else if (genreScore >= 40) parts.push('Partial genre overlap.');
  else parts.push('Weak genre overlap — may reduce context coherence.');

  if (popScore >= 70) parts.push('Popularity gap is in the sweet spot.');
  else if (popScore < 40) parts.push('Popularity gap is too wide or inverted.');

  return parts.join(' ');
}
