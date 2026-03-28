import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { SpotifyConnectStatus } from '@/components/auth/spotify-connect-status';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const spotifyAccount = await db.spotifyAccount.findUnique({
    where: { userId },
    select: {
      spotifyId: true,
      displayName: true,
      expiresAt: true,
    },
  });

  const isConnected = !!spotifyAccount && spotifyAccount.expiresAt > new Date();

  const campaignCount = await db.campaign.count({
    where: { userId },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ''}. Here is your release
          intelligence overview.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <SpotifyConnectStatus
            isConnected={isConnected}
            displayName={spotifyAccount?.displayName}
            spotifyId={spotifyAccount?.spotifyId}
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Active Campaigns</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{campaignCount}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Quick Actions</p>
          <div className="mt-3 space-y-2">
            <a
              href="/artists"
              className="block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Scan an Artist
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
