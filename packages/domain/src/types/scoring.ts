export interface NeighborIntelligenceInput {
  sourceArtist: {
    followerCount: number;
    popularity: number;
    genres: string[];
    latestReleaseDate: string | null;
  };
  candidateArtist: {
    followerCount: number;
    popularity: number;
    genres: string[];
    latestReleaseDate: string | null;
  };
}

export interface NeighborIntelligenceOutput {
  adjacencyScore: number;
  followerRatioScore: number;
  popularityGapScore: number;
  genreOverlapScore: number;
  eraSimilarityScore: number;
  sizeBucket: 'smaller' | 'similar' | 'slightly-larger' | 'much-larger';
  closedLoopRisk: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface ContainerHealthInput {
  ownTrackRatio: number;
  biggerNeighborRatio: number;
  eraConsistency: number;
  genreCoherence: number;
  sequencingQuality: number;
  freshness: number;
}

export interface ContainerHealthOutput {
  score: number;
  dimensions: Record<string, number>;
  warnings: string[];
}

export interface ReleaseReadinessInput {
  containerHealth: number;
  taskCompletionRate: number;
  placementReadiness: number;
  operationsCompleteness: number;
  metricsCompleteness: number;
}

export interface ReleaseReadinessOutput {
  score: number;
  dimensions: Record<string, number>;
  blockers: string[];
}
