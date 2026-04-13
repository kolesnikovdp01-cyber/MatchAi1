# Football Analytics (Pitch Intelligence)

## Overview

Football analytics web application with AI predictions, author predictions, statistics tracking, and match history. Built with React + Vite frontend and Express 5 backend in a pnpm monorepo.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle for API server)

## Architecture

- `artifacts/football-analytics/` — React frontend (dashboard, predictions, stats, history, settings)
- `artifacts/api-server/` — Express API server
- `lib/api-spec/` — OpenAPI specification (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod validation schemas
- `lib/db/` — Drizzle ORM schema and database client

## Database Tables

- `ai_predictions` — AI-generated match predictions with confidence scores
- `author_predictions` — Expert predictions with stake levels and reasoning
- `matches` — Upcoming match data with odds

## Key Endpoints

- `GET /api/dashboard` — Dashboard summary (today's matches, win rate, profit, recent predictions)
- `GET /api/ai-predictions` — List AI predictions (filterable by status)
- `GET /api/author-predictions` — List author predictions
- `POST /api/author-predictions` — Create author prediction
- `PATCH /api/author-predictions/:id` — Update prediction status
- `GET /api/statistics/summary` — Overall prediction statistics
- `GET /api/statistics/monthly` — Monthly stats breakdown
- `GET /api/history` — Unified prediction history
- `GET /api/matches/upcoming` — Upcoming matches

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
