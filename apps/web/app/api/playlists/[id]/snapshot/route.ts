import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { takePlaylistSnapshot } from '@/lib/services/playlist-execution';
import { getSpotifyClient } from '@/lib/spotify';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const playlist = await db.playlist.findUnique({ where: { id } });
  if (!playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }
  if (playlist.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    let spotifyClient;
    try {
      spotifyClient = await getSpotifyClient();
    } catch {
      // Spotify not linked — take snapshot without follower data
    }

    const snapshot = await takePlaylistSnapshot(id, spotifyClient);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Snapshot failed:', error);
    const message = error instanceof Error ? error.message : 'Snapshot failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
