'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PlaylistOption {
  id: string;
  name: string;
  healthScore: number | null;
}

interface LinkPlaylistProps {
  campaignId: string;
  artistId: string;
}

export function LinkPlaylist({ campaignId, artistId }: LinkPlaylistProps) {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/playlists')
      .then((res) => res.json())
      .then((data) => {
        const available = (data as PlaylistOption[]).filter(
          (p: PlaylistOption & { campaignId?: string | null }) => !p.campaignId,
        );
        setPlaylists(available);
      })
      .catch(() => setError('Failed to load playlists'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleLink = async (playlistId: string) => {
    setLinking(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/link-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId }),
      });
      if (!res.ok) {
        let message = 'Failed to link playlist';
        try { const data = await res.json(); message = data.error ?? message; } catch { /* */ }
        throw new Error(message);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link playlist');
    } finally {
      setLinking(false);
    }
  };

  if (!open) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">No container playlist linked.</p>
        <button
          onClick={() => setOpen(true)}
          className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Link Playlist
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Select a playlist to link</p>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : playlists.length > 0 ? (
        <div className="space-y-1">
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => handleLink(p.id)}
              disabled={linking}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <span className="font-medium text-foreground">{p.name}</span>
              {p.healthScore !== null && (
                <span className="text-xs text-muted-foreground">Health: {Math.round(p.healthScore)}</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="py-2 text-center text-sm text-muted-foreground">
          No available playlists. Build one from the artist page first.
        </p>
      )}
    </div>
  );
}
