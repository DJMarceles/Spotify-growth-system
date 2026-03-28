import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { proposeContainerPlaylist } from '@/lib/services/playlist-builder';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const proposal = await proposeContainerPlaylist(id);
    return NextResponse.json(proposal);
  } catch (error) {
    console.error('Playlist proposal failed:', error);
    const message = error instanceof Error ? error.message : 'Proposal failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
