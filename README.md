# dev

This folder builds the standalone KPI dashboard served at `dev.nanaabaackah.com`. The frontend reuses the KPI routes from the `nanaabaackah.com` backend, so it never needs to spin up its own API.

## Local setup

- Set `VITE_API_BASE=https://dev.nanaabaackah.com` (or your preferred API host) in `.env` before running `npm run dev` or `npm run build`. The helper in `src/api-url.js` normalizes that base and still falls back to relative `/api/*` calls when the variable is empty.
- Auth now uses secure cookies (`HttpOnly` session + CSRF cookie). If you run frontend and backend on different origins, keep CORS origins configured on the API and allow credentials.
- For AI v1 in Productivity, set `OPENAI_API_KEY` on the backend server environment. Optional: set `OPENAI_MODEL` (defaults to `gpt-4.1-mini`) and `OPENAI_TIMEOUT_MS`.
- Optional auth cookie env vars:
  - `AUTH_COOKIE_NAME` (default `dev_kpi_auth`)
  - `AUTH_CSRF_COOKIE_NAME` (default `dev_kpi_csrf`)
  - `AUTH_COOKIE_MAX_AGE_MS` (default 12 hours)
  - `AUTH_COOKIE_SAME_SITE` (`lax`, `strict`, or `none`; default `lax`)
  - `AUTH_COOKIE_SECURE` (`true`/`false`; defaults to `true` in production)
- For Dashboard daily brief APIs:
  - Set `GOOGLE_WEATHER_API_KEY` for `/api/dashboard/weather` (Google Weather API).
  - Optional weather settings: `GOOGLE_WEATHER_UNITS_SYSTEM` (`IMPERIAL` or `METRIC`), `GOOGLE_WEATHER_LANGUAGE_CODE`.
  - Set `YOUVERSION_VERSE_ENDPOINT` for `/api/dashboard/verse-of-day` (defaults to `https://www.bible.com/verse-of-the-day`).
  - Optional YouVersion auth headers: `YOUVERSION_API_KEY`, `YOUVERSION_BEARER_TOKEN`, `YOUVERSION_APP_ID`.
- Job recommendations now aggregate multiple live boards (Remotive + Arbeitnow) via `/api/jobs/recommendations`. Optional: `ARBEITNOW_PAGE_LIMIT` to control fetched pages.
- To auto-seed an admin for first login, set `DEFAULT_ADMIN_EMAIL` and a strong `DEFAULT_ADMIN_PASSWORD` (minimum 12 chars) on the backend.
- Environment isolation for invoices and other writes:
  - Backend now reads `APP_ENV` (defaults to `development`) and loads `.env.<APP_ENV>`.
  - For local work, copy `.env.example` to your untracked `.env.development`, keep `APP_ENV="development"`, and set a local database in `DATABASE_URL_DEVELOPMENT`.
  - In production set `APP_ENV="production"` (or `NODE_ENV=production`) and keep production DB in `DATABASE_URL` or `DATABASE_URL_PRODUCTION`.
  - `ENFORCE_DATABASE_ISOLATION` (default `true` in development) refuses startup if local DB matches `DATABASE_URL_PRODUCTION`, preventing local test invoices from writing into prod.

## Deployment

- Netlify redirects `/api/*` to `https://dev.nanaabaackah.com/api/:splat`, so every dashboard request lands on the upstream backend without requiring a separate server.
