import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  generateRecommendations,
  dismissRecommendation,
  listRecommendations,
} from '@/lib/services/recommendations';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const recommendations = await listRecommendations(id);
    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Failed to list recommendations:', error);
    return NextResponse.json({ error: 'Failed to list recommendations' }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await generateRecommendations(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to generate recommendations:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate recommendations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
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
    const { recommendationId } = body;

    if (!recommendationId) {
      return NextResponse.json({ error: 'recommendationId is required' }, { status: 400 });
    }

    // Verify recommendation belongs to this campaign
    const recommendation = await db.recommendation.findUnique({ where: { id: recommendationId } });
    if (!recommendation) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    if (recommendation.campaignId !== id) {
      return NextResponse.json({ error: 'Recommendation does not belong to this campaign' }, { status: 403 });
    }

    await dismissRecommendation(recommendationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to dismiss recommendation:', error);
    return NextResponse.json({ error: 'Failed to dismiss recommendation' }, { status: 500 });
  }
}
