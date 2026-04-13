# Football Analytics (Pitch Intelligence)

## Overview

Football analytics web application with AI predictions, author predictions, statistics tracking, and match history. Built with React + Vite frontend and Express 5 backend in a pnpm monorepo.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts (port 5000)
- **Backend**: Express 5 (port 3000)
- **Database**: PostgreSQL + Drizzle ORM (Replit built-in)
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

## Replit Setup

- **Frontend** runs on port 5000 (webview workflow: "Start application")
- **Backend** runs on port 3000 (console workflow: "Backend API")
- Vite dev server proxies `/api` requests to backend at `localhost:3000`
- Environment variables: `PORT`, `BASE_PATH`, `DATABASE_URL` (auto-set by Replit)
- `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/football-analytics run dev`
- `PORT=3000 pnpm --filter @workspace/api-server run dev`

## Database Tables

- `ai_predictions` — AI-generated match predictions with confidence scores
- `author_predictions` — Expert predictions with stake levels and reasoning
- `matches` — Upcoming match data with odds
- `admins` — Admin users
- `users` — Regular users
- `ads` — Advertisement entries
- `live_odds` — Live odds data
- `stats_cache` — Cached statistics
- `prediction_buttons` — Voting/button data for predictions

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

## Optional Environment Variables

- `OPENAI_API_KEY` — Required for AI prediction generation
- `APISPORTS_KEY` — Required for fetching live sports data
- `GOOGLE_APPLICATION_CREDENTIALS` / Google Cloud Storage credentials — For file storage features
