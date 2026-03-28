"""
Release Readiness scoring heuristics.

Determines how prepared a campaign is to support a release
based on container health, task completion, and operations state.
"""

from app.models import ReleaseReadinessRequest, ReleaseReadinessResponse

WEIGHT_CONTAINER_HEALTH = 0.30
WEIGHT_TASK_COMPLETION = 0.25
WEIGHT_PLACEMENT = 0.15
WEIGHT_OPERATIONS = 0.15
WEIGHT_METRICS = 0.15


def compute_release_readiness(req: ReleaseReadinessRequest) -> ReleaseReadinessResponse:
    dimensions: dict[str, float] = {}
    blockers: list[str] = []

    container_score = req.container_health
    dimensions["container_health"] = round(container_score, 1)
    if container_score < 40:
        blockers.append("Container playlist health is critically low.")

    task_score = req.task_completion_rate * 100
    dimensions["task_completion"] = round(task_score, 1)
    if req.task_completion_rate < 0.5:
        blockers.append("Less than 50% of campaign tasks completed.")

    placement_score = req.placement_readiness * 100
    dimensions["placement_readiness"] = round(placement_score, 1)
    if req.placement_readiness < 0.3:
        blockers.append("Placement readiness is low — key tracks may not be positioned.")

    ops_score = req.operations_completeness * 100
    dimensions["operations_completeness"] = round(ops_score, 1)

    metrics_score = req.metrics_completeness * 100
    dimensions["metrics_completeness"] = round(metrics_score, 1)
    if req.metrics_completeness < 0.2:
        blockers.append("Very few metrics recorded — visibility into campaign is limited.")

    total = (
        container_score * WEIGHT_CONTAINER_HEALTH
        + task_score * WEIGHT_TASK_COMPLETION
        + placement_score * WEIGHT_PLACEMENT
        + ops_score * WEIGHT_OPERATIONS
        + metrics_score * WEIGHT_METRICS
    )

    return ReleaseReadinessResponse(
        score=round(total, 1),
        dimensions=dimensions,
        blockers=blockers,
    )
