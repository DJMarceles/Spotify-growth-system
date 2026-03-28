'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CreateCampaignFormProps {
  artists: Array<{ id: string; name: string; imageUrl: string | null }>;
}

export function CreateCampaignForm({ artists }: CreateCampaignFormProps) {
  const router = useRouter();
  const [artistId, setArtistId] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistId || !name) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, name }),
      });

      if (!res.ok) {
        let message = 'Failed to create campaign';
        try {
          const data = await res.json();
          message = data.error ?? message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }

      const data = await res.json();
      router.push(`/campaigns/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  if (artists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No scanned artists. Go to Artists and scan an artist first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Artist</label>
        <select
          value={artistId}
          onChange={(e) => {
            setArtistId(e.target.value);
            if (!name) {
              const artist = artists.find((a) => a.id === e.target.value);
              if (artist) setName(`${artist.name} — Release Cycle`);
            }
          }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">Select an artist...</option>
          {artists.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Campaign Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Spring Release 2026"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading || !artistId || !name}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
        Create Campaign
      </button>
    </form>
  );
}
