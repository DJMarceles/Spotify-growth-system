from app.domain.container_health import compute_container_health
from app.models import ContainerHealthRequest


def test_healthy_container():
    """A well-composed container should score high."""
    result = compute_container_health(
        ContainerHealthRequest(
            own_track_ratio=0.35,
            bigger_neighbor_ratio=0.6,
            era_consistency=0.85,
            genre_coherence=0.9,
            sequencing_quality=0.8,
            freshness=0.7,
        )
    )
    assert result.score >= 70
    assert len(result.warnings) == 0


def test_too_many_own_tracks_warns():
    """Over 50% own tracks should trigger a warning."""
    result = compute_container_health(
        ContainerHealthRequest(
            own_track_ratio=0.6,
            bigger_neighbor_ratio=0.5,
            era_consistency=0.8,
            genre_coherence=0.8,
            sequencing_quality=0.7,
            freshness=0.6,
        )
    )
    assert any("Own tracks exceed 50%" in w for w in result.warnings)


def test_low_neighbor_ratio_warns():
    """Low bigger neighbor ratio should trigger a warning."""
    result = compute_container_health(
        ContainerHealthRequest(
            own_track_ratio=0.4,
            bigger_neighbor_ratio=0.2,
            era_consistency=0.8,
            genre_coherence=0.8,
            sequencing_quality=0.7,
            freshness=0.6,
        )
    )
    assert any("Low proportion" in w for w in result.warnings)


def test_score_is_bounded():
    result = compute_container_health(
        ContainerHealthRequest(
            own_track_ratio=0.35,
            bigger_neighbor_ratio=0.5,
            era_consistency=0.7,
            genre_coherence=0.7,
            sequencing_quality=0.7,
            freshness=0.7,
        )
    )
    assert 0 <= result.score <= 100
