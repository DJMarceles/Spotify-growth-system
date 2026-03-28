from app.domain.neighbor_intelligence import compute_neighbor_score
from app.models import ArtistInput, NeighborIntelligenceRequest


def _make_request(
    src_followers: int = 10000,
    src_popularity: int = 40,
    src_genres: list[str] | None = None,
    cand_followers: int = 30000,
    cand_popularity: int = 55,
    cand_genres: list[str] | None = None,
) -> NeighborIntelligenceRequest:
    return NeighborIntelligenceRequest(
        source_artist=ArtistInput(
            follower_count=src_followers,
            popularity=src_popularity,
            genres=src_genres or ["indie pop", "bedroom pop"],
            latest_release_date="2024-06-15",
        ),
        candidate_artist=ArtistInput(
            follower_count=cand_followers,
            popularity=cand_popularity,
            genres=cand_genres or ["indie pop", "dream pop"],
            latest_release_date="2024-08-01",
        ),
    )


def test_ideal_neighbor_scores_high():
    """A slightly larger artist with genre overlap should score well."""
    result = compute_neighbor_score(_make_request())
    assert result.adjacency_score >= 60
    assert result.size_bucket == "slightly-larger"
    assert result.closed_loop_risk == "low"


def test_smaller_artist_scores_lower():
    """An artist smaller than source should score lower."""
    result = compute_neighbor_score(_make_request(cand_followers=5000, cand_popularity=25))
    assert result.adjacency_score < 60
    assert result.size_bucket == "smaller"


def test_much_larger_artist_penalized():
    """A massively larger artist should be penalized."""
    result = compute_neighbor_score(_make_request(cand_followers=5000000, cand_popularity=90))
    assert result.size_bucket == "much-larger"


def test_no_genre_overlap_lowers_score():
    """No genre overlap should reduce the score."""
    result = compute_neighbor_score(
        _make_request(cand_genres=["death metal", "black metal"])
    )
    assert result.genre_overlap_score < 30


def test_scores_are_bounded():
    """All scores should be between 0 and 100."""
    result = compute_neighbor_score(_make_request())
    assert 0 <= result.adjacency_score <= 100
    assert 0 <= result.follower_ratio_score <= 100
    assert 0 <= result.popularity_gap_score <= 100
    assert 0 <= result.genre_overlap_score <= 100
    assert 0 <= result.era_similarity_score <= 100
