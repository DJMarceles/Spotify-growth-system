import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScannedArtist } from '@/lib/services/artist-scanner';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const artist = await getScannedArtist(id);

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  }

  return NextResponse.json(artist);
}
