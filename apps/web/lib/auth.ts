import NextAuth, { type NextAuthResult } from 'next-auth';
import SpotifyProvider from 'next-auth/providers/spotify';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from './db';

const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-top-read',
  'user-follow-read',
];

const nextAuth: NextAuthResult = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: SPOTIFY_SCOPES.join(' '),
        },
      },
    }),
  ],
  session: {
    strategy: 'database',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (!account || account.provider !== 'spotify') {
        return true;
      }

      // Persist Spotify tokens to our domain SpotifyAccount table.
      // This keeps the auth adapter's Account table for NextAuth mechanics
      // and our SpotifyAccount for domain operations (API calls, refresh).
      try {
        const expiresAt = account.expires_at
          ? new Date(account.expires_at * 1000)
          : new Date(Date.now() + 3600 * 1000);

        await db.spotifyAccount.upsert({
          where: { userId: user.id! },
          create: {
            userId: user.id!,
            spotifyId: account.providerAccountId,
            displayName: user.name ?? null,
            accessToken: account.access_token!,
            refreshToken: account.refresh_token!,
            expiresAt,
            scopes: SPOTIFY_SCOPES,
          },
          update: {
            accessToken: account.access_token!,
            refreshToken: account.refresh_token!,
            expiresAt,
            displayName: user.name ?? null,
            scopes: SPOTIFY_SCOPES,
          },
        });
      } catch (error) {
        console.error('Failed to persist Spotify account:', error);
        // Don't block sign-in if domain table write fails —
        // the NextAuth Account table still has the tokens.
        // We'll reconcile on next API call.
      }

      return true;
    },
  },
});

export const handlers = nextAuth.handlers;
export const auth = nextAuth.auth;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;

export { SPOTIFY_SCOPES };
