'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Recommendation {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  actionable: boolean;
  dismissed: boolean;
}

interface RecommendationPanelProps {
  campaignId: string;
  recommendations: Recommendation[];
}

export function RecommendationPanel({ campaignId, recommendations }: RecommendationPanelProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/recommendations`, {
        method: 'POST',
      });
      if (!res.ok) {
        let message = 'Failed to generate recommendations';
        try { const data = await res.json(); message = data.error ?? message; } catch { /* */ }
        throw new Error(message);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations');
    } finally {
      setGenerating(false);
    }
  };

  const handleDismiss = async (recommendationId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/recommendations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId }),
      });
      if (!res.ok) {
        let message = 'Failed to dismiss';
        try { const data = await res.json(); message = data.error ?? message; } catch { /* */ }
        throw new Error(message);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss recommendation');
    }
  };

  const severityConfig: Record<string, { border: string; bg: string; badge: string }> = {
    critical: {
      border: 'border-red-300 dark:border-red-800',
      bg: 'bg-red-50 dark:bg-red-950',
      badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    },
    warning: {
      border: 'border-yellow-300 dark:border-yellow-800',
      bg: 'bg-yellow-50 dark:bg-yellow-950',
      badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    },
    info: {
      border: 'border-border',
      bg: 'bg-card',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {recommendations.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {generating ? 'Analyzing...' : recommendations.length > 0 ? 'Refresh Analysis' : 'Generate Recommendations'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {recommendations.length > 0 ? (
        <div className="space-y-2">
          {recommendations.map((rec) => {
            const config = severityConfig[rec.severity] ?? severityConfig.info;
            return (
              <div
                key={rec.id}
                className={`rounded-lg border px-4 py-3 ${config.border} ${config.bg}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${config.badge}`}>
                        {rec.severity}
                      </span>
                      <p className="text-sm font-medium text-foreground">{rec.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{rec.description}</p>
                  </div>
                  <button
                    onClick={() => handleDismiss(rec.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Dismiss"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No active recommendations. Click &quot;Refresh Analysis&quot; to scan for issues.
        </p>
      )}
    </div>
  );
}
