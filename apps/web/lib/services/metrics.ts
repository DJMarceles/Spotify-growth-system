import { db } from '../db';

// ─── Manual Metrics ─────────────────────────────────────────────────────────

export const METRIC_TYPES = [
  { key: 'monthly-listeners', label: 'Monthly Listeners' },
  { key: 'followers', label: 'Followers' },
  { key: 'playlist-reach', label: 'Playlist Reach' },
  { key: 'save-rate', label: 'Save Rate (%)' },
  { key: 'streams', label: 'Streams' },
] as const;

export async function recordMetric(
  campaignId: string,
  week: number,
  metricType: string,
  value: number,
  notes?: string,
): Promise<{ id: string }> {
  const metric = await db.manualMetric.create({
    data: { campaignId, week, metricType, value, notes: notes ?? null },
  });
  return { id: metric.id };
}

export async function getMetricsForCampaign(campaignId: string) {
  return db.manualMetric.findMany({
    where: { campaignId },
    orderBy: [{ week: 'asc' }, { metricType: 'asc' }],
  });
}

export async function getMetricsSummary(campaignId: string) {
  const metrics = await getMetricsForCampaign(campaignId);

  // Group by metric type
  const byType = new Map<string, Array<{ week: number; value: number }>>();
  for (const m of metrics) {
    const list = byType.get(m.metricType) ?? [];
    list.push({ week: m.week, value: m.value });
    byType.set(m.metricType, list);
  }

  // Compute trends per metric type
  const trends: Array<{
    metricType: string;
    label: string;
    current: number | null;
    previous: number | null;
    change: number | null;
    dataPoints: Array<{ week: number; value: number }>;
  }> = [];

  for (const [type, points] of byType) {
    const sorted = points.sort((a, b) => a.week - b.week);
    const current = sorted[sorted.length - 1]?.value ?? null;
    const previous = sorted.length > 1 ? sorted[sorted.length - 2].value : null;
    const change = current !== null && previous !== null ? current - previous : null;
    const label = METRIC_TYPES.find((t) => t.key === type)?.label ?? type;

    trends.push({ metricType: type, label, current, previous, change, dataPoints: sorted });
  }

  return trends;
}

export async function deleteMetric(metricId: string): Promise<void> {
  await db.manualMetric.delete({ where: { id: metricId } });
}

// ─── Experiments ────────────────────────────────────────────────────────────

export async function createExperiment(
  campaignId: string,
  name: string,
  hypothesis: string,
): Promise<{ id: string }> {
  const experiment = await db.experiment.create({
    data: { campaignId, name, hypothesis },
  });
  return { id: experiment.id };
}

export async function updateExperiment(
  experimentId: string,
  data: { status?: string; outcome?: string },
): Promise<void> {
  await db.experiment.update({
    where: { id: experimentId },
    data,
  });
}

export async function listExperiments(campaignId: string) {
  return db.experiment.findMany({
    where: { campaignId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteExperiment(experimentId: string): Promise<void> {
  await db.experiment.delete({ where: { id: experimentId } });
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────

export async function getDashboardStats(userId: string) {
  const [campaigns, artists, playlists] = await Promise.all([
    db.campaign.findMany({
      where: { userId },
      include: {
        artist: true,
        playlist: true,
        tasks: true,
      },
    }),
    db.artist.count(),
    db.playlist.count({ where: { ownerId: userId } }),
  ]);

  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  const totalTasks = campaigns.reduce((sum, c) => sum + c.tasks.length, 0);
  const completedTasks = campaigns.reduce(
    (sum, c) => sum + c.tasks.filter((t) => t.status === 'completed').length,
    0,
  );

  const avgHealth = (() => {
    const scores = campaigns
      .map((c) => c.playlist?.healthScore)
      .filter((s): s is number => s !== null && s !== undefined);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  })();

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: activeCampaigns.length,
    scannedArtists: artists,
    totalPlaylists: playlists,
    totalTasks,
    completedTasks,
    taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    averageHealthScore: avgHealth !== null ? Math.round(avgHealth) : null,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      currentWeek: c.currentWeek,
      artistName: c.artist.name,
      artistImageUrl: c.artist.imageUrl,
      healthScore: c.playlist?.healthScore ?? null,
      readinessScore: c.releaseReadinessScore,
      tasksDone: c.tasks.filter((t) => t.status === 'completed').length,
      tasksTotal: c.tasks.length,
    })),
  };
}
