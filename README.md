# Release Loop OS

Release intelligence and execution platform for Spotify artists.

## What It Does

- Analyzes your Spotify discovery environment
- Detects closed-loop risk (stuck among smaller artists)
- Identifies slightly larger adjacent artists for better context
- Builds container playlists with intelligent track sequencing
- Runs structured 8-week release cycles
- Monitors playlist health and release momentum
- Generates explainable, actionable recommendations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js, TypeScript, Tailwind, shadcn/ui |
| Backend | Next.js route handlers |
| Scoring | Python (FastAPI) |
| Database | PostgreSQL + Prisma |
| Cache | Redis |
| Integrations | Spotify OAuth + Web API |

## Repository Structure

```
release-loop-os/
├── apps/web/              # Next.js frontend application
├── services/scoring/      # Python scoring service (FastAPI)
├── packages/
│   ├── config/            # Shared tooling config
│   ├── domain/            # Shared types and constants
│   ├── spotify-client/    # Spotify API transport layer
│   └── ui/                # Shared UI components
├── prisma/                # Database schema and migrations
├── scripts/               # Development scripts
└── docs/                  # Documentation
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Python 3.11+
- PostgreSQL 15+
- Redis 7+ (optional for MVP)

## Local Setup

1. **Clone and install:**

```bash
git clone <repo-url>
cd release-loop-os
bash scripts/dev-setup.sh
```

2. **Configure environment:**

```bash
cp .env.example .env
# Fill in your Spotify credentials and database URL
```

3. **Set up database:**

```bash
pnpm db:push
```

4. **Start development servers:**

```bash
# Terminal 1: Next.js
pnpm dev

# Terminal 2: Scoring service
cd services/scoring
source .venv/bin/activate
uvicorn app.main:app --reload
```

5. **Open the app:**

Visit [http://localhost:3000](http://localhost:3000)

## Running Tests

```bash
# TypeScript tests
pnpm test

# Python scoring tests
cd services/scoring
source .venv/bin/activate
pytest
```

## License

Private — not open source.
