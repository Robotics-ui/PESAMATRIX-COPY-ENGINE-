# PesaMatrix

MT5 copy-trading platform — subscribers connect their MetaTrader 5 accounts and automatically mirror trades from the master strategy via MetaApi + CopyFactory. Payments are handled through M-Pesa (Safaricom Daraja STK push).

## Run & Operate

- **Start API** workflow — Express API on port 3000 (also starts Redis)
- **Start Frontend** workflow — Vite dev server on port 5000 (proxies `/api` → `:3000`)
- `pnpm install` — install all workspace dependencies
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `cd scripts && pnpm exec tsx ../scripts/seed-admin.ts` — seed/promote admin user

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, BullMQ (Redis queues), Pino logging
- DB: PostgreSQL + Drizzle ORM (`lib/db/src/schema/`)
- Frontend: React 19, Vite 7, Tailwind CSS 4, Wouter, TanStack Query, Recharts
- Validation: Zod 3, drizzle-zod
- Build: esbuild (CJS bundle in `artifacts/api-server/dist/`)

## Where things live

- `lib/db/src/schema/` — source of truth for all DB tables
- `lib/api-client-react/src/` — generated API hooks + `customFetch`
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/api-server/src/services/` — MetaApi, CopyFactory, M-Pesa, subscription services
- `artifacts/mockup-sandbox/src/pages/` — all React pages (user + admin)
- `artifacts/mockup-sandbox/src/index.css` — global theme (dark by default, green primary)

## Architecture decisions

- Subscriptions are counted in **trading days** (Mon–Fri only); weekends never reduce balance
- BullMQ workers handle async MT5 deployment, CopyFactory linking, payments, and notifications
- JWT access tokens (15 min) + HTTP-only refresh tokens (7 days) via cookies
- M-Pesa callbacks respond 200 immediately, then process async to avoid Safaricom timeouts
- All API calls from the browser go through Vite's `/api` proxy to avoid CORS issues

## Product

- Users register, connect an MT5 account, subscribe via M-Pesa, and get trades auto-copied
- Admin manages users, subscriptions, payments, media, resources, and news content
- Dark-theme dashboard (TradePro-inspired): stat cards, live market overview, performance chart, signals list, subscription panel

## User preferences

- Dark theme (default), green accent (`hsl(142 71% 45%)`), no purple anywhere
- Dashboard design matches TradePro SaaS screenshot with green replacing purple
- Admin email: `craigphilip761@gmail.com` — temporary password `Pesa@2026!` (change after first login)

## Gotchas

- Run `pnpm --filter @workspace/db run push` after any schema change before testing
- The API `dev` script also starts Redis; if Redis is already running the `2>/dev/null` swallows the error safely
- `JWT_SECRET` and `JWT_REFRESH_SECRET` must be set as Replit secrets (not plain env vars) — app throws on startup if missing
- `req.params.id` is typed as `string | string[]` — always cast with `String(req.params["id"])` before passing to Drizzle
- Only import from `"zod"` (not `"zod/v4"`) in api-server routes — catalog pin is zod v3

## Required secrets

| Secret | Purpose |
|--------|---------|
| `JWT_SECRET` | Sign access tokens (15 min) |
| `JWT_REFRESH_SECRET` | Sign refresh tokens (7 days) |
| `METAAPI_TOKEN` | MetaApi provisioning + CopyFactory API |
| `MPESA_CONSUMER_KEY` | Safaricom Daraja API key |
| `MPESA_CONSUMER_SECRET` | Safaricom Daraja secret |
| `MPESA_SHORTCODE` | M-Pesa business short code |
| `MPESA_PASSKEY` | M-Pesa passkey |
