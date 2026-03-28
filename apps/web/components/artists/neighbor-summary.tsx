import { ClosedLoopRiskBadge } from './closed-loop-risk-badge';

interface NeighborSummaryProps {
  overallRisk: 'low' | 'medium' | 'high';
  totalAnalyzed: number;
  slightlyLarger: number;
  similar: number;
  smaller: number;
  muchLarger: number;
  averageScore: number;
}

export function NeighborSummary({
  overallRisk,
  totalAnalyzed,
  slightlyLarger,
  similar,
  smaller,
  muchLarger,
  averageScore,
}: NeighborSummaryProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Discovery Context Analysis</h3>
        <ClosedLoopRiskBadge risk={overallRisk} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatItem label="Analyzed" value={totalAnalyzed} />
        <StatItem label="Slightly Larger" value={slightlyLarger} highlight />
        <StatItem label="Similar" value={similar} />
        <StatItem label="Smaller" value={smaller} warn={smaller > totalAnalyzed * 0.5} />
        <StatItem label="Much Larger" value={muchLarger} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Average adjacency score:</span>
        <span className={`text-sm font-bold ${averageScore >= 60 ? 'text-green-600' : averageScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
          {averageScore}
        </span>
      </div>

      {overallRisk === 'high' && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          Most of your related artists are smaller or similar size. Your discovery context is
          constrained — building a container playlist with slightly larger neighbors can help break
          this loop.
        </p>
      )}

      {overallRisk === 'medium' && (
        <p className="mt-3 text-sm text-yellow-600 dark:text-yellow-400">
          Your discovery context has moderate diversity. Adding more slightly larger adjacent artists
          to your container playlist can strengthen your reach potential.
        </p>
      )}
    </div>
  );
}

function StatItem({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}) {
  let valueColor = 'text-foreground';
  if (highlight && value > 0) valueColor = 'text-green-600';
  if (warn) valueColor = 'text-red-600';

  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
