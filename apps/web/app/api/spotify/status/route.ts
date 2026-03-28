import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const spotifyAccount = await db.spotifyAccount.findUnique({
    where: { userId: session.user.id },
    select: {
      spotifyId: true,
      displayName: true,
      expiresAt: true,
      scopes: true,
    },
  });

  if (!spotifyAccount) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    spotifyId: spotifyAccount.spotifyId,
    displayName: spotifyAccount.displayName,
    tokenValid: spotifyAccount.expiresAt > new Date(),
    scopes: spotifyAccount.scopes,
  });
}
