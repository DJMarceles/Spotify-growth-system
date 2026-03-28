interface RelatedArtist {
  id: string;
  spotifyId: string;
  name: string;
  genres: string[];
  followerCount: number;
  popularity: number;
  imageUrl: string | null;
}

interface RelatedArtistsListProps {
  artists: RelatedArtist[];
  sourceFollowerCount: number;
}

export function RelatedArtistsList({ artists, sourceFollowerCount }: RelatedArtistsListProps) {
  if (artists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No related artists found.</p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {artists.map((artist) => {
        const ratio = sourceFollowerCount > 0
          ? artist.followerCount / sourceFollowerCount
          : 0;
        const sizeLabel = getSizeLabel(ratio);

        return (
          <div
            key={artist.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            {artist.imageUrl ? (
              <img
                src={artist.imageUrl}
                alt={artist.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {artist.name[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{artist.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatCompact(artist.followerCount)} followers · Pop {artist.popularity}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${sizeLabel.className}`}>
              {sizeLabel.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function getSizeLabel(ratio: number): { text: string; className: string } {
  if (ratio < 0.8) {
    return { text: 'Smaller', className: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200' };
  }
  if (ratio <= 1.5) {
    return { text: 'Similar', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' };
  }
  if (ratio <= 10) {
    return { text: 'Slightly Larger', className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' };
  }
  return { text: 'Much Larger', className: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200' };
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
