import type {
  SpotifyClientConfig,
  SpotifyTokens,
  SpotifyArtistResponse,
  SpotifyTrackResponse,
  SpotifyPaginatedResponse,
} from './types';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

export class SpotifyClient {
  private config: SpotifyClientConfig;
  private tokens: SpotifyTokens | null = null;

  constructor(config: SpotifyClientConfig) {
    this.config = config;
  }

  setTokens(tokens: SpotifyTokens): void {
    this.tokens = tokens;
  }

  getAuthorizationUrl(state: string, scopes: string[]): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      scope: scopes.join(' '),
      redirect_uri: this.config.redirectUri,
      state,
    });
    return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<SpotifyTokens> {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Spotify token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    const tokens: SpotifyTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    this.tokens = tokens;
    return tokens;
  }

  async refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Spotify token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    const tokens: SpotifyTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    this.tokens = tokens;
    return tokens;
  }

  async getArtist(artistId: string): Promise<SpotifyArtistResponse> {
    return this.request<SpotifyArtistResponse>(`/artists/${artistId}`);
  }

  async getRelatedArtists(artistId: string): Promise<SpotifyArtistResponse[]> {
    const data = await this.request<{ artists: SpotifyArtistResponse[] }>(
      `/artists/${artistId}/related-artists`,
    );
    return data.artists;
  }

  async getArtistTopTracks(
    artistId: string,
    market: string = 'US',
  ): Promise<SpotifyTrackResponse[]> {
    const data = await this.request<{ tracks: SpotifyTrackResponse[] }>(
      `/artists/${artistId}/top-tracks?market=${market}`,
    );
    return data.tracks;
  }

  async createPlaylist(
    userId: string,
    name: string,
    description: string,
    isPublic: boolean = true,
  ): Promise<{ id: string; external_urls: { spotify: string } }> {
    return this.request(`/users/${userId}/playlists`, {
      method: 'POST',
      body: JSON.stringify({ name, description, public: isPublic }),
    });
  }

  async addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
  ): Promise<{ snapshot_id: string }> {
    return this.request(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: trackUris }),
    });
  }

  async reorderPlaylistTracks(
    playlistId: string,
    rangeStart: number,
    insertBefore: number,
    rangeLength: number = 1,
  ): Promise<{ snapshot_id: string }> {
    return this.request(`/playlists/${playlistId}/tracks`, {
      method: 'PUT',
      body: JSON.stringify({
        range_start: rangeStart,
        insert_before: insertBefore,
        range_length: rangeLength,
      }),
    });
  }

  async getPlaylist(playlistId: string): Promise<{
    id: string;
    name: string;
    description: string;
    followers: { total: number };
    tracks: { total: number; items: Array<{ track: SpotifyTrackResponse; added_at: string }> };
    snapshot_id: string;
    external_urls: { spotify: string };
  }> {
    return this.request(`/playlists/${playlistId}`);
  }

  async removeTracksFromPlaylist(
    playlistId: string,
    trackUris: string[],
  ): Promise<{ snapshot_id: string }> {
    return this.request(`/playlists/${playlistId}/tracks`, {
      method: 'DELETE',
      body: JSON.stringify({
        tracks: trackUris.map((uri) => ({ uri })),
      }),
    });
  }

  async replacePlaylistTracks(
    playlistId: string,
    trackUris: string[],
  ): Promise<{ snapshot_id: string }> {
    return this.request(`/playlists/${playlistId}/tracks`, {
      method: 'PUT',
      body: JSON.stringify({ uris: trackUris }),
    });
  }

  async getCurrentUserProfile(): Promise<{ id: string; display_name: string }> {
    return this.request('/me');
  }

  async search(
    query: string,
    types: string[],
    limit: number = 20,
  ): Promise<{
    artists?: SpotifyPaginatedResponse<SpotifyArtistResponse>;
    tracks?: SpotifyPaginatedResponse<SpotifyTrackResponse>;
  }> {
    const params = new URLSearchParams({
      q: query,
      type: types.join(','),
      limit: limit.toString(),
    });
    return this.request(`/search?${params.toString()}`);
  }

  private async request<T>(endpoint: string, init?: RequestInit): Promise<T> {
    if (!this.tokens) {
      throw new Error('SpotifyClient: No tokens set. Call setTokens() first.');
    }

    if (this.tokens.expiresAt < Date.now() + 60_000) {
      await this.refreshAccessToken(this.tokens.refreshToken);
    }

    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}
