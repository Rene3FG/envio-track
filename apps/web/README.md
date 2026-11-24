# EnvíoTrack Web

The web app contains the admin dispatch console, the public tracking portal at
`/tracking/:guia`, and the admin-only metrics dashboard at `/stats`.

## Local development

Run commands from the repository root:

```powershell
npm ci
npm run dev --workspace @enviotrack/web
```

Vite proxies `/api` and `/uploads` to `http://localhost:3000`. The tracking
endpoint is public; `/stats` requires an authenticated ADMIN account.

## Build and end-to-end tests

The Playwright flow mocks API responses so it can run without a database or a
deployed API. It covers login, package creation, public tracking without a
saved login, and opening delivery evidence.

```powershell
npm run build --workspace @enviotrack/web
npx playwright install chromium
npm run test:e2e --workspace @enviotrack/web
```

## Docker and Render

Build the multi-stage web image from the repository root:

```powershell
docker build -f apps/web/Dockerfile -t enviotrack-web .
docker run --rm -p 8080:80 -e API_UPSTREAM=https://api.example.com enviotrack-web
```

Nginx serves the SPA, proxies `/api` and `/uploads` to `API_UPSTREAM`, and
provides `/healthz` for container health checks. Set `API_UPSTREAM` to the API
origin only (no trailing slash or `/api` suffix).

To deploy on Render, connect the repository and use the root `render.yaml` Blueprint.
Set `API_UPSTREAM` in the Render service environment to the deployed API origin.
