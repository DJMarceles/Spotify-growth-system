interface NeighborScoreCardProps {
  neighbor: {
    neighborArtist: {
      id: string;
      name: string;
      followerCount: number;
      popularity: number;
      imageUrl: string | null;
      genres: string[];
    };
    adjacencyScore: number;
    followerRatioScore: number;
    popularityGapScore: number;
    genreOverlapScore: number;
    eraSimilarityScore: number;
    sizeBucket: string;
    closedLoopRisk: string;
    explanation: string;
  };
}

export function NeighborScoreCard({ neighbor }: NeighborScoreCardProps) {
  const { neighborArtist: artist } = neighbor;
  const score = neighbor.adjacencyScore;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {artist.imageUrl ? (
          <img
            src={artist.imageUrl}
            alt={artist.name}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
            {artist.name[0]}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-foreground">{artist.name}</p>
            <SizeBucketBadge bucket={neighbor.sizeBucket} />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCompact(artist.followerCount)} followers · Pop {artist.popularity}
          </p>
        </div>

        <ScoreRing score={score} />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <ScoreDimension label="Followers" value={neighbor.followerRatioScore} />
        <ScoreDimension label="Popularity" value={neighbor.popularityGapScore} />
        <ScoreDimension label="Genre" value={neighbor.genreOverlapScore} />
        <ScoreDimension label="Era" value={neighbor.eraSimilarityScore} />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{neighbor.explanation}</p>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${color} border-current`}>
      <span className={`text-sm font-bold ${color}`}>{Math.round(score)}</span>
    </div>
  );
}

function ScoreDimension({ label, value }: { label: string; value: number }) {
  const barColor = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${value}%` }} />
      </div>
      <p className="mt-0.5 text-xs font-medium text-foreground">{Math.round(value)}</p>
    </div>
  );
}

function SizeBucketBadge({ bucket }: { bucket: string }) {
  const styles: Record<string, string> = {
    smaller: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    similar: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    'slightly-larger': 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
    'much-larger': 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  };

  const labels: Record<string, string> = {
    smaller: 'Smaller',
    similar: 'Similar',
    'slightly-larger': 'Slightly Larger',
    'much-larger': 'Much Larger',
  };

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${styles[bucket] ?? 'bg-muted text-muted-foreground'}`}>
      {labels[bucket] ?? bucket}
    </span>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
