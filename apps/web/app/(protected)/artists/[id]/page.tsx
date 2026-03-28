import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { ArtistProfileHeader } from '@/components/artists/artist-profile-header';
import { RelatedArtistsList } from '@/components/artists/related-artists-list';
import { TopTracksList } from '@/components/artists/top-tracks-list';
import { NeighborSummary } from '@/components/artists/neighbor-summary';
import { NeighborScoreCard } from '@/components/artists/neighbor-score-card';
import { AnalyzeButton } from '@/components/artists/analyze-button';
import { BuildPlaylistButton } from '@/components/playlists/build-playlist-button';

interface ArtistDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ArtistDetailPage({ params }: ArtistDetailPageProps) {
  const { id } = await params;

  const artist = await db.artist.findUnique({
    where: { id },
    include: {
      tracks: {
        orderBy: { popularity: 'desc' },
        take: 10,
      },
      relatedFrom: {
        include: { relatedArtist: true },
        orderBy: { relatedArtist: { followerCount: 'desc' } },
      },
      neighborsAsSource: {
        include: { neighborArtist: true },
        orderBy: { adjacencyScore: 'desc' },
      },
    },
  });

  if (!artist) {
    notFound();
  }

  const relatedArtists = artist.relatedFrom.map((edge) => edge.relatedArtist);
  const neighbors = artist.neighborsAsSource;
  const hasAnalysis = neighbors.length > 0;

  // Compute summary from scored neighbors
  let overallRisk: 'low' | 'medium' | 'high' = 'high';
  let summary = {
    totalAnalyzed: 0,
    slightlyLarger: 0,
    similar: 0,
    smaller: 0,
    muchLarger: 0,
    averageAdjacencyScore: 0,
  };

  if (hasAnalysis) {
    const buckets = { smaller: 0, similar: 0, 'slightly-larger': 0, 'much-larger': 0 };
    let totalScore = 0;
    let highRisk = 0;
    let mediumRisk = 0;

    for (const n of neighbors) {
      const b = n.sizeBucket as keyof typeof buckets;
      if (b in buckets) buckets[b]++;
      totalScore += n.adjacencyScore;
      if (n.closedLoopRisk === 'high') highRisk++;
      else if (n.closedLoopRisk === 'medium') mediumRisk++;
    }

    const avgScore = totalScore / neighbors.length;
    const riskRatio = (highRisk + mediumRisk) / neighbors.length;
    overallRisk =
      riskRatio >= 0.7 || highRisk / neighbors.length >= 0.5
        ? 'high'
        : riskRatio >= 0.4
          ? 'medium'
          : 'low';

    summary = {
      totalAnalyzed: neighbors.length,
      slightlyLarger: buckets['slightly-larger'],
      similar: buckets.similar,
      smaller: buckets.smaller,
      muchLarger: buckets['much-larger'],
      averageAdjacencyScore: Math.round(avgScore * 10) / 10,
    };
  }

  return (
    <div className="space-y-10">
      <ArtistProfileHeader
        name={artist.name}
        genres={artist.genres}
        followerCount={artist.followerCount}
        popularity={artist.popularity}
        imageUrl={artist.imageUrl}
        spotifyUrl={artist.spotifyUrl}
        trackCount={artist.tracks.length}
        relatedCount={relatedArtists.length}
      />

      {/* Neighbor Intelligence Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Neighbor Intelligence</h2>
          <AnalyzeButton artistId={artist.id} hasExistingAnalysis={hasAnalysis} />
        </div>

        {hasAnalysis ? (
          <>
            <NeighborSummary
              overallRisk={overallRisk}
              totalAnalyzed={summary.totalAnalyzed}
              slightlyLarger={summary.slightlyLarger}
              similar={summary.similar}
              smaller={summary.smaller}
              muchLarger={summary.muchLarger}
              averageScore={summary.averageAdjacencyScore}
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {neighbors.map((neighbor) => (
                <NeighborScoreCard key={neighbor.id} neighbor={neighbor} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              No neighbor analysis yet. Click &quot;Analyze Neighbors&quot; to score related artists
              and detect closed-loop risk.
            </p>
          </div>
        )}
      </section>

      {/* Container Playlist Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Container Playlist</h2>
        <BuildPlaylistButton artistId={artist.id} hasNeighborAnalysis={hasAnalysis} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Top Tracks</h2>
        <TopTracksList tracks={artist.tracks} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Related Artists</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Artists from Spotify&apos;s related graph. Size labels show follower ratio relative to{' '}
          {artist.name}.
        </p>
        <RelatedArtistsList
          artists={relatedArtists}
          sourceFollowerCount={artist.followerCount}
        />
      </section>
    </div>
  );
}
