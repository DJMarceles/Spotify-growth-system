import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listPlaylists } from '@/lib/services/playlist-builder';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const playlists = await listPlaylists(session.user.id);
    return NextResponse.json(playlists);
  } catch (error) {
    console.error('Failed to list playlists:', error);
    return NextResponse.json({ error: 'Failed to list playlists' }, { status: 500 });
  }
}
