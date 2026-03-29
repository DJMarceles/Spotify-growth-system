import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordMetric, getMetricsSummary } from '@/lib/services/metrics';

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
    const summary = await getMetricsSummary(id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Failed to get metrics:', error);
    return NextResponse.json({ error: 'Failed to get metrics' }, { status: 500 });
  }
}

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
    const { week, metricType, value, notes } = body;

    if (typeof week !== 'number' || !metricType || typeof value !== 'number') {
      return NextResponse.json({ error: 'week, metricType, and value are required' }, { status: 400 });
    }

    const result = await recordMetric(id, week, metricType, value, notes);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to record metric:', error);
    const message = error instanceof Error ? error.message : 'Failed to record metric';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
