# dev

This folder builds the standalone KPI dashboard served at `dev.nanaabaackah.com`. The frontend reuses the KPI routes from the `nanaabaackah.com` backend, so it never needs to spin up its own API.

## Local setup

- Set `VITE_API_BASE=https://nanaabaackah.com` (or your preferred API host) in `.env` before running `npm run dev` or `npm run build`. The helper in `src/api-url.js` normalizes that base and still falls back to relative `/api/*` calls when the variable is empty.
- Use the seeded admin credentials from the backend to log in at `/login` and visit `/dashboard` for KPI visibility.

## Deployment

- Netlify redirects `/api/*` to `https://nanaabaackah.com/api/:splat`, so every dashboard request lands on the upstream backend without requiring a separate server.
