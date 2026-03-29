import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { linkPlaylistToCampaign } from '@/lib/services/campaign-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { playlistId } = body;

    if (!playlistId) {
      return NextResponse.json({ error: 'playlistId is required' }, { status: 400 });
    }

    // Verify playlist belongs to user
    const playlist = await db.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    if (playlist.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Playlist does not belong to you' }, { status: 403 });
    }

    await linkPlaylistToCampaign(id, playlistId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to link playlist:', error);
    const message = error instanceof Error ? error.message : 'Failed to link playlist';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
