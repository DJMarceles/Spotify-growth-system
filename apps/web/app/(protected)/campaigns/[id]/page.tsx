import { notFound } from 'next/navigation';
import { getCampaign } from '@/lib/services/campaign-manager';
import { getMetricsSummary } from '@/lib/services/metrics';
import { listExperiments } from '@/lib/services/metrics';
import { CampaignActions } from '@/components/campaigns/campaign-actions';
import { TaskList } from '@/components/campaigns/task-list';
import { RecordMetricForm } from '@/components/metrics/record-metric-form';
import { MetricsDisplay } from '@/components/metrics/metrics-display';
import { ExperimentList } from '@/components/metrics/experiment-list';
import { RecommendationPanel } from '@/components/campaigns/recommendation-panel';

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params;
  const [campaign, metricsTrends, experiments] = await Promise.all([
    getCampaign(id),
    getMetricsSummary(id),
    listExperiments(id),
  ]);

  if (!campaign) notFound();

  const completedTasks = campaign.tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = campaign.tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {campaign.artist.name}
            {campaign.startDate && (
              <> — Started {new Date(campaign.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </p>
        </div>
        <CampaignActions
          campaignId={campaign.id}
          status={campaign.status}
          currentWeek={campaign.currentWeek}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Status" value={campaign.status} />
        <StatCard label="Week" value={`${campaign.currentWeek}/8`} />
        <StatCard label="Tasks Done" value={`${completedTasks}/${totalTasks}`} />
        <StatCard label="Completion" value={`${completionRate}%`} />
        <StatCard
          label="Readiness"
          value={campaign.releaseReadinessScore !== null ? Math.round(campaign.releaseReadinessScore) : '—'}
          color={
            campaign.releaseReadinessScore !== null
              ? campaign.releaseReadinessScore >= 70
                ? 'text-green-600'
                : campaign.releaseReadinessScore >= 40
                  ? 'text-yellow-600'
                  : 'text-red-600'
              : undefined
          }
        />
      </div>

      {/* Linked Playlist */}
      {campaign.playlist && (
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Container Playlist</p>
              <p className="font-medium text-foreground">{campaign.playlist.name}</p>
            </div>
            {campaign.playlist.healthScore !== null && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Health</p>
                <p className="text-lg font-bold text-foreground">{Math.round(campaign.playlist.healthScore)}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {campaign.status !== 'draft' && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Recommendations</h2>
          <RecommendationPanel
            campaignId={campaign.id}
            recommendations={campaign.recommendations.map((rec) => ({
              id: rec.id,
              type: rec.type,
              severity: rec.severity,
              title: rec.title,
              description: rec.description,
              actionable: rec.actionable,
              dismissed: rec.dismissed,
            }))}
          />
        </section>
      )}

      {/* Metrics */}
      {campaign.status !== 'draft' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Metrics</h2>
          <RecordMetricForm campaignId={campaign.id} currentWeek={campaign.currentWeek} />
          <MetricsDisplay trends={metricsTrends} />
        </section>
      )}

      {/* Experiments */}
      {campaign.status !== 'draft' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Experiments</h2>
          <ExperimentList
            campaignId={campaign.id}
            experiments={experiments.map((e) => ({
              id: e.id,
              name: e.name,
              hypothesis: e.hypothesis,
              status: e.status,
              outcome: e.outcome,
              createdAt: e.createdAt.toISOString(),
            }))}
          />
        </section>
      )}

      {/* Task List */}
      {campaign.tasks.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">8-Week Task Plan</h2>
          <TaskList
            campaignId={campaign.id}
            tasks={campaign.tasks.map((t) => ({
              id: t.id,
              week: t.week,
              title: t.title,
              description: t.description,
              category: t.category,
              status: t.status,
            }))}
            currentWeek={campaign.currentWeek}
          />
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Campaign is in draft. Activate it to generate the 8-week task plan.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-foreground'}`}>{value}</p>
    </div>
  );
}
