'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AnalyzeButtonProps {
  artistId: string;
  hasExistingAnalysis: boolean;
  relatedArtistCount: number;
}

export function AnalyzeButton({ artistId, hasExistingAnalysis, relatedArtistCount }: AnalyzeButtonProps) {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAnalyze = relatedArtistCount > 0;

  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch(`/api/artists/${artistId}/analyze`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Analysis failed');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!canAnalyze) {
    return (
      <div className="text-right">
        <button
          disabled
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50 cursor-not-allowed"
        >
          Analyze Neighbors
        </button>
        <p className="mt-1 text-xs text-muted-foreground">
          No related artists found on Spotify. Try a more popular artist.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isAnalyzing ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            Analyzing...
          </>
        ) : hasExistingAnalysis ? (
          'Re-analyze Neighbors'
        ) : (
          'Analyze Neighbors'
        )}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
