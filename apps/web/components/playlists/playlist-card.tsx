import Link from 'next/link';

interface PlaylistCardProps {
  playlist: {
    id: string;
    name: string;
    trackCount: number;
    healthScore: number | null;
    createdAt: string;
    items: Array<{
      track: {
        name: string;
        artistName: string;
      };
    }>;
  };
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  return (
    <Link
      href={`/playlists/${playlist.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-foreground">{playlist.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {playlist.trackCount} tracks
          </p>
        </div>
        {playlist.healthScore !== null && (
          <HealthBadge score={playlist.healthScore} />
        )}
      </div>

      {playlist.items.length > 0 && (
        <div className="mt-3 space-y-1">
          {playlist.items.map((item, i) => (
            <p key={i} className="truncate text-xs text-muted-foreground">
              {item.track.name} — {item.track.artistName}
            </p>
          ))}
          {playlist.trackCount > playlist.items.length && (
            <p className="text-xs text-muted-foreground">
              +{playlist.trackCount - playlist.items.length} more
            </p>
          )}
        </div>
      )}
    </Link>
  );
}

function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="text-right">
      <p className="text-xs text-muted-foreground">Health</p>
      <p className={`text-lg font-bold ${color}`}>{Math.round(score)}</p>
    </div>
  );
}
