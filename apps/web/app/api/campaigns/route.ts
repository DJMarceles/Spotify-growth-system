import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createCampaign, listCampaigns } from '@/lib/services/campaign-manager';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const campaigns = await listCampaigns(session.user.id);
    return NextResponse.json(campaigns);
  } catch (error) {
    console.error('Failed to list campaigns:', error);
    return NextResponse.json({ error: 'Failed to list campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { artistId, name } = body;

    if (!artistId || !name) {
      return NextResponse.json({ error: 'artistId and name are required' }, { status: 400 });
    }

    const result = await createCampaign(session.user.id, artistId, name);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to create campaign:', error);
    const message = error instanceof Error ? error.message : 'Failed to create campaign';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
