"""
Container Health scoring heuristics.

Evaluates the quality of a container playlist based on
track composition, diversity, and sequencing.
"""

from app.models import ContainerHealthRequest, ContainerHealthResponse

WEIGHT_OWN_TRACK_RATIO = 0.20
WEIGHT_BIGGER_NEIGHBOR = 0.25
WEIGHT_ERA_CONSISTENCY = 0.15
WEIGHT_GENRE_COHERENCE = 0.20
WEIGHT_SEQUENCING = 0.10
WEIGHT_FRESHNESS = 0.10


def compute_container_health(req: ContainerHealthRequest) -> ContainerHealthResponse:
    dimensions: dict[str, float] = {}
    warnings: list[str] = []

    # Own track ratio: penalize if too high (>50%) or too low (<20%)
    own_ratio_score = _score_own_track_ratio(req.own_track_ratio)
    dimensions["own_track_ratio"] = round(own_ratio_score, 1)
    if req.own_track_ratio > 0.5:
        warnings.append("Own tracks exceed 50% — weakens discovery context.")
    elif req.own_track_ratio < 0.15:
        warnings.append("Very few own tracks — playlist may lack artist identity.")

    # Bigger neighbor ratio: higher is better (up to a point)
    neighbor_score = _score_bigger_neighbor_ratio(req.bigger_neighbor_ratio)
    dimensions["bigger_neighbor_ratio"] = round(neighbor_score, 1)
    if req.bigger_neighbor_ratio < 0.3:
        warnings.append("Low proportion of larger neighbors — limited upward context pull.")

    # Era consistency
    era_score = req.era_consistency * 100
    dimensions["era_consistency"] = round(era_score, 1)
    if req.era_consistency < 0.5:
        warnings.append("Era inconsistency — tracks span too many release periods.")

    # Genre coherence
    genre_score = req.genre_coherence * 100
    dimensions["genre_coherence"] = round(genre_score, 1)
    if req.genre_coherence < 0.5:
        warnings.append("Low genre coherence — playlist may confuse discovery signals.")

    # Sequencing quality
    seq_score = req.sequencing_quality * 100
    dimensions["sequencing_quality"] = round(seq_score, 1)

    # Freshness
    fresh_score = req.freshness * 100
    dimensions["freshness"] = round(fresh_score, 1)
    if req.freshness < 0.3:
        warnings.append("Playlist is stale — consider refreshing tracks.")

    total = (
        own_ratio_score * WEIGHT_OWN_TRACK_RATIO
        + neighbor_score * WEIGHT_BIGGER_NEIGHBOR
        + era_score * WEIGHT_ERA_CONSISTENCY
        + genre_score * WEIGHT_GENRE_COHERENCE
        + seq_score * WEIGHT_SEQUENCING
        + fresh_score * WEIGHT_FRESHNESS
    )

    return ContainerHealthResponse(
        score=round(max(0.0, min(100.0, total)), 1),
        dimensions=dimensions,
        warnings=warnings,
    )


def _score_own_track_ratio(ratio: float) -> float:
    """Ideal own track ratio is 30-45%. Penalize outside this range."""
    if 0.30 <= ratio <= 0.45:
        return 100.0
    elif 0.20 <= ratio < 0.30:
        return 70.0
    elif 0.45 < ratio <= 0.50:
        return 80.0
    elif ratio > 0.50:
        over = ratio - 0.50
        return max(0.0, 60.0 - over * 200)
    else:
        return max(0.0, ratio * 300)


def _score_bigger_neighbor_ratio(ratio: float) -> float:
    """Higher proportion of bigger neighbors is better, up to ~70%."""
    if ratio >= 0.7:
        return 100.0
    elif ratio >= 0.5:
        return 80.0 + (ratio - 0.5) * 100
    elif ratio >= 0.3:
        return 50.0 + (ratio - 0.3) * 150
    else:
        return ratio * 166.7
