import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createExperiment, listExperiments, updateExperiment, deleteExperiment } from '@/lib/services/metrics';

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
    const experiments = await listExperiments(id);
    return NextResponse.json(experiments);
  } catch (error) {
    console.error('Failed to list experiments:', error);
    return NextResponse.json({ error: 'Failed to list experiments' }, { status: 500 });
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
    const { name, hypothesis } = body;

    if (!name || !hypothesis) {
      return NextResponse.json({ error: 'name and hypothesis are required' }, { status: 400 });
    }

    const result = await createExperiment(id, name, hypothesis);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to create experiment:', error);
    const message = error instanceof Error ? error.message : 'Failed to create experiment';
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
    const { experimentId, status, outcome } = body;

    if (!experimentId) {
      return NextResponse.json({ error: 'experimentId is required' }, { status: 400 });
    }

    // Verify experiment belongs to this campaign
    const experiment = await db.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }
    if (experiment.campaignId !== id) {
      return NextResponse.json({ error: 'Experiment does not belong to this campaign' }, { status: 403 });
    }

    // Validate status
    const VALID_STATUSES = ['planned', 'running', 'completed'];
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    await updateExperiment(experimentId, { status, outcome });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update experiment:', error);
    const message = error instanceof Error ? error.message : 'Failed to update experiment';
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
    const { experimentId } = body;

    if (!experimentId) {
      return NextResponse.json({ error: 'experimentId is required' }, { status: 400 });
    }

    // Verify experiment belongs to this campaign
    const experiment = await db.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    if (experiment.campaignId !== id) {
      return NextResponse.json({ error: 'Experiment does not belong to this campaign' }, { status: 403 });
    }

    await deleteExperiment(experimentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete experiment:', error);
    return NextResponse.json({ error: 'Failed to delete experiment' }, { status: 500 });
  }
}
