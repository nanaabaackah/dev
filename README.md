# dev

This folder builds the standalone KPI dashboard served at `dev.nanaabaackah.com`. The frontend reuses the KPI routes from the `nanaabaackah.com` backend, so it never needs to spin up its own API.

## Local setup

- Install dependencies first with `npm install`.
- Set `VITE_API_BASE=https://dev.nanaabaackah.com` (or your preferred API host) in `.env` before running `npm run dev` or `npm run build`. The helper in `src/api-url.ts` normalizes that base and still falls back to relative `/api/*` calls when the variable is empty.
- Auth now uses secure cookies (`HttpOnly` session + CSRF cookie). If you run frontend and backend on different origins, keep CORS origins configured on the API and allow credentials.
- For AI v1 in Productivity, set `OPENAI_API_KEY` on the backend server environment. Optional: set `OPENAI_MODEL` (defaults to `gpt-4.1-mini`) and `OPENAI_TIMEOUT_MS`.
- Optional auth cookie env vars:
  - `AUTH_COOKIE_NAME` (default `dev_kpi_auth`)
  - `AUTH_CSRF_COOKIE_NAME` (default `dev_kpi_csrf`)
  - `AUTH_COOKIE_MAX_AGE_MS` (default 12 hours)
  - `AUTH_COOKIE_SAME_SITE` (`lax`, `strict`, or `none`; default `lax`)
  - `AUTH_COOKIE_SECURE` (`true`/`false`; defaults to `true` in production)
  - Session auth is cookie-backed. The frontend no longer stores a bearer JWT in browser storage.
- For Dashboard daily brief APIs:
  - Set `GOOGLE_WEATHER_API_KEY` for `/api/dashboard/weather` (Google Weather API).
  - Optional weather settings: `GOOGLE_WEATHER_UNITS_SYSTEM` (`IMPERIAL` or `METRIC`), `GOOGLE_WEATHER_LANGUAGE_CODE`.
  - Set `YOUVERSION_VERSE_ENDPOINT` for `/api/dashboard/verse-of-day` (defaults to `https://www.bible.com/verse-of-the-day`).
  - Optional YouVersion auth headers: `YOUVERSION_API_KEY`, `YOUVERSION_BEARER_TOKEN`, `YOUVERSION_APP_ID`.
- Job recommendations now aggregate multiple live boards (Remotive + Arbeitnow) via `/api/jobs/recommendations`. Optional: `ARBEITNOW_PAGE_LIMIT` to control fetched pages.
- Rent module:
  - `/rent` now tracks tenants monthly, including missed-month summaries, recent payment history, and payment create/edit/delete flows.
  - Admin and Landlord users can manage all tenant records in their organization, while `Tenant` users stay limited to rent pages/APIs.
  - Creating a tenant from `/rent` provisions tenant access automatically and sends the setup-account invite; in local/non-production that invite is rerouted to `DEFAULT_ADMIN_EMAIL`.
  - Tenant access stays in sync with `/user-control`, so Tenant users created there can appear in Rent and rent tenants can be backfilled into User Control.
  - Optional monthly tenant update env vars: `RENT_MONTHLY_EMAIL_ENABLED`, `RENT_MONTHLY_EMAIL_HOUR_UTC`, `RENT_MONTHLY_EMAIL_MINUTE_UTC`, `RENT_MONTHLY_FROM_EMAIL`.
  - Legacy `RENT_QUARTERLY_*` env vars are still accepted as fallbacks, but new setups should use the `RENT_MONTHLY_*` names.
- User Control module:
  - `/user-control` lets admins create users, assign roles/status, and edit role module access in-app.
  - Creating a user sends an invitation email with a `/setup-account` link so the user can choose their password.
  - Tenant access is synced with Rent, so Tenant users created in User Control can be surfaced in the rent module.
  - Invite env vars: `ACCOUNT_INVITE_FROM_EMAIL`, `ACCOUNT_SETUP_TOKEN_TTL_HOURS`, and `APP_BASE_URL` (required for invite/reset links).
- Google Calendar integration now requires `OAUTH_TOKEN_ENCRYPTION_KEY` (32-byte hex or base64) so OAuth tokens are encrypted before they are stored.
- Optional PostgreSQL TLS env vars:
  - `DATABASE_SSL`, `DATABASE_SSL_MODE`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `DATABASE_SSL_CA`
  - `REEBS_DATABASE_SSL`, `REEBS_DATABASE_SSL_MODE`, `REEBS_DATABASE_SSL_REJECT_UNAUTHORIZED`, `REEBS_DATABASE_SSL_CA`
  - `FAAKO_DATABASE_SSL`, `FAAKO_DATABASE_SSL_MODE`, `FAAKO_DATABASE_SSL_REJECT_UNAUTHORIZED`, `FAAKO_DATABASE_SSL_CA`
