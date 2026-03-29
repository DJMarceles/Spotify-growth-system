import { db } from '../db';

const CONTAINER_MIN_TRACKS = 40;
const CONTAINER_MAX_TRACKS = 65;

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecommendationInput {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  actionable: boolean;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generates recommendations for a campaign by analyzing its current state.
 * Deletes old non-dismissed recommendations and creates fresh ones.
 */
export async function generateRecommendations(campaignId: string): Promise<{ count: number }> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      artist: {
        include: {
          neighborsAsSource: true,
        },
      },
      playlist: {
        include: {
          items: true,
          snapshots: { orderBy: { snapshotDate: 'desc' }, take: 2 },
        },
      },
      tasks: true,
      manualMetrics: true,
      recommendations: true,
    },
  });

  if (!campaign) throw new Error('Campaign not found.');

  const recs: RecommendationInput[] = [];

  // ── 1. Closed-loop risk ──────────────────────────────────────────────────
  analyzeClosedLoopRisk(campaign, recs);

  // ── 2. Container playlist health ─────────────────────────────────────────
  analyzePlaylistHealth(campaign, recs);

  // ── 3. Track mix quality ─────────────────────────────────────────────────
  analyzeTrackMix(campaign, recs);

  // ── 4. Task completion ───────────────────────────────────────────────────
  analyzeTaskCompletion(campaign, recs);

  // ── 5. Metrics tracking ──────────────────────────────────────────────────
  analyzeMetrics(campaign, recs);

  // ── 6. Stale playlist detection ──────────────────────────────────────────
  analyzeStaleness(campaign, recs);

  // ── 7. Neighbor quality ──────────────────────────────────────────────────
  analyzeNeighborQuality(campaign, recs);

  // Delete old non-dismissed recommendations, then insert new ones
  await db.$transaction([
    db.recommendation.deleteMany({
      where: { campaignId, dismissed: false },
    }),
    ...recs.map((rec) =>
      db.recommendation.create({
        data: { campaignId, ...rec },
      }),
    ),
  ]);

  return { count: recs.length };
}

/**
 * Dismisses a recommendation.
 */
export async function dismissRecommendation(recommendationId: string): Promise<void> {
  await db.recommendation.update({
    where: { id: recommendationId },
    data: { dismissed: true },
  });
}

/**
 * Lists active (non-dismissed) recommendations for a campaign.
 */
export async function listRecommendations(campaignId: string) {
  return db.recommendation.findMany({
    where: { campaignId, dismissed: false },
    orderBy: [
      { severity: 'asc' }, // critical first (alphabetical: critical < info < warning)
      { createdAt: 'desc' },
    ],
  });
}

// ─── Analysis Functions ─────────────────────────────────────────────────────

function _campaignQuery() {
  return db.campaign.findUnique({
    where: { id: '' },
    include: {
      artist: { include: { neighborsAsSource: true } },
      playlist: { include: { items: true, snapshots: { orderBy: { snapshotDate: 'desc' as const }, take: 2 } } },
      tasks: true,
      manualMetrics: true,
      recommendations: true,
    },
  });
}
type CampaignWithRelations = NonNullable<Awaited<ReturnType<typeof _campaignQuery>>>;

function analyzeClosedLoopRisk(campaign: CampaignWithRelations, recs: RecommendationInput[]) {
  const neighbors = campaign.artist.neighborsAsSource;
  if (neighbors.length === 0) return;

  const highRiskCount = neighbors.filter((n) => n.closedLoopRisk === 'high').length;
  const highRiskRatio = highRiskCount / neighbors.length;

  if (highRiskRatio > 0.5) {
    recs.push({
      type: 'closed-loop-risk',
      severity: 'critical',
      title: 'High closed-loop risk detected',
      description: `${highRiskCount} of ${neighbors.length} neighbors have high closed-loop risk. Your discovery context may be too insular — consider broadening your neighbor mix.`,
      actionable: true,
    });
  } else if (highRiskRatio > 0.3) {
    recs.push({
      type: 'closed-loop-risk',
      severity: 'warning',
      title: 'Elevated closed-loop risk',
      description: `${highRiskCount} of ${neighbors.length} neighbors have high closed-loop risk. Monitor your algorithmic placement diversity.`,
      actionable: true,
    });
  }
}

