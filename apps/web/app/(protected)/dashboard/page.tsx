import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { SpotifyConnectStatus } from '@/components/auth/spotify-connect-status';
import { getDashboardStats } from '@/lib/services/metrics';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [spotifyAccount, stats] = await Promise.all([
    db.spotifyAccount.findUnique({
      where: { userId },
      select: { spotifyId: true, displayName: true, expiresAt: true },
    }),
    getDashboardStats(userId),
  ]);

  const isConnected = !!spotifyAccount && spotifyAccount.expiresAt > new Date();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ''}. Here is your release
          intelligence overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Campaigns" value={stats.activeCampaigns} href="/campaigns" />
        <StatCard label="Scanned Artists" value={stats.scannedArtists} href="/artists" />
        <StatCard label="Playlists" value={stats.totalPlaylists} href="/playlists" />
        <StatCard
          label="Task Completion"
          value={`${stats.taskCompletionRate}%`}
          sub={`${stats.completedTasks}/${stats.totalTasks} tasks`}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Spotify Status */}
        <div className="rounded-lg border border-border bg-card p-6">
          <SpotifyConnectStatus
            isConnected={isConnected}
            displayName={spotifyAccount?.displayName}
            spotifyId={spotifyAccount?.spotifyId}
          />
        </div>

        {/* Average Health */}
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Avg. Playlist Health</p>
          {stats.averageHealthScore !== null ? (
            <p className={`mt-2 text-3xl font-bold ${
              stats.averageHealthScore >= 70 ? 'text-green-600' :
              stats.averageHealthScore >= 40 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {stats.averageHealthScore}
            </p>
          ) : (
            <p className="mt-2 text-3xl font-bold text-muted-foreground">—</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">Quick Actions</p>
          <div className="mt-3 space-y-2">
            <Link
              href="/artists"
              className="block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Scan an Artist
            </Link>
            <Link
              href="/campaigns"
              className="block rounded-md border border-border px-4 py-2 text-center text-sm font-medium text-foreground hover:bg-muted"
            >
              New Campaign
            </Link>
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      {stats.campaigns.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Your Campaigns</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {campaign.artistImageUrl && (
                    <img src={campaign.artistImageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">{campaign.artistName}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    campaign.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
                    campaign.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Week {campaign.currentWeek}/8</span>
                  <span>{campaign.tasksDone}/{campaign.tasksTotal} tasks</span>
                  {campaign.healthScore !== null && (
                    <span>Health: {Math.round(campaign.healthScore)}</span>
                  )}
                </div>
                {campaign.tasksTotal > 0 && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(campaign.tasksDone / campaign.tasksTotal) * 100}%` }}
                    />
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const content = (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );

  if (href) {
    return <Link href={href} className="block transition-colors hover:opacity-80">{content}</Link>;
  }
  return content;
}
