# Admin Interface & Dynamic Default Grids — Design Concept

## Overview

This document proposes a **lightweight admin interface** for maintaining default laser settings and transitioning default test grids from pre-generated static `.xcs` files to **on-the-fly generation** using the existing `TestGridGenerator`.

---

## Part 1: Admin Interface

### Architecture Decision

**Approach: Server-side admin panel at `/admin` with token-based auth and JSON file storage.**

Why this approach:
- No database needed — settings are a small JSON blob, perfect for file storage
- Fits the existing Express server with minimal additions
- Self-contained: no external auth provider or database dependency
- Docker-friendly: settings file persists via volume mount (same as logs)

### Authentication

- **Single admin token** set via environment variable `ADMIN_TOKEN`
- Token is sent as a `Bearer` header on all admin API requests
- The admin UI prompts for the token on first visit and stores it in `sessionStorage` (not localStorage — cleared when browser closes)
- If `ADMIN_TOKEN` is not set, admin routes return 403 (disabled by default)

```
# docker-compose.yml
environment:
  - ADMIN_TOKEN=your-secure-random-token-here
```

### Settings Storage

**File**: `/app/data/admin-settings.json` (persisted via Docker volume, same pattern as logs)

```json
{
  "_version": 1,
  "_modified": "2025-01-26T12:00:00Z",
  "testGridDefaults": {
    "uv": {
      "cardWidth": 86,
      "cardHeight": 54,
      "cellSize": 5,
      "cellGap": 1,
      "margin": 1,
      "lpiMin": 500,
      "lpiMax": 2000,
      "freqMin": 40,
      "freqMax": 90,
      "power": 70,
      "speed": 425,
      "passes": 1,
      "crossHatch": true,
      "material": "stainless_304",
      "qrPower": 17.5,
      "qrSpeed": 150,
      "qrSize": 12,
      "qrFrequency": 90,
      "qrLpi": 2500
    },
    "mopa": {
      "cardWidth": 86,
      "cardHeight": 54,
      "cellSize": 5,
      "cellGap": 1,
      "margin": 1,
      "gridMode": "power",
      "lpi": 5000,
      "freqMin": 200,
      "freqMax": 1200,
      "power": 14,
      "speedMin": 200,
      "speedMax": 1200,
      "pulseWidth": 80,
      "passes": 1,
      "material": "stainless_304",
      "qrPower": 17.5,
      "qrSpeed": 150,
      "qrFrequency": 90,
      "qrLpi": 2500
    },
    "mopa_single": {
      "...same structure as mopa, different defaults..."
    },
    "blue_ultra": {
      "...same structure, TBD defaults..."
    },
    "ir": {
      "...same structure, different ranges..."
    },
    "blue_f2": {
      "...same structure, different ranges..."
    }
  },
  "materialOverrides": {
    "stainless_304": {
      "mopa": { "power": 14, "speed": 400, "frequency": 200, "lpi": 5000, "pulseWidth": 80, "passes": 1 },
      "uv": { "power": 70, "speed": 425, "frequency": 40, "lpi": 1000, "passes": 1 }
    }
  }
}
```

### API Endpoints

All admin endpoints require `Authorization: Bearer <ADMIN_TOKEN>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/api/settings` | Get current admin settings |
| `PUT` | `/admin/api/settings` | Replace all settings (full JSON) |
| `PATCH` | `/admin/api/settings/testgrid/:laserType` | Update defaults for one laser type |
| `GET` | `/admin/api/settings/testgrid/:laserType/preview` | Generate preview grid (returns XCS JSON) |
| `POST` | `/admin/api/settings/reset` | Reset to hardcoded defaults |

### Admin UI

**Route**: `/admin` — served as a separate small HTML page (not part of the SPA).