- In non-production/local environments, outgoing email including account invites, tenant setup invites, alerts, and reports is rerouted to `DEFAULT_ADMIN_EMAIL`.
- To auto-seed an admin for first login, set `DEFAULT_ADMIN_EMAIL` and a strong `DEFAULT_ADMIN_PASSWORD` on the backend (minimum 14 chars with uppercase, lowercase, number, and special character).
- Environment isolation for invoices and other writes:
  - Backend now reads `APP_ENV` (defaults to `development`) and loads `.env.<APP_ENV>`.
  - For local work, copy `.env.example` to your untracked `.env.development`, keep `APP_ENV="development"`, and set a local database in `DATABASE_URL_DEVELOPMENT`.
  - In production set `APP_ENV="production"` (or `NODE_ENV=production`) and keep production DB in `DATABASE_URL` or `DATABASE_URL_PRODUCTION`.
  - `ENFORCE_DATABASE_ISOLATION` (default `true` in development) refuses startup if local DB matches `DATABASE_URL_PRODUCTION`, preventing local test invoices from writing into prod.

## Bootstrap commands

- Frontend only: `npm install` then `npm run dev`
- Local backend with local database sync: `npm install` then `npm run server:dev:with-migrate`
- Local DB status check: `npm run db:status:dev`
- Local DB sync/apply migrations: `npm run db:deploy:dev`
- Production DB status check: `npm run db:status:prod`
- Production DB sync/apply migrations: `npm run db:deploy:prod`
- Start backend without running migrations: `npm run server:dev` or `npm run server:prod`

## Prisma / npx shortcuts

- Generate Prisma client directly: `npx prisma generate`
- Open Prisma Studio for the active environment: `npx prisma studio`
- Create a new development migration when the schema changes: `npm run db:migrate:dev -- --name <migration-name>`
- If you prefer the raw Prisma command: `APP_ENV=development npx prisma migrate dev --name <migration-name>`

## Project structure

- Route-level screens now live in `src/pages/<PageName>/` with page-specific CSS kept beside the page component where needed.
- Shared UI lives in `src/components/` (for example `JobsWidget`, `KPICard`, `VerseWidget`, `WeatherWidget`, `ThemeToggle`, and `ErrorBoundary`).
- Shared data logic and browser utilities stay in `src/hooks/` and `src/utils/`.
- The backend is being split by feature. Auth, dashboard, jobs, productivity, security headers, request logging, and shared async helpers now live under `backend/` feature folders, while `backend/server.js` remains the main composition root.

## Useful commands

- `npm run dev` starts the Vite frontend locally.
- `npm run build` creates a production build.
- `npm test` runs the current backend unit tests with Node's built-in test runner.
- `npm run db:generate` regenerates the Prisma client.
- `npm run db:studio` opens Prisma Studio.
- `npm run db:migrate:dev -- --name <migration-name>` creates/applies a development migration.
- `npm run db:status:dev` checks development database migration status.
- `npm run db:status:prod` checks production database migration status.
- `npm run db:deploy:dev` applies pending migrations to the development database.
- `npm run db:deploy:prod` applies pending migrations to the production database.
- `npm run migrate:status` checks Prisma migration status for the active environment.
- `npm run migrate:deploy` applies pending Prisma migrations for the active environment.
- `npm run server` starts the backend API.
- `npm run server:dev` starts the backend with `APP_ENV=development`.
- `npm run server:prod` starts the backend with `APP_ENV=production`.
- `npm run server:dev:with-migrate` syncs the development DB, then starts the backend.
- `npm run server:prod:with-migrate` syncs the production DB, then starts the backend.
- `npm run server:with-migrate` applies migrations first, then starts the backend API.

## Deployment

- Netlify redirects `/api/*` to `https://dev.nanaabaackah.com/api/:splat`, so every dashboard request lands on the upstream backend without requiring a separate server.
- Before starting a production backend deploy, run `APP_ENV=production npm run migrate:deploy`.
- To verify production schema state after deploy, run `APP_ENV=production npm run migrate:status`.
