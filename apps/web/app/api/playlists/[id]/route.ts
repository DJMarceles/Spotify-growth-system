import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getContainerPlaylist } from '@/lib/services/playlist-builder';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const playlist = await getContainerPlaylist(id);
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }
    return NextResponse.json(playlist);
  } catch (error) {
    console.error('Failed to get playlist:', error);
    return NextResponse.json({ error: 'Failed to get playlist' }, { status: 500 });
  }
}
