export interface SpotifyClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SpotifyArtistResponse {
  id: string;
  name: string;
  genres: string[];
  followers: { total: number };
  popularity: number;
  images: Array<{ url: string; width: number; height: number }>;
  external_urls: { spotify: string };
}

export interface SpotifyTrackResponse {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    name: string;
    release_date: string;
  };
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

export interface SpotifyPlaylistResponse {
  id: string;
  name: string;
  description: string;
  tracks: { total: number };
  owner: { id: string };
  external_urls: { spotify: string };
}

export interface SpotifyPaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
}
