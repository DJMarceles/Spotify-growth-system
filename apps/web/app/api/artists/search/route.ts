import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyClient } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ artists: [] });
  }

  try {
    const client = await getSpotifyClient();
    const results = await client.search(query.trim(), ['artist'], 10);

    const artists = (results.artists?.items ?? []).map((a) => ({
      spotifyId: a.id,
      name: a.name,
      genres: a.genres.slice(0, 3),
      followerCount: a.followers.total,
      popularity: a.popularity,
      imageUrl: a.images.length > 0
        ? a.images.sort((x, y) => y.width - x.width)[0].url
        : null,
    }));

    return NextResponse.json({ artists });
  } catch (error) {
    console.error('Artist search failed:', error);
    return NextResponse.json(
      { error: 'Failed to search artists' },
      { status: 500 },
    );
  }
}
