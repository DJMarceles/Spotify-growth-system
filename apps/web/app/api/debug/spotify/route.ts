import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSpotifyClient } from '@/lib/spotify';

/**
 * Debug endpoint: calls Spotify API directly and returns raw response.
 * Usage: GET /api/debug/spotify?artistId=SPOTIFY_ID
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artistId = request.nextUrl.searchParams.get('artistId');
  if (!artistId) {
    return NextResponse.json({ error: 'artistId query param required' }, { status: 400 });
  }

  try {
    const client = await getSpotifyClient();

    const [artist, relatedArtists, topTracks] = await Promise.all([
      client.getArtist(artistId),
      client.getRelatedArtists(artistId).catch((e) => ({ error: String(e) })),
      client.getArtistTopTracks(artistId).catch((e) => ({ error: String(e) })),
    ]);

    return NextResponse.json({
      raw_artist: artist,
      raw_related_artists: Array.isArray(relatedArtists)
        ? { count: relatedArtists.length, first: relatedArtists[0] ?? null }
        : relatedArtists,
      raw_top_tracks: Array.isArray(topTracks)
        ? {
            count: topTracks.length,
            tracks: topTracks.map((t) => ({
              name: t.name,
              popularity: t.popularity,
              album: t.album,
            })),
          }
        : topTracks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
