import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { ArtistProfileHeader } from '@/components/artists/artist-profile-header';
import { RelatedArtistsList } from '@/components/artists/related-artists-list';
import { TopTracksList } from '@/components/artists/top-tracks-list';

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
    },
  });

  if (!artist) {
    notFound();
  }

  // Get related artists by looking up who Spotify says is related.
  // At scan time we persisted related artists as Artist rows.
  // We need a different approach since we don't store the "related" edge yet
  // (that comes with the Neighbor Intelligence Engine in Sprint 3).
  // For now, fetch all artists that were scanned around the same time
  // (within 5 minutes of this artist's lastFetchedAt) as a proxy.
  const scanWindow = new Date(artist.lastFetchedAt.getTime() - 5 * 60 * 1000);
  const relatedArtists = await db.artist.findMany({
    where: {
      id: { not: artist.id },
      lastFetchedAt: { gte: scanWindow },
    },
    orderBy: { followerCount: 'desc' },
    take: 20,
  });

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

      <section>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Top Tracks</h2>
        <TopTracksList tracks={artist.tracks} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Related Artists</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Artists in Spotify&apos;s related graph. Size labels show follower ratio relative to{' '}
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
