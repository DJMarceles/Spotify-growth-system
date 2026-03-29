import { db } from '../db';

const SCORING_SERVICE_URL = process.env.SCORING_SERVICE_URL ?? 'http://localhost:8000';
const SCORING_TIMEOUT_MS = 30_000;
const RELEASE_CYCLE_WEEKS = 8;

// ─── Task Templates ─────────────────────────────────────────────────────────

interface TaskTemplate {
  week: number;
  title: string;
  description: string;
  category: string;
}

const TASK_TEMPLATES: TaskTemplate[] = [
  // Week 1: Analysis & Setup
  { week: 1, title: 'Run neighbor analysis', description: 'Scan artist and analyze neighbor intelligence to identify discovery context.', category: 'analysis' },
  { week: 1, title: 'Build container playlist', description: 'Create a container playlist mixing own tracks with slightly-larger neighbors.', category: 'playlist-setup' },
  { week: 1, title: 'Take initial health snapshot', description: 'Record baseline health score and follower count.', category: 'readiness-check' },

  // Week 2: Readiness
  { week: 2, title: 'Review container health', description: 'Check health score and address any warnings.', category: 'readiness-check' },
  { week: 2, title: 'Record baseline metrics', description: 'Note current monthly listeners, followers, and playlist reach.', category: 'baseline-reset' },

  // Week 3: Release + Monitor
  { week: 3, title: 'Release readiness check', description: 'Run release readiness scoring to confirm campaign is ready.', category: 'readiness-check' },
  { week: 3, title: 'Monitor release placement', description: 'Track where release appears in algorithmic playlists.', category: 'release-monitoring' },
  { week: 3, title: 'Refresh playlist tracks', description: 'Replace underperforming tracks to maintain health.', category: 'refresh' },

  // Week 4: Momentum
  { week: 4, title: 'Track momentum metrics', description: 'Record listener growth and engagement changes since release.', category: 'momentum' },
  { week: 4, title: 'Detect early decay signals', description: 'Check for drops in save rate or playlist additions.', category: 'decay-detection' },

  // Week 5: Mid-cycle refresh
  { week: 5, title: 'Mid-cycle playlist refresh', description: 'Swap stale tracks and add fresh neighbor content.', category: 'refresh' },
  { week: 5, title: 'Take health snapshot', description: 'Record mid-cycle health score and compare to baseline.', category: 'readiness-check' },

  // Week 6: Sustained momentum
  { week: 6, title: 'Monitor sustained momentum', description: 'Check if growth trajectory is maintained.', category: 'momentum' },
  { week: 6, title: 'Detect decay patterns', description: 'Identify if algorithmic placement is declining.', category: 'decay-detection' },

  // Week 7: Late-cycle refresh
  { week: 7, title: 'Final playlist refresh', description: 'Last track refresh to maximize remaining momentum.', category: 'refresh' },
  { week: 7, title: 'Record late-cycle metrics', description: 'Capture metrics before campaign wind-down.', category: 'momentum' },

  // Week 8: Wrap-up
  { week: 8, title: 'Final health snapshot', description: 'Record final health score and follower count.', category: 'readiness-check' },
  { week: 8, title: 'Campaign review', description: 'Compare final metrics to baseline. Document learnings.', category: 'baseline-reset' },
];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Creates a new campaign in draft status.
 */
export async function createCampaign(
  userId: string,
  artistId: string,
  name: string,
): Promise<{ id: string }> {
  const artist = await db.artist.findUnique({ where: { id: artistId } });
  if (!artist) throw new Error('Artist not found. Scan the artist first.');

  const existing = await db.campaign.findFirst({
    where: { userId, artistId, status: { in: ['draft', 'active', 'paused'] } },
  });
  if (existing) {
    throw new Error(`An active or draft campaign already exists for this artist (${existing.name}).`);
  }

  const campaign = await db.campaign.create({
    data: { userId, artistId, name },
  });

  return { id: campaign.id };
}

/**
 * Activates a draft campaign: generates tasks for all 8 weeks and sets week 1.
 */
export async function activateCampaign(campaignId: string): Promise<void> {
  const startDate = new Date();

  await db.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) throw new Error('Campaign not found.');
    if (campaign.status !== 'draft') {
      throw new Error(`Cannot activate campaign in "${campaign.status}" status.`);
    }

    // Generate tasks for all 8 weeks
    const tasks = TASK_TEMPLATES.map((template) => {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + template.week * 7);

      return {
        campaignId,
        week: template.week,
        title: template.title,
        description: template.description,
        category: template.category,
        dueDate,
      };
    });

    await tx.campaignTask.createMany({ data: tasks });
    await tx.campaign.update({
      where: { id: campaignId },
      data: { status: 'active', currentWeek: 1, startDate },
    });
  });
}

