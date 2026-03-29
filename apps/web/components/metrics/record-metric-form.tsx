'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const METRIC_TYPES = [
  { key: 'monthly-listeners', label: 'Monthly Listeners' },
  { key: 'followers', label: 'Followers' },
  { key: 'playlist-reach', label: 'Playlist Reach' },
  { key: 'save-rate', label: 'Save Rate (%)' },
  { key: 'streams', label: 'Streams' },
];

interface RecordMetricFormProps {
  campaignId: string;
  currentWeek: number;
}

export function RecordMetricForm({ campaignId, currentWeek }: RecordMetricFormProps) {
  const router = useRouter();
  const [metricType, setMetricType] = useState(METRIC_TYPES[0].key);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [week, setWeek] = useState(currentWeek);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week, metricType, value: parseFloat(value), notes: notes || undefined }),
      });

      if (!res.ok) {
        let message = 'Failed to record metric';
        try { const data = await res.json(); message = data.error ?? message; } catch { /* */ }
        throw new Error(message);
      }

      setValue('');
      setNotes('');
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record metric');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Type</label>
          <select
            value={metricType}
            onChange={(e) => setMetricType(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {METRIC_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Week</label>
          <select
            value={week}
            onChange={(e) => setWeek(parseInt(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Week {i + 1}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Value</label>
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !value}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Recording...' : 'Record Metric'}
        </button>
        {success && <span className="text-sm text-green-600 dark:text-green-400">Recorded!</span>}
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  );
}
