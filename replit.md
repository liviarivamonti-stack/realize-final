# LoanCRM

A mobile-first PWA loan CRM for managing clients, installments, collections, commissions, and team rankings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/crm run dev` — run the frontend (port 22444, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — used for session cookies

## Test Accounts

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
- `lib/db/src/schema/` — Drizzle schema tables (users, clients, installments, events, tasks, private_notes, sessions)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, users, clients, installments, events, tasks, notes, dashboard, ranking)
- `artifacts/api-server/src/lib/` — auth.ts, installment-engine.ts, logger.ts
- `artifacts/crm/src/pages/` — React pages (login, dashboard, clientes, cliente-novo, cliente-detail, cobranca, metas, perfil)
- `artifacts/crm/src/components/` — layout (bottom tabs), theme-provider, shadcn UI components
- `artifacts/crm/src/lib/auth-context.tsx` — auth context with useGetMe

## Architecture decisions

- Cookie-based session auth (httpOnly, 7-day expiry); SHA-256 hash with salt (no bcrypt, intentional for performance)
- All API routes under `/api` prefix, handled by the api-server artifact; frontend served at `/`
- RBAC enforced server-side: vendedor sees only own clients; cobrador/lider sees all
- Commission: 10% of monthly sales; bonus tiers: ≥R$5k→+R$1k, ≥R$10k→+R$1.5k, ≥R$20k→+R$2k
- Monthly goal (META_MENSAL) = R$20,000
- Installments auto-generated on client creation; overdue processing via `/api/cron/process-overdue`

## Product

- **Login**: Role-based access for vendedor, cobrador, lider
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

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OpenAPI spec → `pnpm --filter @workspace/api-spec run codegen` → regenerates all React Query hooks
