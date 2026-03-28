'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArtistSearch } from '@/components/artists/artist-search';
import { ArtistCard } from '@/components/artists/artist-card';

interface ScannedArtist {
  id: string;
  spotifyId: string;
  name: string;
  genres: string[];
  followerCount: number;
  popularity: number;
  imageUrl: string | null;
  _count: {
    tracks: number;
    neighborsAsSource: number;
  };
}

export default function ArtistsPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<ScannedArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const loadArtists = useCallback(async () => {
    try {
      const res = await fetch('/api/artists');
      if (res.ok) {
        const data = await res.json();
        setArtists(data.artists);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArtists();
  }, [loadArtists]);

  const handleScan = async (spotifyId: string) => {
    setIsScanning(true);
    setScanError(null);

    try {
      const res = await fetch('/api/artists/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyArtistId: spotifyId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Scan failed');
      }

      const result = await res.json();
      router.push(`/artists/${result.artist.id}`);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Artist Scanner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search for an artist to analyze their discovery environment, related artists, and top
          tracks.
        </p>
      </div>

      <ArtistSearch onScan={handleScan} isScanning={isScanning} />

      {isScanning && (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            Scanning artist — fetching profile, related artists, and top tracks...
          </p>
        </div>
      )}

      {scanError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {scanError}
        </div>
      )}

      {!isLoading && artists.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Previously Scanned</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => (
              <ArtistCard
                key={artist.id}
                id={artist.id}
                name={artist.name}
                genres={artist.genres}
                followerCount={artist.followerCount}
                popularity={artist.popularity}
                imageUrl={artist.imageUrl}
                trackCount={artist._count.tracks}
                neighborCount={artist._count.neighborsAsSource}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && artists.length === 0 && !isScanning && (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            No artists scanned yet. Search above to get started.
          </p>
        </div>
      )}
    </div>
  );
}
