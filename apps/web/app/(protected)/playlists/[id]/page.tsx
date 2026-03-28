import { notFound } from 'next/navigation';
import { getContainerPlaylist } from '@/lib/services/playlist-builder';
import { getPlaylistHealthHistory } from '@/lib/services/playlist-execution';
import { PlaylistActions } from '@/components/playlists/playlist-actions';
import { HealthTrend } from '@/components/playlists/health-trend';

interface PlaylistDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlaylistDetailPage({ params }: PlaylistDetailPageProps) {
  const { id } = await params;
  const [playlist, healthHistory] = await Promise.all([
    getContainerPlaylist(id),
    getPlaylistHealthHistory(id),
  ]);

  if (!playlist) notFound();

  const ownTracks = playlist.items.filter((item) => item.source === 'own');
  const neighborTracks = playlist.items.filter((item) => item.source === 'neighbor');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{playlist.name}</h1>
          <p className="mt-1 text-muted-foreground">{playlist.description}</p>
          {playlist.spotifyId && (
            <a
              href={`https://open.spotify.com/playlist/${playlist.spotifyId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Open on Spotify
            </a>
          )}
        </div>
        <PlaylistActions playlistId={playlist.id} hasSpotifyId={!!playlist.spotifyId} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Total Tracks" value={playlist.trackCount} />
        <StatCard label="Own Tracks" value={ownTracks.length} />
        <StatCard label="Neighbor Tracks" value={neighborTracks.length} />
        <StatCard
          label="Health Score"
          value={playlist.healthScore !== null ? Math.round(playlist.healthScore) : '—'}
          color={
            playlist.healthScore !== null
              ? playlist.healthScore >= 70
                ? 'text-green-600'
                : playlist.healthScore >= 40
                  ? 'text-yellow-600'
                  : 'text-red-600'
              : undefined
          }
        />
        <StatCard
          label="Last Refreshed"
          value={
            playlist.lastRefreshedAt
              ? new Date(playlist.lastRefreshedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : 'Never'
          }
        />
      </div>

      {/* Health Trend */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Health Trend</h2>
        <HealthTrend
          snapshots={healthHistory.snapshots.map((s) => ({
            ...s,
            snapshotDate: s.snapshotDate.toISOString(),
          }))}
          trend={healthHistory.trend}
          followerGrowth={healthHistory.followerGrowth}
        />
      </section>

      {/* Track List */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Track Sequence</h2>
        <div className="rounded-lg border border-border bg-card">
          {playlist.items.map((item, i) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 border-b border-border/50 px-4 py-2 last:border-0 ${
                item.source === 'own' ? 'bg-primary/5' : ''
              }`}
            >
              <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.track.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.track.artistName}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.source === 'own'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                    : 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
                }`}
              >
                {item.source === 'own' ? 'Own' : 'Neighbor'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-foreground'}`}>{value}</p>
    </div>
  );
}
