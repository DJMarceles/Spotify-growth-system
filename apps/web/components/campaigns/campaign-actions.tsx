'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CampaignActionsProps {
  campaignId: string;
  status: string;
  currentWeek: number;
}

export function CampaignActions({ campaignId, status, currentWeek }: CampaignActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/${action}`, { method: 'POST' });
      if (!res.ok) {
        let message = `${action} failed`;
        try {
          const data = await res.json();
          message = data.error ?? message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === 'draft' && (
          <ActionBtn label="Activate Campaign" loading={loading === 'activate'} disabled={loading !== null} onClick={() => handleAction('activate')} />
        )}
        {status === 'active' && (
          <>
            <ActionBtn label="Advance Week" loading={loading === 'advance'} disabled={loading !== null} onClick={() => handleAction('advance')} />
            <ActionBtn label="Pause" loading={loading === 'pause'} disabled={loading !== null} onClick={() => handleAction('pause')} variant="outline" />
            <ActionBtn label="Check Readiness" loading={loading === 'readiness'} disabled={loading !== null} onClick={() => handleAction('readiness')} variant="outline" />
          </>
        )}
        {status === 'paused' && (
          <ActionBtn label="Resume" loading={loading === 'pause'} disabled={loading !== null} onClick={() => handleAction('pause')} />
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function ActionBtn({
  label, loading, disabled, onClick, variant = 'default',
}: {
  label: string; loading: boolean; disabled: boolean; onClick: () => void; variant?: 'default' | 'outline';
}) {
  const base = variant === 'outline'
    ? 'border border-border text-foreground hover:bg-muted'
    : 'bg-primary text-primary-foreground hover:bg-primary/90';

  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${base}`}>
      {loading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {label}
    </button>
  );
}
