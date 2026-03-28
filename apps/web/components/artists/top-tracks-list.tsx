interface Track {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  durationMs: number;
  popularity: number;
  releaseDate: string;
}

interface TopTracksListProps {
  tracks: Track[];
}

export function TopTracksList({ tracks }: TopTracksListProps) {
  if (tracks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No top tracks found.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 pr-4">#</th>
            <th className="pb-2 pr-4">Track</th>
            <th className="pb-2 pr-4">Album</th>
            <th className="pb-2 pr-4">Duration</th>
            <th className="pb-2 pr-4">Pop</th>
            <th className="pb-2">Released</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track, index) => (
            <tr key={track.id} className="border-b border-border last:border-b-0">
              <td className="py-2.5 pr-4 text-muted-foreground">{index + 1}</td>
              <td className="py-2.5 pr-4 font-medium text-foreground">{track.name}</td>
              <td className="py-2.5 pr-4 text-muted-foreground">{track.albumName}</td>
              <td className="py-2.5 pr-4 text-muted-foreground">{formatDuration(track.durationMs)}</td>
              <td className="py-2.5 pr-4">
                <PopularityBar value={track.popularity} />
              </td>
              <td className="py-2.5 text-muted-foreground">{track.releaseDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PopularityBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
