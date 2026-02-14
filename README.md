# dev

This folder builds the standalone KPI dashboard served at `dev.nanaabaackah.com`. The frontend reuses the KPI routes from the `nanaabaackah.com` backend, so it never needs to spin up its own API.

## Local setup

- Set `VITE_API_BASE=https://dev.nanaabaackah.com` (or your preferred API host) in `.env` before running `npm run dev` or `npm run build`. The helper in `src/api-url.js` normalizes that base and still falls back to relative `/api/*` calls when the variable is empty.
- For AI v1 in Productivity, set `OPENAI_API_KEY` on the backend server environment. Optional: set `OPENAI_MODEL` (defaults to `gpt-4.1-mini`) and `OPENAI_TIMEOUT_MS`.
- For Dashboard daily brief APIs:
  - Set `GOOGLE_WEATHER_API_KEY` for `/api/dashboard/weather` (Google Weather API).
  - Optional weather settings: `GOOGLE_WEATHER_UNITS_SYSTEM` (`IMPERIAL` or `METRIC`), `GOOGLE_WEATHER_LANGUAGE_CODE`.
  - Set `YOUVERSION_VERSE_ENDPOINT` for `/api/dashboard/verse-of-day` (defaults to `https://www.bible.com/verse-of-the-day`).
  - Optional YouVersion auth headers: `YOUVERSION_API_KEY`, `YOUVERSION_BEARER_TOKEN`, `YOUVERSION_APP_ID`.
- Job recommendations now aggregate multiple live boards (Remotive + Arbeitnow) via `/api/jobs/recommendations`. Optional: `ARBEITNOW_PAGE_LIMIT` to control fetched pages.
- Use the seeded admin credentials from the backend to log in at `/login` and visit `/dashboard` for KPI visibility.

## Deployment

- Netlify redirects `/api/*` to `https://dev.nanaabaackah.com/api/:splat`, so every dashboard request lands on the upstream backend without requiring a separate server.
