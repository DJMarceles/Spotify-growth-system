import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordMetric, getMetricsSummary, deleteMetric } from '@/lib/services/metrics';

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

    const VALID_METRIC_TYPES = ['monthly-listeners', 'followers', 'playlist-reach', 'save-rate', 'streams'];
    if (!VALID_METRIC_TYPES.includes(metricType)) {
      return NextResponse.json({ error: `Invalid metricType. Must be one of: ${VALID_METRIC_TYPES.join(', ')}` }, { status: 400 });
    }

    if (!Number.isInteger(week) || week < 1 || week > 8) {
      return NextResponse.json({ error: 'week must be an integer between 1 and 8' }, { status: 400 });
    }

    const result = await recordMetric(id, week, metricType, value, notes);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to record metric:', error);
    const message = error instanceof Error ? error.message : 'Failed to record metric';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
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
    const { metricId } = body;

    if (!metricId) {
      return NextResponse.json({ error: 'metricId is required' }, { status: 400 });
    }

    // Verify metric belongs to this campaign
    const metric = await db.manualMetric.findUnique({ where: { id: metricId } });
    if (!metric) return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
    if (metric.campaignId !== id) {
      return NextResponse.json({ error: 'Metric does not belong to this campaign' }, { status: 403 });
    }

    await deleteMetric(metricId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete metric:', error);
    return NextResponse.json({ error: 'Failed to delete metric' }, { status: 500 });
  }
}