function analyzePlaylistHealth(campaign: CampaignWithRelations, recs: RecommendationInput[]) {
  const playlist = campaign.playlist;
  if (!playlist) {
    if (campaign.status === 'active' && campaign.currentWeek >= 2) {
      recs.push({
        type: 'low-container-health',
        severity: 'critical',
        title: 'No container playlist linked',
        description: 'Your campaign is active but has no container playlist. Build and link one to maximize release reach.',
        actionable: true,
      });
    }
    return;
  }

  const healthScore = playlist.healthScore;
  if (healthScore !== null) {
    if (healthScore < 30) {
      recs.push({
        type: 'low-container-health',
        severity: 'critical',
        title: 'Container health is critically low',
        description: `Health score is ${Math.round(healthScore)}/100. Refresh stale tracks and rebalance the mix to improve algorithmic signal.`,
        actionable: true,
      });
    } else if (healthScore < 50) {
      recs.push({
        type: 'low-container-health',
        severity: 'warning',
        title: 'Container health needs attention',
        description: `Health score is ${Math.round(healthScore)}/100. Consider refreshing underperforming tracks.`,
        actionable: true,
      });
    }
  }

  // Check health trend (declining)
  const snapshots = playlist.snapshots;
  if (snapshots.length >= 2 && snapshots[0].healthScore !== null && snapshots[1].healthScore !== null) {
    const decline = snapshots[1].healthScore - snapshots[0].healthScore;
    if (decline > 10) {
      recs.push({
        type: 'low-container-health',
        severity: 'warning',
        title: 'Container health is declining',
        description: `Health dropped by ${Math.round(decline)} points since the last snapshot. Consider a playlist refresh.`,
        actionable: true,
      });
    }
  }
}

