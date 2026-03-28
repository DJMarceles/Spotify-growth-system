interface ClosedLoopRiskBadgeProps {
  risk: 'low' | 'medium' | 'high';
}

const RISK_STYLES = {
  low: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
  high: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
} as const;

const RISK_LABELS = {
  low: 'Low Closed Loop Risk',
  medium: 'Medium Closed Loop Risk',
  high: 'High Closed Loop Risk',
} as const;

export function ClosedLoopRiskBadge({ risk }: ClosedLoopRiskBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${RISK_STYLES[risk]}`}>
      <span className={`h-2 w-2 rounded-full ${risk === 'low' ? 'bg-green-500' : risk === 'medium' ? 'bg-yellow-500' : 'bg-red-500'}`} />
      {RISK_LABELS[risk]}
    </span>
  );
}
