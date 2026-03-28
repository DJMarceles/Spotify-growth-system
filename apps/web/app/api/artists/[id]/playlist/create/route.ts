import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { proposeContainerPlaylist, createContainerPlaylist } from '@/lib/services/playlist-builder';
import { getSpotifyClient } from '@/lib/spotify';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const publishToSpotify = body.publishToSpotify !== false;

  try {
    const proposal = await proposeContainerPlaylist(id);

    let spotifyClient;
    if (publishToSpotify) {
      spotifyClient = await getSpotifyClient();
    }

    const result = await createContainerPlaylist(
      session.user.id,
      id,
      proposal,
      spotifyClient ?? undefined,
    );

    return NextResponse.json({
      ...result,
      healthScore: proposal.healthScore,
      trackCount: proposal.tracks.length,
    });
  } catch (error) {
    console.error('Playlist creation failed:', error);
    const message = error instanceof Error ? error.message : 'Creation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
