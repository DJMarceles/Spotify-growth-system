export interface Playlist {
  id: string;
  spotifyId: string | null;
  name: string;
  description: string;
  trackCount: number;
  ownerId: string;
  campaignId: string | null;
  healthScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: Date;
}

export interface PlaylistSnapshot {
  id: string;
  playlistId: string;
  followerCount: number;
  trackCount: number;
  healthScore: number | null;
  snapshotDate: Date;
}

export interface ContainerPlaylistProposal {
  tracks: ProposedTrack[];
  healthScore: number;
  rationale: ContainerRationale;
}

export interface ProposedTrack {
  trackId: string;
  artistId: string;
  position: number;
  source: 'own' | 'neighbor';
  reason: string;
}

export interface ContainerRationale {
  totalTracks: number;
  ownTrackRatio: number;
  neighborArtistCount: number;
  biggerNeighborRatio: number;
  genreCoherence: number;
  eraConsistency: number;
  sequencingQuality: number;
  warnings: string[];
}