Layout:
```
┌─────────────────────────────────────────────┐
│  Picture Engraver Admin Panel               │
├─────────────────────────────────────────────┤
│                                             │
│  [Tab: UV] [Tab: MOPA] [Tab: MOPA Single]  │
│  [Tab: Blue Ultra] [Tab: IR] [Tab: Blue F2] │
│                                             │
│  ┌─ Test Grid Defaults ──────────────────┐  │
│  │  Card Width:  [86] mm                 │  │
│  │  Card Height: [54] mm                 │  │
│  │  Cell Size:   [5]  mm                 │  │
│  │  Cell Gap:    [1]  mm                 │  │
│  │  Margin:      [1]  mm                 │  │
│  │                                       │  │
│  │  --- Laser Parameters ---             │  │
│  │  (fields change based on laser type)  │  │
│  │  Power:     [70]  %                   │  │
│  │  Speed:     [425] mm/s                │  │
│  │  Freq Min:  [40]  kHz                 │  │
│  │  Freq Max:  [90]  kHz                 │  │
│  │  LPI Min:   [500]                     │  │
│  │  LPI Max:   [2000]                    │  │
│  │  ...                                  │  │
│  │                                       │  │
│  │  [Preview Grid] [Save] [Reset to Def] │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌─ Material Defaults (Stainless 304) ───┐  │
│  │  Power: [14]  Speed: [400]            │  │
│  │  Freq:  [200] LPI: [5000]            │  │
│  │  PulseWidth: [80]                     │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

**Implementation**: Single static HTML file with vanilla JS (no framework). ~200 lines. Fetches from admin API.

### Security Measures

1. **Auth required**: All admin routes check `ADMIN_TOKEN` env var
2. **Rate limiting**: Admin endpoints have their own stricter rate limiter (10 req/min)
3. **Input validation**: Server validates all settings against known schemas before saving
4. **No shell execution**: Settings are pure data — never used in exec/eval
5. **CSRF protection**: Token auth via header (not cookies) prevents CSRF
6. **Settings backup**: Each save writes a timestamped backup before overwriting

---

## Part 2: Dynamic Default Test Grid Generation

### Current State

- `public/default_test_grid_UV.xcs` and `public/default_test_grid_MOPA.xcs` are pre-generated static files
- These are downloaded directly when the user requests a default test grid
- No generation happens — just a file download

### Proposed Change

**Replace static file downloads with server-side on-the-fly generation using `TestGridGenerator`.**

### New API Endpoint

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/testgrid/:laserType` | Generate and return a test grid XCS file |

Query params: none (uses admin-configured defaults or hardcoded fallbacks)

### Flow

```
User clicks "Download Default Test Grid"
  → Frontend calls GET /api/testgrid/uv (or /mopa, etc.)
  → Server loads admin settings (or falls back to hardcoded defaults)
  → Server instantiates TestGridGenerator with those settings
  → Server calls generateBusinessCardGrid()
  → Returns .xcs file with Content-Disposition: attachment
```

### Client-Side Changes

In `main.js`, replace the static file path reference:
```js
// Before:
const url = `/default_test_grid_${laserLabel}.xcs`;

// After:
const settingsKey = getSettingsKey(activeDevice, activeLaserType);
const url = `/api/testgrid/${settingsKey}`;
```

### Caching Strategy

- Server caches generated XCS per laser type in memory
- Cache invalidated when admin saves new settings
- Response includes `ETag` based on settings hash for browser caching
- Cache TTL: until next settings change (no time-based expiry needed)

### Fallback

If admin settings file doesn't exist, use the hardcoded defaults from `material-registry.js` and `TestGridGenerator` constructor defaults. This ensures the system works out of the box without any admin configuration.

### Migration

1. Add the `/api/testgrid/:laserType` endpoint to `server.js`
2. Update client-side download logic to use the new endpoint
3. Keep `public/default_test_grid_*.xcs` files temporarily as fallback
4. Remove static files once the new endpoint is confirmed stable

---

## Part 3: Implementation Order

1. **Add admin settings file loading to server.js** (read JSON, fallback to defaults)
2. **Add admin auth middleware** (check `ADMIN_TOKEN` env var)
3. **Add admin API endpoints** (GET/PUT/PATCH settings)
4. **Add `/api/testgrid/:laserType` endpoint** (on-the-fly generation)
5. **Create admin UI** (static HTML page)
6. **Update client-side** to use `/api/testgrid/:laserType` instead of static files
7. **Remove static default grid files** from `public/`
8. **Update docker-compose.yml** to add `ADMIN_TOKEN` env var and data volume

### File Changes Summary

| File | Change |
|------|--------|
| `server.js` | Add admin middleware, admin API routes, testgrid endpoint |
| `src/admin.html` | New — admin panel UI |
| `src/main.js` | Update default grid download URL |
| `docker-compose.yml` | Add `ADMIN_TOKEN` env, data volume |
| `public/default_test_grid_*.xcs` | Remove (after migration) |

### Estimated Complexity

- Server-side: ~150-200 lines added to `server.js` (or extracted to `admin-routes.js`)
- Admin UI: ~200-250 lines (single HTML file)
- Client changes: ~5 lines (URL change)
- Total: ~400 lines of new code
