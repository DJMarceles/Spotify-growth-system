# Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    apps/web                          │
│              (Next.js Frontend)                      │
│                                                     │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐ │
│  │   Pages  │  │ Components│  │  Route Handlers  │ │
│  └──────────┘  └───────────┘  └──────────────────┘ │
└─────────────────────┬───────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
┌──────────────┐ ┌─────────┐ ┌──────────────┐
│   packages/  │ │ prisma/ │ │  services/   │
│spotify-client│ │  (DB)   │ │   scoring    │
│              │ │         │ │  (FastAPI)   │
└──────┬───────┘ └────┬────┘ └──────────────┘
       │              │
       ▼              ▼
  Spotify API    PostgreSQL
```

## Package Boundaries

| Package | Responsibility |
|---------|---------------|
| `apps/web` | UI, routing, server-side logic |
| `packages/domain` | Shared types and constants |
| `packages/spotify-client` | Spotify API transport layer |
| `packages/ui` | Shared UI primitives |
| `packages/config` | Shared tooling config |
| `prisma/` | Database schema and client |
| `services/scoring` | Scoring heuristics (Python) |