function analyzeTrackMix(campaign: CampaignWithRelations, recs: RecommendationInput[]) {
  const playlist = campaign.playlist;
  if (!playlist || playlist.items.length === 0) return;

  const totalTracks = playlist.items.length;
  const ownTracks = playlist.items.filter((item) => item.source === 'own').length;
  const ownRatio = ownTracks / totalTracks;

  if (ownRatio > 0.5) {
    recs.push({
      type: 'too-many-own-tracks',
      severity: 'critical',
      title: 'Too many own tracks in container',
      description: `${Math.round(ownRatio * 100)}% of playlist tracks are your own (should be <50%). This creates a closed signal that hurts algorithmic discovery.`,
      actionable: true,
    });
  } else if (ownRatio > 0.4) {
    recs.push({
      type: 'too-many-own-tracks',
      severity: 'warning',
      title: 'Own track ratio is high',
      description: `${Math.round(ownRatio * 100)}% of playlist tracks are your own. Aim for ~35% for optimal discovery context.`,
      actionable: true,
    });
  }

  if (totalTracks < CONTAINER_MIN_TRACKS) {
    recs.push({
      type: 'sequencing-issue',
      severity: 'warning',
      title: 'Container playlist is too short',
      description: `Playlist has ${totalTracks} tracks (minimum ${CONTAINER_MIN_TRACKS}). Add more neighbor tracks to strengthen the container.`,
      actionable: true,
    });
  } else if (totalTracks > CONTAINER_MAX_TRACKS) {
    recs.push({
      type: 'sequencing-issue',
      severity: 'info',
      title: 'Container playlist is long',
      description: `Playlist has ${totalTracks} tracks (recommended max ${CONTAINER_MAX_TRACKS}). Consider trimming lower-performing tracks.`,
      actionable: true,
    });
  }

  // Check for sequencing issues (consecutive own tracks)
  const sortedItems = [...playlist.items].sort((a, b) => a.position - b.position);
  let maxConsecutiveOwn = 0;
  let currentConsecutive = 0;
  for (const item of sortedItems) {
    if (item.source === 'own') {
      currentConsecutive++;
      maxConsecutiveOwn = Math.max(maxConsecutiveOwn, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  if (maxConsecutiveOwn >= 3) {
    recs.push({
      type: 'sequencing-issue',
      severity: 'warning',
      title: 'Poor track alternation',
      description: `Found ${maxConsecutiveOwn} consecutive own tracks. Alternate own and neighbor tracks for better algorithmic flow.`,
      actionable: true,
    });
  }
}

function analyzeTaskCompletion(campaign: CampaignWithRelations, recs: RecommendationInput[]) {
  if (campaign.status !== 'active') return;

  // Check tasks for current and past weeks
  const dueTasks = campaign.tasks.filter((t) => t.week <= campaign.currentWeek);
  const pendingTasks = dueTasks.filter((t) => t.status === 'pending');
  const pendingRate = dueTasks.length > 0 ? pendingTasks.length / dueTasks.length : 0;

  if (pendingRate > 0.5) {
    recs.push({
      type: 'incomplete-cycle',
      severity: 'critical',
      title: 'Many tasks are overdue',
      description: `${pendingTasks.length} of ${dueTasks.length} tasks for weeks 1–${campaign.currentWeek} are still pending. Complete them to stay on track.`,
      actionable: true,
    });
  } else if (pendingRate > 0.25) {
    recs.push({
      type: 'incomplete-cycle',
      severity: 'warning',
      title: 'Some tasks are falling behind',
      description: `${pendingTasks.length} tasks from previous weeks are still pending. Review and complete or skip them.`,
      actionable: true,
    });
  }
}

function analyzeMetrics(campaign: CampaignWithRelations, recs: RecommendationInput[]) {
  if (campaign.status !== 'active') return;

  // Check if metrics are being tracked
  if (campaign.currentWeek >= 3 && campaign.manualMetrics.length === 0) {
    recs.push({
      type: 'missing-metrics',
      severity: 'warning',
      title: 'No metrics recorded yet',
      description: 'Start tracking monthly listeners, followers, and save rate to measure campaign impact.',
      actionable: true,
    });
  } else if (campaign.currentWeek >= 2) {
    // Check if recent weeks have metrics
    const recentMetrics = campaign.manualMetrics.filter(
      (m) => m.week >= campaign.currentWeek - 1,
    );
    if (recentMetrics.length === 0 && campaign.manualMetrics.length > 0) {
      recs.push({
        type: 'missing-metrics',
        severity: 'info',
        title: 'Metrics not updated recently',
        description: `No metrics recorded for week ${campaign.currentWeek}. Keep tracking to monitor campaign progress.`,
        actionable: true,
      });
    }
  }

  // Check for declining metrics
  if (campaign.manualMetrics.length >= 4) {
    const listenerMetrics = campaign.manualMetrics
      .filter((m) => m.metricType === 'monthly-listeners')
      .sort((a, b) => a.week - b.week);

    if (listenerMetrics.length >= 2) {
      const latest = listenerMetrics[listenerMetrics.length - 1];
      const previous = listenerMetrics[listenerMetrics.length - 2];
      if (latest.value < previous.value * 0.9) {
        recs.push({
          type: 'missing-metrics',
          severity: 'warning',
          title: 'Monthly listeners declining',
          description: `Listeners dropped from ${previous.value.toLocaleString()} to ${latest.value.toLocaleString()} (${Math.round((1 - latest.value / previous.value) * 100)}% decline). Consider refreshing your container playlist.`,
          actionable: true,
        });
      }
    }
  }
}

function analyzeStaleness(campaign: CampaignWithRelations, recs: RecommendationInput[]) {
  const playlist = campaign.playlist;
  if (!playlist) return;

  const lastRefreshed = playlist.lastRefreshedAt;
  if (!lastRefreshed) {
    if (campaign.status === 'active' && campaign.currentWeek >= 3) {
      recs.push({
        type: 'stale-playlist',
        severity: 'warning',
        title: 'Playlist has never been refreshed',
        description: 'Run a playlist refresh to replace underperforming tracks and keep the container fresh.',
        actionable: true,
      });
    }
    return;
  }

  const daysSinceRefresh = Math.floor(
    (Date.now() - lastRefreshed.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceRefresh > 14) {
    recs.push({
      type: 'stale-playlist',
      severity: 'warning',
      title: 'Playlist is stale',
      description: `Last refreshed ${daysSinceRefresh} days ago. Refresh to replace low-performing tracks and maintain algorithmic signal.`,
      actionable: true,
    });
  }
}

function analyzeNeighborQuality(campaign: CampaignWithRelations, recs: RecommendationInput[]) {
  const neighbors = campaign.artist.neighborsAsSource;
  if (neighbors.length === 0) {
    if (campaign.status !== 'draft') {
      recs.push({
        type: 'weak-neighbor-mix',
        severity: 'warning',
        title: 'No neighbor analysis found',
        description: 'Run a neighbor intelligence analysis to identify the best artists for your container playlist.',
        actionable: true,
      });
    }
    return;
  }

  // Check for weak average adjacency
  const avgAdjacency = neighbors.reduce((sum, n) => sum + n.adjacencyScore, 0) / neighbors.length;
  if (avgAdjacency < 40) {
    recs.push({
      type: 'weak-neighbor-mix',
      severity: 'warning',
      title: 'Weak neighbor adjacency scores',
      description: `Average adjacency score is ${Math.round(avgAdjacency)}/100. Consider rescanning to find better-matched neighbors.`,
      actionable: true,
    });
  }

  // Check for too few neighbors
  if (neighbors.length < 5) {
    recs.push({
      type: 'weak-neighbor-mix',
      severity: 'info',
      title: 'Limited neighbor pool',
      description: `Only ${neighbors.length} neighbors analyzed. A broader analysis may reveal better container candidates.`,
      actionable: true,
    });
  }
}
