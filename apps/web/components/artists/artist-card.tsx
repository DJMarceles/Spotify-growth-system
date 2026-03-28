import Link from 'next/link';

interface ArtistCardProps {
  id: string;
  name: string;
  genres: string[];
  followerCount: number;
  popularity: number;
  imageUrl: string | null;
  trackCount?: number;
  neighborCount?: number;
}

export function ArtistCard({
  id,
  name,
  genres,
  followerCount,
  popularity,
  imageUrl,
  trackCount,
  neighborCount,
}: ArtistCardProps) {
  return (
    <Link
      href={`/artists/${id}`}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="h-16 w-16 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-medium text-muted-foreground">
          {name[0]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground group-hover:text-primary">
          {name}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {genres.length > 0 ? genres.slice(0, 3).join(', ') : 'No genres'}
        </p>
        <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
          <span>{formatCompact(followerCount)} followers</span>
          <span>Pop: {popularity}</span>
          {trackCount !== undefined && <span>{trackCount} tracks</span>}
          {neighborCount !== undefined && <span>{neighborCount} neighbors</span>}
        </div>
      </div>
    </Link>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
