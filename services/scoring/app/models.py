from pydantic import BaseModel, Field


class ArtistInput(BaseModel):
    follower_count: int
    popularity: int
    genres: list[str]
    latest_release_date: str | None = None


class NeighborIntelligenceRequest(BaseModel):
    source_artist: ArtistInput
    candidate_artist: ArtistInput


class NeighborIntelligenceResponse(BaseModel):
    adjacency_score: float = Field(ge=0, le=100)
    follower_ratio_score: float = Field(ge=0, le=100)
    popularity_gap_score: float = Field(ge=0, le=100)
    genre_overlap_score: float = Field(ge=0, le=100)
    era_similarity_score: float = Field(ge=0, le=100)
    size_bucket: str
    closed_loop_risk: str
    explanation: str


class ContainerHealthRequest(BaseModel):
    own_track_ratio: float = Field(ge=0, le=1)
    bigger_neighbor_ratio: float = Field(ge=0, le=1)
    era_consistency: float = Field(ge=0, le=1)
    genre_coherence: float = Field(ge=0, le=1)
    sequencing_quality: float = Field(ge=0, le=1)
    freshness: float = Field(ge=0, le=1)


class ContainerHealthResponse(BaseModel):
    score: float = Field(ge=0, le=100)
    dimensions: dict[str, float]
    warnings: list[str]


class ReleaseReadinessRequest(BaseModel):
    container_health: float = Field(ge=0, le=100)
    task_completion_rate: float = Field(ge=0, le=1)
    placement_readiness: float = Field(ge=0, le=1)
    operations_completeness: float = Field(ge=0, le=1)
    metrics_completeness: float = Field(ge=0, le=1)


class ReleaseReadinessResponse(BaseModel):
    score: float = Field(ge=0, le=100)
    dimensions: dict[str, float]
    blockers: list[str]
