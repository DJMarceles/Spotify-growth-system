'use client';

interface SpotifyConnectStatusProps {
  isConnected: boolean;
  displayName?: string | null;
  spotifyId?: string | null;
}

export function SpotifyConnectStatus({
  isConnected,
  displayName,
  spotifyId,
}: SpotifyConnectStatusProps) {
  if (!isConnected) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-yellow-500" />
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Spotify account not connected
          </p>
        </div>
        <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
          Your Spotify tokens may have expired. Sign out and sign in again to reconnect.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <p className="text-sm font-medium text-green-800 dark:text-green-200">
          Spotify connected
        </p>
      </div>
      {(displayName || spotifyId) && (
        <p className="mt-1 text-sm text-green-700 dark:text-green-300">
          {displayName ?? spotifyId}
        </p>
      )}
    </div>
  );
}
