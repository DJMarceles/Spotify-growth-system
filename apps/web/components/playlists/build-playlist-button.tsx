'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ContainerProposal } from '@/lib/services/playlist-builder';
import { PlaylistProposalView } from './playlist-proposal-view';

interface BuildPlaylistButtonProps {
  artistId: string;
  hasNeighborAnalysis: boolean;
}

export function BuildPlaylistButton({ artistId, hasNeighborAnalysis }: BuildPlaylistButtonProps) {
  const router = useRouter();
  const [step, setStep] = useState<'idle' | 'proposing' | 'reviewing' | 'creating'>('idle');
  const [proposal, setProposal] = useState<ContainerProposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePropose = async () => {
    setStep('proposing');
    setError(null);

    try {
      const res = await fetch(`/api/artists/${artistId}/playlist/propose`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to generate proposal');
      }

      const data = await res.json();
      setProposal(data);
      setStep('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposal');
      setStep('idle');
    }
  };

  const handleCreate = async () => {
    setStep('creating');
    setError(null);

    try {
      const res = await fetch(`/api/artists/${artistId}/playlist/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishToSpotify: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create playlist');
      }

      const data = await res.json();
      router.push(`/playlists/${data.playlistId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playlist');
      setStep('reviewing');
    }
  };

  if (!hasNeighborAnalysis) {
    return (
      <p className="text-sm text-muted-foreground">
        Run neighbor analysis first to build a container playlist.
      </p>
    );
  }

  if ((step === 'reviewing' || step === 'creating') && proposal) {
    return (
      <>
        <PlaylistProposalView
          proposal={proposal}
          onConfirm={handleCreate}
          onCancel={() => {
            setStep('idle');
            setProposal(null);
          }}
          isCreating={step === 'creating'}
        />
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </>
    );
  }

  return (
    <div>
      <button
        onClick={handlePropose}
        disabled={step === 'proposing'}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {step === 'proposing' ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            Building Proposal...
          </>
        ) : (
          'Build Container Playlist'
        )}
      </button>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
