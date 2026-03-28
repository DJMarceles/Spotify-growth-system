export interface Recommendation {
  id: string;
  campaignId: string;
  type: RecommendationType;
  severity: RecommendationSeverity;
  title: string;
  description: string;
  actionable: boolean;
  dismissed: boolean;
  createdAt: Date;
}

export type RecommendationType =
  | 'weak-neighbor-mix'
  | 'too-many-own-tracks'
  | 'sequencing-issue'
  | 'closed-loop-risk'
  | 'incomplete-cycle'
  | 'low-container-health'
  | 'stale-playlist'
  | 'missing-metrics';

export type RecommendationSeverity = 'info' | 'warning' | 'critical';
