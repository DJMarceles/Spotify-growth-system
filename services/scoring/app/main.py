from fastapi import FastAPI

from app.routes import health, scoring

app = FastAPI(
    title="Release Loop Scoring Service",
    version="0.1.0",
    description="Deterministic scoring heuristics for Release Loop OS",
)

app.include_router(health.router)
app.include_router(scoring.router, prefix="/api/v1")
