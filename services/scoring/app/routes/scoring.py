from fastapi import APIRouter

from app.domain.neighbor_intelligence import compute_neighbor_score
from app.domain.container_health import compute_container_health
from app.domain.release_readiness import compute_release_readiness
from app.models import (
    NeighborIntelligenceRequest,
    NeighborIntelligenceResponse,
    ContainerHealthRequest,
    ContainerHealthResponse,
    ReleaseReadinessRequest,
    ReleaseReadinessResponse,
)

router = APIRouter()


@router.post("/neighbor-intelligence", response_model=NeighborIntelligenceResponse)
def neighbor_intelligence(request: NeighborIntelligenceRequest) -> NeighborIntelligenceResponse:
    return compute_neighbor_score(request)


@router.post("/container-health", response_model=ContainerHealthResponse)
def container_health(request: ContainerHealthRequest) -> ContainerHealthResponse:
    return compute_container_health(request)


@router.post("/release-readiness", response_model=ReleaseReadinessResponse)
def release_readiness(request: ReleaseReadinessRequest) -> ReleaseReadinessResponse:
    return compute_release_readiness(request)
