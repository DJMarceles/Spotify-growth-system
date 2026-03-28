import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { syncPlaylistToSpotify } from '@/lib/services/playlist-execution';
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

  if (!playlist.spotifyId) {
    return NextResponse.json({ error: 'Playlist not linked to Spotify' }, { status: 422 });
  }

  try {
    const spotifyClient = await getSpotifyClient();
    const result = await syncPlaylistToSpotify(id, spotifyClient);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync failed:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