/**
 * Advances the campaign to the next week.
 */
export async function advanceWeek(campaignId: string): Promise<{ newWeek: number; completed: boolean }> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });

  if (!campaign) throw new Error('Campaign not found.');
  if (campaign.status !== 'active') {
    throw new Error(`Cannot advance week for campaign in "${campaign.status}" status.`);
  }

  const newWeek = campaign.currentWeek + 1;

  if (newWeek > RELEASE_CYCLE_WEEKS) {
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: 'completed', currentWeek: RELEASE_CYCLE_WEEKS, endDate: new Date() },
    });
    return { newWeek: RELEASE_CYCLE_WEEKS, completed: true };
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: { currentWeek: newWeek },
  });

  return { newWeek, completed: false };
}

/**
 * Pauses or resumes a campaign.
 */
export async function togglePause(campaignId: string): Promise<{ status: string }> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found.');

  if (campaign.status === 'active') {
    await db.campaign.update({ where: { id: campaignId }, data: { status: 'paused' } });
    return { status: 'paused' };
  } else if (campaign.status === 'paused') {
    await db.campaign.update({ where: { id: campaignId }, data: { status: 'active' } });
    return { status: 'active' };
  }

  throw new Error(`Cannot toggle pause for campaign in "${campaign.status}" status.`);
}

/**
 * Updates a task's status.
 */
export async function updateTaskStatus(
  campaignId: string,
  taskId: string,
  status: 'pending' | 'in-progress' | 'completed' | 'skipped',
): Promise<void> {
  const task = await db.campaignTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found.');
  if (task.campaignId !== campaignId) {
    throw new Error('Task does not belong to this campaign.');
  }

  await db.campaignTask.update({
    where: { id: taskId },
    data: { status },
  });
}

/**
 * Gets a campaign with all related data.
 */
export async function getCampaign(campaignId: string) {
  return db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      artist: true,
      playlist: true,
      tasks: { orderBy: [{ week: 'asc' }, { createdAt: 'asc' }] },
      recommendations: { where: { dismissed: false }, orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
}

/**
 * Lists campaigns for a user.
 */
export async function listCampaigns(userId: string) {
  return db.campaign.findMany({
    where: { userId },
    include: {
      artist: true,
      tasks: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Computes and stores the release readiness score for a campaign.
 */
export async function computeReleaseReadiness(campaignId: string): Promise<{
  score: number;
  dimensions: Record<string, number>;
  blockers: string[];
}> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      tasks: true,
      playlist: true,
      manualMetrics: true,
    },
  });

  if (!campaign) throw new Error('Campaign not found.');

  // Task completion rate
  const totalTasks = campaign.tasks.length;
  const completedTasks = campaign.tasks.filter((t) => t.status === 'completed').length;
  const taskCompletionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

  // Container health
  const containerHealth = campaign.playlist?.healthScore ?? 0;

  // Placement readiness: based on playlist existence and health
  const placementReadiness = campaign.playlist
    ? Math.min(1, (containerHealth / 100) * 1.2)
    : 0;

  // Operations completeness: tasks in current + previous weeks
  const weekTasks = campaign.tasks.filter((t) => t.week <= campaign.currentWeek);
  const weekCompleted = weekTasks.filter((t) => t.status === 'completed' || t.status === 'skipped').length;
  const operationsCompleteness = weekTasks.length > 0 ? weekCompleted / weekTasks.length : 0;

  // Metrics completeness
  const expectedMetrics = campaign.currentWeek * 2; // ~2 metrics per week
  const metricsCompleteness = expectedMetrics > 0
    ? Math.min(1, campaign.manualMetrics.length / expectedMetrics)
    : 0;

  const input = {
    container_health: containerHealth,
    task_completion_rate: taskCompletionRate,
    placement_readiness: placementReadiness,
    operations_completeness: operationsCompleteness,
    metrics_completeness: metricsCompleteness,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCORING_TIMEOUT_MS);

    try {
      const response = await fetch(`${SCORING_SERVICE_URL}/api/v1/release-readiness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Scoring service error: ${response.status}`);
      }

      const result = await response.json();

      await db.campaign.update({
        where: { id: campaignId },
        data: { releaseReadinessScore: result.score },
      });

      return result;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error('Release readiness scoring failed:', error);
    throw new Error('Failed to compute release readiness score.');
  }
}

/**
 * Links a playlist to a campaign.
 */
export async function linkPlaylistToCampaign(
  campaignId: string,
  playlistId: string,
): Promise<void> {
  const playlist = await db.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist) throw new Error('Playlist not found.');
  if (playlist.campaignId && playlist.campaignId !== campaignId) {
    throw new Error('Playlist is already linked to another campaign.');
  }

  await db.playlist.update({
    where: { id: playlistId },
    data: { campaignId },
  });
}
