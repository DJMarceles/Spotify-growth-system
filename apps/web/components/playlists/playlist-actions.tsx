'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PlaylistActionsProps {
  playlistId: string;
  hasSpotifyId: boolean;
}

export function PlaylistActions({ playlistId, hasSpotifyId }: PlaylistActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<'refresh' | 'snapshot' | 'sync' | null>(null);
  const [result, setResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleAction = async (action: 'refresh' | 'snapshot' | 'sync') => {
    setLoading(action);
    setResult(null);

    try {
      const res = await fetch(`/api/playlists/${playlistId}/${action}`, {
        method: action === 'snapshot' ? 'POST' : 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `${action} failed`);
      }

      const data = await res.json();

      switch (action) {
        case 'refresh':
          setResult({
            message: `Refreshed: ${data.tracksRemoved?.length ?? 0} removed, ${data.tracksAdded?.length ?? 0} added.${data.warnings?.length ? ' ' + data.warnings.join(' ') : ''}`,
            type: 'success',
          });
          break;
        case 'snapshot':
          setResult({
            message: `Snapshot taken. Health: ${data.healthScore !== null ? Math.round(data.healthScore) : '—'}, Followers: ${data.followerCount}`,
            type: 'success',
          });
          break;
        case 'sync':
          setResult({
            message: data.action === 'no-change' ? 'Already in sync.' : `Synced ${data.tracksInDb} tracks to Spotify.`,
            type: 'success',
          });
          break;
      }

      router.refresh();
    } catch (err) {
      setResult({
        message: err instanceof Error ? err.message : `${action} failed`,
        type: 'error',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <ActionButton
          label="Take Snapshot"
          loadingLabel="Taking snapshot..."
          onClick={() => handleAction('snapshot')}
          isLoading={loading === 'snapshot'}
          disabled={loading !== null}
        />
        <ActionButton
          label="Refresh Tracks"
          loadingLabel="Refreshing..."
          onClick={() => handleAction('refresh')}
          isLoading={loading === 'refresh'}
          disabled={loading !== null}
        />
        {hasSpotifyId && (
          <ActionButton
            label="Sync to Spotify"
            loadingLabel="Syncing..."
            onClick={() => handleAction('sync')}
            isLoading={loading === 'sync'}
            disabled={loading !== null}
            variant="outline"
          />
        )}
      </div>

      {result && (
        <p
          className={`text-sm ${
            result.type === 'success'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

function ActionButton({
  label,
  loadingLabel,
  onClick,
  isLoading,
  disabled,
  variant = 'default',
}: {
  label: string;
  loadingLabel: string;
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
  variant?: 'default' | 'outline';
}) {
  const baseClass =
    variant === 'outline'
      ? 'border border-border text-foreground hover:bg-muted'
      : 'bg-primary text-primary-foreground hover:bg-primary/90';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${baseClass}`}
    >
      {isLoading && (
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {isLoading ? loadingLabel : label}
    </button>
  );
}
