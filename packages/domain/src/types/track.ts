export interface Track {
  id: string;
  spotifyId: string;
  name: string;
  artistId: string;
  artistName: string;
  albumName: string;
  durationMs: number;
  popularity: number;
  releaseDate: string;
  previewUrl: string | null;
  spotifyUrl: string;
}
