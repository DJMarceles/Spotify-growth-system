import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listScannedArtists } from '@/lib/services/artist-scanner';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const artists = await listScannedArtists();
    return NextResponse.json({ artists });
  } catch (error) {
    console.error('Failed to list artists:', error);
    return NextResponse.json(
      { error: 'Failed to list artists' },
      { status: 500 },
    );
  }
}
