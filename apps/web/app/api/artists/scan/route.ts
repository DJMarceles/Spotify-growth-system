import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyClient } from '@/lib/spotify';
import { scanArtist } from '@/lib/services/artist-scanner';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const spotifyArtistId = body.spotifyArtistId;

    if (!spotifyArtistId || typeof spotifyArtistId !== 'string') {
      return NextResponse.json(
        { error: 'spotifyArtistId is required' },
        { status: 400 },
      );
    }

    const client = await getSpotifyClient();
    const result = await scanArtist(client, spotifyArtistId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Artist scan failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to scan artist';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
