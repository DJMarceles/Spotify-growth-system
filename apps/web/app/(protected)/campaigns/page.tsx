import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { listCampaigns } from '@/lib/services/campaign-manager';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { CreateCampaignForm } from '@/components/campaigns/create-campaign-form';

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [campaigns, artists] = await Promise.all([
    listCampaigns(session.user.id),
    db.artist.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, imageUrl: true } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Release Campaigns</h1>
        <p className="mt-1 text-muted-foreground">
          Plan and execute 8-week release cycles for your artists.
        </p>
      </div>

      {/* Create New */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">New Campaign</h2>
        <CreateCampaignForm
          artists={artists.map((a) => ({ id: a.id, name: a.name, imageUrl: a.imageUrl }))}
        />
      </section>

      {/* Existing Campaigns */}
      {campaigns.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Your Campaigns</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={{
                  id: campaign.id,
                  name: campaign.name,
                  status: campaign.status,
                  currentWeek: campaign.currentWeek,
                  releaseReadinessScore: campaign.releaseReadinessScore,
                  artist: { name: campaign.artist.name, imageUrl: campaign.artist.imageUrl },
                  tasks: campaign.tasks.map((t) => ({ status: t.status })),
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
