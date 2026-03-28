# Architecture Decisions

## ADR-001: Monorepo with Turborepo + pnpm

We use a monorepo to keep all packages co-located while maintaining clear boundaries. Turborepo handles task orchestration and caching. pnpm provides fast, disk-efficient dependency management.

## ADR-002: Separate Python Scoring Service

Business/scoring logic lives in a standalone FastAPI service rather than in the Next.js app. This keeps scoring logic independently testable, allows it to evolve without frontend deployments, and makes it possible to scale separately.

## ADR-003: Prisma for Database Access

Prisma provides type-safe database access with good migration support. The schema serves as a single source of truth for the data model.

## ADR-004: Domain Types Package

Shared TypeScript types live in `@release-loop/domain` so both the web app and future services can reference the same type definitions without circular dependencies.

## ADR-005: Spotify Client as Separate Package

The Spotify API transport layer is isolated in `@release-loop/spotify-client` to keep API concerns separate from domain logic. This makes it easy to test domain logic with mocked Spotify responses.
