import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { listPlaylists } from '@/lib/services/playlist-builder';
import { PlaylistCard } from '@/components/playlists/playlist-card';

export default async function PlaylistsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const playlists = await listPlaylists(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Container Playlists</h1>
        <p className="mt-1 text-muted-foreground">
          Your container playlists built from neighbor analysis.
        </p>
      </div>

      {playlists.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={{
                id: playlist.id,
                name: playlist.name,
                trackCount: playlist.trackCount,
                healthScore: playlist.healthScore,
                createdAt: playlist.createdAt.toISOString(),
                items: playlist.items.map((item) => ({
                  track: {
                    name: item.track.name,
                    artistName: item.track.artistName,
                  },
                })),
              }}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No playlists yet. Go to an artist&apos;s page and build a container playlist from their
            neighbor analysis.
          </p>
        </div>
      )}
    </div>
  );
}
