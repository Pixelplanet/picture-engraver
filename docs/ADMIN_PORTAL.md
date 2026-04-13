# Admin Portal

The admin portal provides a web interface for managing server-wide defaults — test grid settings and color maps — that apply to all users.

## Access

- **URL:** `https://your-domain/admin`
- **Authentication:** Bearer token set via the `ADMIN_TOKEN` environment variable.

When you open the admin panel, you'll be prompted to enter the token. It's stored in your browser's session storage and cleared when the tab is closed.

> **If `ADMIN_TOKEN` is not set**, all admin endpoints return `403 Forbidden`.

## Docker Setup

### docker run

```bash
docker run -d --name picture-engraver --restart always \
  -p 3002:80 \
  -e ADMIN_TOKEN=your-secret-token \
  -v picture-engraver-data:/app/data \
  pixelplanet/picture-engraver:latest
```

### docker-compose

Create a `.env` file alongside `docker-compose.yml`:

```
ADMIN_TOKEN=your-secret-token
```

Then run:

```bash
docker-compose up -d
```

The `picture-engraver-data` volume persists all admin settings and uploaded color maps across container restarts.

## Test Grid Defaults

The **Test Grids** tab lets you configure default parameters for each laser type's calibration test grid.

### Supported Laser Types

| Key | Description |
|---|---|
| `uv` | F2 Ultra UV laser |
| `mopa` | F2 Ultra MOPA (dual module) |
| `mopa_single` | F2 Ultra MOPA (single module) |
| `blue_ultra` | F2 Ultra Blue diode |
| `ir` | F2 IR laser |
| `blue_f2` | F2 Blue diode |

### Configurable Parameters

Each laser type has its own set of defaults. Common fields include:

- **Card dimensions**: `cardWidth`, `cardHeight` (mm)
- **Grid layout**: `cellSize`, `cellGap`, `margin` (mm)
- **Frequency range**: `freqMin`, `freqMax` (kHz)
- **LPI range**: `lpiMin`, `lpiMax` (or fixed `lpi`)
- **Power / Speed**: `power`, `speed` (or `speedMin`, `speedMax`)
- **Other**: `passes`, `crossHatch`, `material`, `pulseWidth`, `gridMode`
- **QR settings**: `qrPower`, `qrSpeed`, `qrFrequency`, `qrLpi`, `qrSize`

### Workflow

1. Select a laser type tab.
2. Edit the JSON form fields.
3. Click **Save** to publish. Changes take effect immediately for all new test grid downloads.
4. Use **Preview** to generate and download a test grid XCS with the current (unsaved) settings.
5. Use **Reset** to revert a laser type back to the hardcoded factory defaults.

## Color Map Management

The **Color Maps** tab lets you manage default color mappings that are served to all clients.

### Uploading Color Maps

Drag and drop (or click to browse) a JSON file onto the upload zone. The portal accepts three formats:

1. **Direct map** — A single color map object with `entries`, `numCols`, `numRows` etc.
2. **Export package** — `{ "maps": [...] }` as produced by the analyzer's export function.
3. **Legacy package** — `{ "grids": [...] }` from older analyzer versions.

Each map must include a `deviceType` field (e.g., `uv`, `mopa`) so it can be served to the correct clients.

### Map Actions

- **Set as Default** — Marks this map as the default for its device type. Clients will use it when they have no user-saved map.
- **Download** — Download the raw JSON map data.
- **Delete** — Permanently remove the map from the server.

### Filtering

Use the device type dropdown to filter maps by laser type, or select "All" to see everything.

### How Clients Receive Color Maps

On startup, the client app calls `GET /api/colormaps/:deviceType` to fetch server-provided maps. These are merged with built-in defaults and any user-saved maps (from localStorage). Server maps take lowest priority — if a user has saved their own map with the same ID, theirs wins.

## API Reference

### Public Endpoints (No Auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/testgrid/:laserType` | Download test grid XCS file for a laser type |
| `GET` | `/api/colormaps/:deviceType` | Get color maps for a device type |

### Admin Endpoints (Requires `Authorization: Bearer <token>`)

#### Test Grid Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/api/settings` | Get all settings |
| `PUT` | `/admin/api/settings` | Replace all settings |
| `PATCH` | `/admin/api/settings/testgrid/:laserType` | Update one laser type's defaults |
| `GET` | `/admin/api/settings/testgrid/:laserType/preview` | Download preview XCS |
| `POST` | `/admin/api/settings/reset` | Reset all settings to factory defaults |

#### Color Maps

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/api/colormaps` | List all color maps |
| `GET` | `/admin/api/colormaps/:id` | Get a single color map |
| `POST` | `/admin/api/colormaps` | Upload a new color map |
| `PUT` | `/admin/api/colormaps/:id` | Replace an existing color map |
| `DELETE` | `/admin/api/colormaps/:id` | Delete a color map |
| `POST` | `/admin/api/colormaps/:id/set-default` | Set a map as the default for its device type |

### Authentication

All `/admin/api/*` endpoints require the header:

```
Authorization: Bearer <ADMIN_TOKEN>
```

Responses:
- `401` — Missing or malformed token
- `403` — Token does not match `ADMIN_TOKEN`

### Rate Limiting

- Admin endpoints: 30 requests/minute
- Public endpoints: 10 requests/minute

## Data Storage

All admin data is stored as JSON files in the `DATA_DIR` directory (default: `/app/data`):

```
/app/data/
  admin-settings.json     # Test grid defaults
  color-maps/             # One JSON file per color map
    <map-id>.json
    <map-id>.json
```

Mount this directory as a Docker volume to persist data across container restarts.
