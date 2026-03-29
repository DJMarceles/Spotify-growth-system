import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { SpotifyConnectStatus } from '@/components/auth/spotify-connect-status';

export const metadata = { title: 'Settings — Release Loop OS' };

export default async function SettingsPage() {
  const session = await auth();

  const spotifyAccount = session?.user?.id
    ? await db.spotifyAccount.findFirst({
        where: { userId: session.user.id },
      })
    : null;

  const stats = session?.user?.id
    ? await db.$transaction([
        db.campaign.count({ where: { userId: session.user.id } }),
        db.playlist.count({ where: { ownerId: session.user.id } }),
      ])
    : [0, 0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and connections.</p>
      </div>

      {/* Profile */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</p>
            <p className="mt-1 text-sm text-foreground">{session?.user?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</p>
            <p className="mt-1 text-sm text-foreground">{session?.user?.email ?? '—'}</p>
          </div>
        </div>
      </section>

      {/* Spotify Connection */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Spotify Connection</h2>
        <SpotifyConnectStatus
          isConnected={!!spotifyAccount}
          displayName={spotifyAccount?.displayName ?? null}
          spotifyId={spotifyAccount?.spotifyId ?? null}
        />
      </section>

      {/* Account Stats */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Account Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats[0]}</p>
            <p className="text-xs text-muted-foreground">Total Campaigns</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats[1]}</p>
            <p className="text-xs text-muted-foreground">Playlists Created</p>
          </div>
        </div>
      </section>
    </div>
  );
}
