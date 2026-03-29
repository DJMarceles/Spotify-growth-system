import { SpotifyClient } from '@release-loop/spotify-client';
import { auth } from './auth';
import { db } from './db';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// In-flight refresh promises keyed by userId to prevent concurrent refresh races
const refreshLocks = new Map<string, Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }>>();

/**
 * Returns an authenticated SpotifyClient for the current session user.
 *
 * Handles token refresh automatically:
 * 1. Loads tokens from SpotifyAccount table
 * 2. If expired, refreshes via Spotify OAuth (with mutex to prevent races)
 * 3. Persists new tokens back to DB in a transaction
 * 4. Returns a ready-to-use client
 *
 * Throws if no session or no Spotify account is linked.
 */
export async function getSpotifyClient(): Promise<SpotifyClient> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('No authenticated session');
  }

  const userId = session.user.id;

  const spotifyAccount = await db.spotifyAccount.findUnique({
    where: { userId },
  });

  if (!spotifyAccount) {
    throw new Error('No Spotify account linked. Please sign out and sign in again.');
  }

  let { accessToken, refreshToken, expiresAt } = spotifyAccount;

  // Refresh if token expires within the next 5 minutes
  const REFRESH_BUFFER_MS = 5 * 60 * 1000;
  if (expiresAt.getTime() < Date.now() + REFRESH_BUFFER_MS) {
    // Deduplicate concurrent refreshes for the same user
    let refreshPromise = refreshLocks.get(userId);
    if (!refreshPromise) {
      refreshPromise = refreshAndPersist(userId, refreshToken);
      refreshLocks.set(userId, refreshPromise);
      refreshPromise.finally(() => refreshLocks.delete(userId));
    }

    const refreshed = await refreshPromise;
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;
    expiresAt = refreshed.expiresAt;
  }

  const client = new SpotifyClient({
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI ?? 'http://localhost:3000/api/auth/callback/spotify',
  });

  client.setTokens({
    accessToken,
    refreshToken,
    expiresAt: expiresAt.getTime(),
  });

  return client;
}

async function refreshAndPersist(
  userId: string,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const refreshed = await refreshSpotifyTokens(refreshToken);

  // Update both tables atomically
  await db.$transaction([
    db.spotifyAccount.update({
      where: { userId },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
      },
    }),
    db.account.updateMany({
      where: { userId, provider: 'spotify' },
      data: {
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken,
        expires_at: Math.floor(refreshed.expiresAt.getTime() / 1000),
      },
    }),
  ]);

  return refreshed;
}

async function refreshSpotifyTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
