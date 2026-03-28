import Link from 'next/link';

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    status: string;
    currentWeek: number;
    releaseReadinessScore: number | null;
    artist: { name: string; imageUrl: string | null };
    tasks: Array<{ status: string }>;
  };
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const completedTasks = campaign.tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = campaign.tasks.length;

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start gap-3">
        {campaign.artist.imageUrl && (
          <img
            src={campaign.artist.imageUrl}
            alt={campaign.artist.name}
            className="h-10 w-10 rounded-full object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-foreground">{campaign.name}</h3>
          <p className="text-sm text-muted-foreground">{campaign.artist.name}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Week {campaign.currentWeek}/8
        </span>
        {totalTasks > 0 && (
          <span className="text-muted-foreground">
            {completedTasks}/{totalTasks} tasks
          </span>
        )}
        {campaign.releaseReadinessScore !== null && (
          <span className="font-medium text-foreground">
            Readiness: {Math.round(campaign.releaseReadinessScore)}
          </span>
        )}
      </div>

      {totalTasks > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
          />
        </div>
      )}
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    active: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  };

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}
