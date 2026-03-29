'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: string;
  outcome: string | null;
  createdAt: string;
}

interface ExperimentListProps {
  campaignId: string;
  experiments: Experiment[];
}

export function ExperimentList({ campaignId, experiments }: ExperimentListProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !hypothesis) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/experiments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, hypothesis }),
      });

      if (!res.ok) {
        let message = 'Failed to create experiment';
        try { const data = await res.json(); message = data.error ?? message; } catch { /* */ }
        throw new Error(message);
      }

      setName('');
      setHypothesis('');
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create experiment');
    } finally {
      setLoading(false);
    }
  };

  const [statusError, setStatusError] = useState<string | null>(null);

  const handleStatusUpdate = async (experimentId: string, status: string, outcome?: string) => {
    setStatusError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/experiments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experimentId, status, outcome }),
      });
      if (!res.ok) {
        let message = 'Failed to update experiment';
        try { const data = await res.json(); message = data.error ?? message; } catch { /* */ }
        throw new Error(message);
      }
      router.refresh();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update experiment');
    }
  };

  return (
    <div className="space-y-4">
      {statusError && (
        <p className="text-sm text-red-600 dark:text-red-400">{statusError}</p>
      )}

      {experiments.length > 0 ? (
        <div className="space-y-3">
          {experiments.map((exp) => (
            <ExperimentCard
              key={exp.id}
              experiment={exp}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No experiments yet.</p>
      )}

      {showForm ? (
        <form onSubmit={handleCreate} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Experiment name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder="Hypothesis: If we... then..."
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !name || !hypothesis}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
        >
          + New Experiment
        </button>
      )}
    </div>
  );
}

function ExperimentCard({
  experiment,
  onStatusUpdate,
}: {
  experiment: Experiment;
  onStatusUpdate: (id: string, status: string, outcome?: string) => void;
}) {
  const [showOutcome, setShowOutcome] = useState(false);
  const [outcome, setOutcome] = useState(experiment.outcome ?? '');

  const statusColors: Record<string, string> = {
    planned: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-foreground">{experiment.name}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{experiment.hypothesis}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[experiment.status] ?? statusColors.planned}`}>
          {experiment.status}
        </span>
      </div>

      {experiment.outcome && (
        <p className="mt-2 text-sm text-foreground">
          <span className="font-medium">Outcome:</span> {experiment.outcome}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {experiment.status === 'planned' && (
          <button
            onClick={() => onStatusUpdate(experiment.id, 'running')}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Start
          </button>
        )}
        {experiment.status === 'running' && (
          <>
            {showOutcome ? (
              <div className="flex w-full gap-2">
                <input
                  type="text"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="What happened?"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
                <button
                  onClick={() => { onStatusUpdate(experiment.id, 'completed', outcome); setShowOutcome(false); }}
                  className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                >
                  Complete
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowOutcome(true)}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                Record Outcome
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
