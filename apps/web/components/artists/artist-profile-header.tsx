interface ArtistProfileHeaderProps {
  name: string;
  genres: string[];
  followerCount: number;
  popularity: number;
  imageUrl: string | null;
  spotifyUrl: string;
  trackCount: number;
  relatedCount: number;
}

export function ArtistProfileHeader({
  name,
  genres,
  followerCount,
  popularity,
  imageUrl,
  spotifyUrl,
  trackCount,
  relatedCount,
}: ArtistProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="h-28 w-28 rounded-full object-cover shadow-lg"
        />
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-muted text-3xl font-bold text-muted-foreground shadow-lg">
          {name[0]}
        </div>
      )}

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground">{name}</h1>
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#1DB954] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#1ed760]"
          >
            Open in Spotify
          </a>
        </div>

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-6 text-sm text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground">{formatCompact(followerCount)}</span>{' '}
            followers
          </div>
          <div>
            <span className="font-semibold text-foreground">{popularity}</span> popularity
          </div>
          <div>
            <span className="font-semibold text-foreground">{trackCount}</span> tracks scanned
          </div>
          <div>
            <span className="font-semibold text-foreground">{relatedCount}</span> related artists
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
