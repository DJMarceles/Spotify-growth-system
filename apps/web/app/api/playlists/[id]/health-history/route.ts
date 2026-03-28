import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getPlaylistHealthHistory } from '@/lib/services/playlist-execution';

export async function GET(
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
    const history = await getPlaylistHealthHistory(id);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Health history failed:', error);
    return NextResponse.json({ error: 'Failed to get health history' }, { status: 500 });
  }
}
