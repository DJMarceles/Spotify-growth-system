from app.domain.release_readiness import compute_release_readiness
from app.models import ReleaseReadinessRequest


def test_ready_campaign():
    """A well-prepared campaign should score high with no blockers."""
    result = compute_release_readiness(
        ReleaseReadinessRequest(
            container_health=85,
            task_completion_rate=0.9,
            placement_readiness=0.8,
            operations_completeness=0.7,
            metrics_completeness=0.6,
        )
    )
    assert result.score >= 70
    assert len(result.blockers) == 0


def test_low_container_health_blocks():
    result = compute_release_readiness(
        ReleaseReadinessRequest(
            container_health=30,
            task_completion_rate=0.8,
            placement_readiness=0.7,
            operations_completeness=0.6,
            metrics_completeness=0.5,
        )
    )
    assert any("Container playlist health" in b for b in result.blockers)


def test_low_task_completion_blocks():
    result = compute_release_readiness(
        ReleaseReadinessRequest(
            container_health=70,
            task_completion_rate=0.3,
            placement_readiness=0.7,
            operations_completeness=0.6,
            metrics_completeness=0.5,
        )
    )
    assert any("tasks completed" in b for b in result.blockers)


def test_score_is_bounded():
    result = compute_release_readiness(
        ReleaseReadinessRequest(
            container_health=50,
            task_completion_rate=0.5,
            placement_readiness=0.5,
            operations_completeness=0.5,
            metrics_completeness=0.5,
        )
    )
    assert 0 <= result.score <= 100
