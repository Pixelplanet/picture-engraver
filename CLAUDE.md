# engraver (lasertools subproject)

Folder: `projects/lasertools/engraver` (own git repo, GitHub Pixelplanet/picture-engraver). Stay inside this folder;
see ../CLAUDE.md, ../../../CLAUDE.md and ../../../docs/HOST.md. Running copies of this app on the host are
production/test: never deploy, restart containers or touch /opt/* without explicit approval.

## Overview
"Picture Engraver": converts images into xTool F2 / F2 Ultra laser files (.xcs, .xs, SVG) for colour engraving on
stainless steel (colour = laser frequency/LPI looked up from a calibrated "color map"). Also generates calibration
test grids and analyses photographed grids. Licence CC-BY-NC-SA-4.0.

- **Frontend** (all image processing happens in the browser): vanilla JS + Vite. `src/index.html`, `src/main.js`
  (~7.8k lines, all UI logic), `src/admin.html` (admin UI, inline script), `src/lib/*` (quantizer, vectorizer/potrace,
  xcs/xs generators, test-grid generator, device/material registries, settings in localStorage).
- **Backend**: small Express server (`server.js` + `admin-routes.js`, ESM). Serves `dist/`, `/api/log` (client
  telemetry -> console + optional file log), `/health`, public API `/api/testgrid/:laser` (generates .xcs on the fly,
  cached in memory), `/api/testgrid-defaults/:laser`, `/api/colormaps/:deviceType`, `/api/visibility`, and bearer-token
  admin API under `/admin/api/*` (settings, color maps). `/admin` serves the admin SPA.
- **Storage**: JSON files in `DATA_DIR` (default `./data`, `/app/data` in Docker): `admin-settings.json`
  (+ `-backup-<ts>.json` on every save) and `color-maps/<id>.json`. No database. No other external services.
- **Auth**: single shared `ADMIN_TOKEN` env var (Bearer header; admin disabled with 403 if unset). Token kept in
  sessionStorage in the browser. Everything else is public.

## Build / test / run (locally, nothing touches prod)
```
npm install                 # heavy: devDep `canvas` needs native libs; prefer nice/ulimit, or skip if only reading
npm run dev                 # vite dev server (frontend only, no express API)
npm run build && ADMIN_TOKEN=x PORT=3999 DATA_DIR=./data LOG_DIR=./logs node server.js   # full app on 127.0.0.1-ish port (binds 0.0.0.0! pick a free port, check `ss -tlnp`)
npm run test:unit -- --run  # vitest (src/lib/*.test.js, includes admin-routes via supertest)
npm run test:e2e            # playwright (tests/e2e), heavier
```
`data/` and `logs/` are not gitignored - do not commit them. Port default is 80 if PORT unset.

## Deploy flow
- `.github/workflows/docker-build.yml`: any push to `main` (or v*.*.* tag) builds `pixelplanet/picture-engraver`
  (:latest, :sha-xxxxxxx) on Docker Hub, then calls the Portainer API to recreate the **`engraver-test`** container
  (pull latest). So **a push to main immediately updates the test instance on this host. Never push/merge without approval.**
- Production is deployed separately via the lasertools infra repo.
- Dockerfile: multi-stage, node:18-alpine; prod stage copies only server.js, admin-routes.js, dist and a hand-picked
  list of `src/lib/*.js` files. **If server code starts importing another src/lib file, add a COPY line** or the container
  crashes at runtime (tests won't catch it). Container starts via `docker-entrypoint.sh` (root only to chown volumes, then su-exec node).
  `docker-compose.yml` maps 3002:80 (do not use on this host without checking ports).

## Gotchas
- Server sits behind Caddy (`trust proxy` = 1). Use `req.ip` for client IP (not the raw X-Forwarded-For header).
- helmet is enabled with CSP disabled (inline scripts in index.html/admin.html). No node/npm on this host: tests cannot be run here.
- Test-grid XCS cache is invalidated only by settings save/reset, not by visibility/capabilities changes.
- See `REVIEW.md` for the code review; most findings were fixed (container now drops to `node` via entrypoint + su-exec; color map ids validated; helmet enabled without CSP).
