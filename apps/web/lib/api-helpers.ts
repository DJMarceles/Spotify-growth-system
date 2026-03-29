import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Authenticates and returns the session user ID, or an error response.
 */
export async function requireAuth(): Promise<
  { userId: string; error?: never } | { userId?: never; error: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { userId: session.user.id };
}

/**
 * Loads a campaign and verifies ownership.
 */
export async function requireCampaignOwnership(
  campaignId: string,
  userId: string,
): Promise<
  { campaign: { id: string; userId: string; status: string; currentWeek: number }; error?: never }
  | { campaign?: never; error: NextResponse }
> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    return { error: NextResponse.json({ error: 'Campaign not found' }, { status: 404 }) };
  }
  if (campaign.userId !== userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { campaign };
}

/**
 * Wraps a handler with standard error logging and JSON error response.
 */
export function apiError(message: string, error: unknown, status = 500): NextResponse {
  console.error(message, error);
  const detail = error instanceof Error ? error.message : message;
  return NextResponse.json({ error: detail }, { status });
}
