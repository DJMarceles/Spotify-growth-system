'use client';

import type { ContainerProposal, ProposedTrack } from '@/lib/services/playlist-builder';

interface PlaylistProposalViewProps {
  proposal: ContainerProposal;
  onConfirm: () => void;
  onCancel: () => void;
  isCreating: boolean;
}

export function PlaylistProposalView({
  proposal,
  onConfirm,
  onCancel,
  isCreating,
}: PlaylistProposalViewProps) {
  const { rationale, healthScore, warnings, tracks } = proposal;

  return (
    <div className="space-y-6">
      {/* Health Score + Rationale */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Container Proposal</h3>
          {healthScore !== null && <HealthScoreBadge score={healthScore} />}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Total Tracks" value={rationale.totalTracks} />
          <Stat label="Own Tracks" value={rationale.ownTrackCount} />
          <Stat label="Own Ratio" value={`${Math.round(rationale.ownTrackRatio * 100)}%`} />
          <Stat label="Neighbor Artists" value={rationale.neighborArtistCount} />
          <Stat label="Bigger Neighbors" value={`${Math.round(rationale.biggerNeighborRatio * 100)}%`} />
        </div>

        {warnings.length > 0 && (
          <div className="mt-4 space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-sm text-yellow-600 dark:text-yellow-400">
                {w}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Track List */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h4 className="font-medium text-foreground">Track Sequence</h4>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {tracks.map((track, i) => (
            <TrackRow key={track.trackId} track={track} index={i} />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onConfirm}
          disabled={isCreating}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isCreating ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Creating on Spotify...
            </>
          ) : (
            'Create on Spotify'
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={isCreating}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TrackRow({ track, index }: { track: ProposedTrack; index: number }) {
  const isOwn = track.source === 'own';

  return (
    <div className={`flex items-center gap-3 border-b border-border/50 px-4 py-2 last:border-0 ${isOwn ? 'bg-primary/5' : ''}`}>
      <span className="w-6 text-right text-xs text-muted-foreground">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{track.trackName}</p>
        <p className="truncate text-xs text-muted-foreground">{track.artistName}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          isOwn
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
            : 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
        }`}
      >
        {isOwn ? 'Own' : 'Neighbor'}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function HealthScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'text-green-600 border-green-600'
      : score >= 40
        ? 'text-yellow-600 border-yellow-600'
        : 'text-red-600 border-red-600';

  return (
    <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${color}`}>
      <span className="text-lg font-bold">{Math.round(score)}</span>
    </div>
  );
}
