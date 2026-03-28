export interface Campaign {
  id: string;
  userId: string;
  artistId: string;
  playlistId: string | null;
  name: string;
  status: CampaignStatus;
  currentWeek: number;
  releaseReadinessScore: number | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface CampaignTask {
  id: string;
  campaignId: string;
  week: number;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  dueDate: Date | null;
}

export type TaskCategory =
  | 'analysis'
  | 'playlist-setup'
  | 'readiness-check'
  | 'release-monitoring'
  | 'momentum'
  | 'refresh'
  | 'decay-detection'
  | 'baseline-reset';

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';

export interface ManualMetric {
  id: string;
  campaignId: string;
  week: number;
  metricType: string;
  value: number;
  notes: string | null;
  recordedAt: Date;
}

export interface Experiment {
  id: string;
  campaignId: string;
  name: string;
  hypothesis: string;
  status: 'planned' | 'running' | 'completed';
  outcome: string | null;
  createdAt: Date;
}
