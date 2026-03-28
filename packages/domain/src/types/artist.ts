export interface Artist {
  id: string;
  spotifyId: string;
  name: string;
  genres: string[];
  followerCount: number;
  popularity: number;
  imageUrl: string | null;
  spotifyUrl: string;
}

export interface ArtistNeighbor {
  id: string;
  sourceArtistId: string;
  neighborArtistId: string;
  adjacencyScore: number;
  followerRatioScore: number;
  popularityGapScore: number;
  genreOverlapScore: number;
  eraSimilarityScore: number;
  sizeBucket: SizeBucket;
  closedLoopRisk: ClosedLoopRisk;
  explanation: string;
}

export type SizeBucket = 'smaller' | 'similar' | 'slightly-larger' | 'much-larger';

export type ClosedLoopRisk = 'low' | 'medium' | 'high';
