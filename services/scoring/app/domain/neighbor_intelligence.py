"""
Neighbor Intelligence scoring heuristics.

Determines how suitable a candidate artist is as a neighbor
for the source artist's container playlist.

Ideal candidates are somewhat larger but not massively larger,
genre-aligned, and era-consistent.
"""

from datetime import datetime

from app.models import NeighborIntelligenceRequest, NeighborIntelligenceResponse

# Ideal follower ratio range (candidate / source)
IDEAL_RATIO_MIN = 1.0
IDEAL_RATIO_MAX = 10.0
IDEAL_RATIO_SWEET = 3.0

# Popularity gap sweet spot
IDEAL_POP_GAP_MIN = 0
IDEAL_POP_GAP_MAX = 20

# Weights for final adjacency score
WEIGHT_FOLLOWER_RATIO = 0.30
WEIGHT_POPULARITY_GAP = 0.25
WEIGHT_GENRE_OVERLAP = 0.25
WEIGHT_ERA_SIMILARITY = 0.20


def compute_neighbor_score(req: NeighborIntelligenceRequest) -> NeighborIntelligenceResponse:
    src = req.source_artist
    cand = req.candidate_artist

    follower_ratio_score = _score_follower_ratio(src.follower_count, cand.follower_count)
    popularity_gap_score = _score_popularity_gap(src.popularity, cand.popularity)
    genre_overlap_score = _score_genre_overlap(src.genres, cand.genres)
    era_similarity_score = _score_era_similarity(src.latest_release_date, cand.latest_release_date)

    adjacency_score = (
        follower_ratio_score * WEIGHT_FOLLOWER_RATIO
        + popularity_gap_score * WEIGHT_POPULARITY_GAP
        + genre_overlap_score * WEIGHT_GENRE_OVERLAP
        + era_similarity_score * WEIGHT_ERA_SIMILARITY
    )

    size_bucket = _determine_size_bucket(src.follower_count, cand.follower_count)
    closed_loop_risk = _determine_closed_loop_risk(size_bucket, adjacency_score)

    explanation = _build_explanation(
        size_bucket, follower_ratio_score, popularity_gap_score, genre_overlap_score
    )

    def _clamp(v: float) -> float:
        return round(max(0.0, min(100.0, v)), 1)

    return NeighborIntelligenceResponse(
        adjacency_score=_clamp(adjacency_score),
        follower_ratio_score=_clamp(follower_ratio_score),
        popularity_gap_score=_clamp(popularity_gap_score),
        genre_overlap_score=_clamp(genre_overlap_score),
        era_similarity_score=_clamp(era_similarity_score),
        size_bucket=size_bucket,
        closed_loop_risk=closed_loop_risk,
        explanation=explanation,
    )


def _score_follower_ratio(source_followers: int, candidate_followers: int) -> float:
    if source_followers == 0:
        return 50.0

    ratio = candidate_followers / source_followers

    if ratio < 0.5:
        return max(0.0, 20.0 * ratio)
    elif ratio < IDEAL_RATIO_MIN:
        return 10.0 + 40.0 * ratio
    elif IDEAL_RATIO_MIN <= ratio <= IDEAL_RATIO_MAX:
        distance_from_sweet = abs(ratio - IDEAL_RATIO_SWEET)
        max_distance = max(IDEAL_RATIO_SWEET - IDEAL_RATIO_MIN, IDEAL_RATIO_MAX - IDEAL_RATIO_SWEET)
        return 100.0 - (distance_from_sweet / max_distance) * 30.0
    else:
        over = ratio - IDEAL_RATIO_MAX
        return max(0.0, 70.0 - over * 3.0)


def _score_popularity_gap(source_pop: int, candidate_pop: int) -> float:
    gap = candidate_pop - source_pop

    if gap < -10:
        return max(0.0, 30.0 + gap * 2.0)
    elif -10 <= gap < IDEAL_POP_GAP_MIN:
        return 50.0 + gap * 2.0
    elif IDEAL_POP_GAP_MIN <= gap <= IDEAL_POP_GAP_MAX:
        return 100.0 - abs(gap - 10) * 2.0
    else:
        over = gap - IDEAL_POP_GAP_MAX
        return max(0.0, 80.0 - over * 4.0)


def _score_genre_overlap(source_genres: list[str], candidate_genres: list[str]) -> float:
    if not source_genres or not candidate_genres:
        return 30.0

    source_set = set(g.lower() for g in source_genres)
    candidate_set = set(g.lower() for g in candidate_genres)

    intersection = source_set & candidate_set
    union = source_set | candidate_set

    if not union:
        return 30.0

    jaccard = len(intersection) / len(union)
    return min(100.0, jaccard * 120.0)


def _score_era_similarity(
    source_date: str | None, candidate_date: str | None
) -> float:
    if not source_date or not candidate_date:
        return 50.0

    try:
        src_date = _parse_release_date(source_date)
        cand_date = _parse_release_date(candidate_date)
        diff_days = abs((src_date - cand_date).days)

        if diff_days <= 365:
            return 100.0
        elif diff_days <= 730:
            return 80.0
        elif diff_days <= 1825:
            return 50.0
        else:
            return max(10.0, 50.0 - (diff_days - 1825) / 365 * 10)
    except (ValueError, TypeError):
        return 50.0


def _parse_release_date(date_str: str) -> datetime:
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {date_str}")


def _determine_size_bucket(source_followers: int, candidate_followers: int) -> str:
    if source_followers == 0:
        return "similar"

    ratio = candidate_followers / source_followers

    if ratio < 0.8:
        return "smaller"
    elif ratio <= 1.5:
        return "similar"
    elif ratio <= 10.0:
        return "slightly-larger"
    else:
        return "much-larger"


def _determine_closed_loop_risk(size_bucket: str, adjacency_score: float) -> str:
    if size_bucket == "smaller" and adjacency_score < 40:
        return "high"
    elif size_bucket in ("smaller", "similar") and adjacency_score < 60:
        return "medium"
    else:
        return "low"


def _build_explanation(
    size_bucket: str,
    follower_score: float,
    pop_score: float,
    genre_score: float,
) -> str:
    parts: list[str] = []

    bucket_labels = {
        "smaller": "smaller than source",
        "similar": "similar size to source",
        "slightly-larger": "slightly larger than source (ideal)",
        "much-larger": "much larger than source",
    }
    parts.append(f"Artist is {bucket_labels.get(size_bucket, size_bucket)}.")

    if follower_score >= 70:
        parts.append("Good follower ratio for audience adjacency.")
    elif follower_score >= 40:
        parts.append("Moderate follower ratio.")
    else:
        parts.append("Follower ratio is outside ideal range.")

    if genre_score >= 70:
        parts.append("Strong genre alignment.")
    elif genre_score >= 40:
        parts.append("Partial genre overlap.")
    else:
        parts.append("Weak genre overlap — may reduce context coherence.")

    if pop_score >= 70:
        parts.append("Popularity gap is in the sweet spot.")
    elif pop_score < 40:
        parts.append("Popularity gap is too wide or inverted.")

    return " ".join(parts)
