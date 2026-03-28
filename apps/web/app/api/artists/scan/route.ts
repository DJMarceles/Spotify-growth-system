import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSpotifyClient } from '@/lib/spotify';
import { scanArtist } from '@/lib/services/artist-scanner';
import { analyzeNeighbors } from '@/lib/services/neighbor-intelligence';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    const scanResult = await scanArtist(client, spotifyArtistId);

    // Auto-analyze neighbors after scan.
    // Non-blocking: if scoring service is down, scan still succeeds.
    let analysis = null;
    try {
      analysis = await analyzeNeighbors(scanResult.artist.id);
    } catch (error) {
      console.warn('Neighbor analysis failed (non-blocking):', error);
    }

    return NextResponse.json({ ...scanResult, analysis });
  } catch (error) {
    console.error('Artist scan failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to scan artist';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
