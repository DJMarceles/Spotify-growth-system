'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface SearchResult {
  spotifyId: string;
  name: string;
  genres: string[];
  followerCount: number;
  popularity: number;
  imageUrl: string | null;
}

interface ArtistSearchProps {
  onScan: (spotifyId: string) => void;
  isScanning: boolean;
}

export function ArtistSearch({ onScan, isScanning }: ArtistSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const search = useCallback((q: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (q.trim().length < 2) {
      setResults([]);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/artists/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.artists);
        } else {
          setSearchError('Search failed. Please try again.');
        }
      } catch {
        setSearchError('Search failed. Check your connection.');
      } finally {
        setIsSearching(false);
      }
    }, 350);
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          placeholder="Search for an artist on Spotify..."
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={isScanning}
        />
        {isSearching && (
          <div className="absolute right-3 top-3.5">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        )}
      </div>

      {searchError && (
        <p className="text-sm text-red-600 dark:text-red-400">{searchError}</p>
      )}

      {results.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          {results.map((artist) => (
            <button
              key={artist.spotifyId}
              onClick={() => onScan(artist.spotifyId)}
              disabled={isScanning}
              className="flex w-full items-center gap-4 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted disabled:opacity-50"
            >
              {artist.imageUrl ? (
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-medium text-muted-foreground">
                  {artist.name[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{artist.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {artist.genres.length > 0 ? artist.genres.join(', ') : 'No genres listed'}
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{formatFollowers(artist.followerCount)}</p>
                <p>Pop: {artist.popularity}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M followers`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K followers`;
  return `${count} followers`;
}
