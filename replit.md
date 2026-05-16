# REALIZE CRM

A mobile-first PWA loan CRM for managing clients, installments, collections, commissions, and team rankings. Multi-tenant SaaS with teams (Trello/Notion-style).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/crm run dev` — run the frontend (port 22444, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, needs TTY; use raw psql as fallback)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — used for session cookies

## Test Accounts

All belong to team "Time Realize" (invite code: `REALIZE1`).

| Role     | Email               | Password    |
|----------|---------------------|-------------|
| Líder    | lider@crm.com       | admin123    |
| Vendedor | carlos@crm.com      | carlos123   |
| Vendedor | ana@crm.com         | ana123      |
| Cobrador | roberto@crm.com     | roberto123  |

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + cookie-parser + pino logger
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + Wouter router
- PWA: service worker + web app manifest

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle schema tables (users, teams, team_members, clients, installments, events, tasks, private_notes, notifications, sessions)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, teams, users, clients, installments, events, tasks, notes, dashboard, ranking, notifications)
- `artifacts/api-server/src/lib/` — auth.ts, installment-engine.ts, logger.ts
- `artifacts/crm/src/pages/` — React pages (login, seletor-time, dashboard, clientes, cliente-novo, cliente-detail, cobranca, metas, perfil, notificacoes)
- `artifacts/crm/src/components/` — layout (bottom tabs + team switcher header), theme-provider, shadcn UI components
- `artifacts/crm/src/lib/auth-context.tsx` — auth context: user, papel, needsTeam, activeTeamId

## Architecture decisions

- **Multi-tenant teams**: all data (clients, installments, events, tasks, notifications) is scoped to a `team_id`; users can belong to multiple teams and switch between them
- **RBAC from team_members.role**: a user's role (lider/vendedor/cobrador) is per-team, stored in `team_members.role`; `users.papel` is a legacy column kept for compat
- **Sessions carry active_team_id**: `sessions.active_team_id` determines the current team context; all queries filter by this
- **Auto-team on register**: registering auto-creates a personal team and makes the user its lider; no role picker on register
- **Invite code join**: teams have a random 8-char invite code; anyone can join as vendedor; lider can promote members
- Cookie-based session auth (httpOnly, 7-day expiry); SHA-256 hash with salt (no bcrypt, intentional for performance)
- All API routes under `/api` prefix; frontend served at `/`
- Commission: 10% of monthly sales; bonus tiers: ≥R$5k→+R$1k, ≥R$10k→+R$1.5k, ≥R$20k→+R$2k
- Monthly goal (META_MENSAL) = R$20,000 (per team, stored in teams.meta_mensal)
- Installments auto-generated on client creation; overdue processing via `/api/cron/process-overdue`

## Product

- **Login**: Email + password login; register creates account + personal team automatically
- **Seletor de Time** (`/seletor-time`): shown when `needs_team=true`; list/switch teams, create new team, join by invite code
- **Header**: team name shown as dropdown; tap to switch teams, create, or join
- **Dashboard**: Commission summary, ranking position, overdue count, recent events
- **Clientes**: Client list with search & status filter, new client form with installment preview
- **Detalhe do cliente**: Installment progress, payment registration, event history timeline, annotations
- **Cobrança**: Overdue installments across all sellers with payment registration
- **Metas**: Monthly goal progress, team ranking podium, personal task manager
- **Perfil**: User info, theme selector (light/dark/system), private notes, logout

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` — the DB lib must be built first
- `credentials: 'include'` is set globally in `lib/api-client-react/src/custom-fetch.ts` for cookie auth
- Do not use `pnpm dev` at workspace root — use workflows or filter commands
- `installments` table uses `numero_parcela = 0` as a placeholder for overdue test records
- After running codegen, `lib/api-zod/src/index.ts` is auto-regenerated — it only exports from `./generated/api` (types dir re-export was removed to avoid duplicate name conflict from inline request body schemas)
- Inline request body schemas in openapi.yaml cause duplicate type names in both Zod and TS output — always define request bodies as named `$ref` schemas in `components/schemas`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OpenAPI spec → `pnpm --filter @workspace/api-spec run codegen` → regenerates all React Query hooks
