interface MetricTrend {
  metricType: string;
  label: string;
  current: number | null;
  previous: number | null;
  change: number | null;
  dataPoints: Array<{ week: number; value: number }>;
}

interface MetricsDisplayProps {
  trends: MetricTrend[];
}

export function MetricsDisplay({ trends }: MetricsDisplayProps) {
  if (trends.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No metrics recorded yet. Use the form above to start tracking.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trends.map((trend) => (
        <MetricCard key={trend.metricType} trend={trend} />
      ))}
    </div>
  );
}

function MetricCard({ trend }: { trend: MetricTrend }) {
  const isPercentage = trend.metricType === 'save-rate';

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{trend.label}</p>
      <div className="mt-1 flex items-end gap-2">
        <p className="text-2xl font-bold text-foreground">
          {trend.current !== null ? formatValue(trend.current, isPercentage) : '—'}
        </p>
        {trend.change !== null && (
          <span className={`mb-0.5 text-sm font-medium ${trend.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend.change >= 0 ? '+' : ''}{formatValue(trend.change, isPercentage)}
          </span>
        )}
      </div>

      {/* Mini sparkline */}
      {trend.dataPoints.length > 1 && (
        <div className="mt-3 flex items-end gap-0.5" style={{ height: 32 }}>
          {trend.dataPoints.map((dp, i) => {
            const values = trend.dataPoints.map((d) => d.value);
            const max = Math.max(...values);
            const min = Math.min(...values);
            const range = max - min;
            const height = range > 0 ? ((dp.value - min) / range) * 100 : 50;
            return (
              <div
                key={i}
                className="flex-1 rounded-t bg-primary/30"
                style={{ height: `${Math.max(4, height)}%` }}
                title={`Week ${dp.week}: ${formatValue(dp.value, isPercentage)}`}
              />
            );
          })}
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        {trend.dataPoints.length} data point{trend.dataPoints.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

function formatValue(value: number, isPercentage: boolean): string {
  if (isPercentage) return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}
