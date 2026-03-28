interface Snapshot {
  id: string;
  followerCount: number;
  trackCount: number;
  healthScore: number | null;
  snapshotDate: string;
}

interface HealthTrendProps {
  snapshots: Snapshot[];
  trend: 'improving' | 'declining' | 'stable' | 'unknown' | 'insufficient-data';
  followerGrowth: number;
}

export function HealthTrend({ snapshots, trend, followerGrowth }: HealthTrendProps) {
  if (snapshots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
        <p className="text-muted-foreground">
          No snapshots yet. Take a snapshot to start tracking health trends.
        </p>
      </div>
    );
  }

  const trendLabel = {
    improving: 'Improving',
    declining: 'Declining',
    stable: 'Stable',
    unknown: 'Unknown',
    'insufficient-data': 'Needs more data',
  }[trend];

  const trendColor = {
    improving: 'text-green-600',
    declining: 'text-red-600',
    stable: 'text-blue-600',
    unknown: 'text-muted-foreground',
    'insufficient-data': 'text-muted-foreground',
  }[trend];

  const latest = snapshots[snapshots.length - 1];
  const maxHealth = Math.max(...snapshots.map((s) => s.healthScore ?? 0));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Trend</p>
          <p className={`text-lg font-bold ${trendColor}`}>{trendLabel}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Follower Growth</p>
          <p className={`text-lg font-bold ${followerGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {followerGrowth >= 0 ? '+' : ''}{followerGrowth}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Peak Health</p>
          <p className="text-lg font-bold text-foreground">{Math.round(maxHealth)}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h4 className="font-medium text-foreground">Snapshot History</h4>
        </div>
        <div className="divide-y divide-border/50">
          {[...snapshots].reverse().map((snapshot) => (
            <div key={snapshot.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-foreground">
                  {new Date(snapshot.snapshotDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {snapshot.trackCount} tracks | {snapshot.followerCount} followers
                </p>
              </div>
              <div className="text-right">
                {snapshot.healthScore !== null ? (
                  <HealthBar score={snapshot.healthScore} />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor =
    score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className={`text-sm font-medium ${textColor}`}>{Math.round(score)}</span>
    </div>
  );
}
