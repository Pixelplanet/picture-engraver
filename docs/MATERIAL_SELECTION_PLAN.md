# Material Selection Feature — Implementation Plan

## Overview

Add a material selection dropdown to both UV and MOPA laser workflows. Each material has its own xTool Studio material ID, default laser parameters, and color mapping. The QR code must encode the selected material so scanned grids auto-apply correct settings.

---

## Phase 1: Data Model & Material Registry

### 1.1 Create Material Registry (`src/lib/material-registry.js`)

Central source of truth for all material definitions:

```js
export const MATERIALS = {
  stainless_304: {
    id: 'stainless_304',
    name: '304 Stainless Steel',
    xtoolMaterialId: 1323,       // xTool Studio material code
    lasers: ['uv', 'mopa'],     // Which lasers support this material
    defaults: {
      mopa: {
        power: 14, speed: 400, frequency: 200, lpi: 5000,
        pulseWidth: 80, passes: 1,
        powerRange: [12, 16], speedRange: [200, 1200], freqRange: [200, 1200]
      },
      uv: {
        power: 70, speed: 425, frequency: 40, lpi: 1000,
        passes: 1,
        freqRange: [40, 90], lpiRange: [300, 800]
      }
    }
  },
  titanium: {
    id: 'titanium',
    name: 'Titanium',
    xtoolMaterialId: 458,        // xTool Studio material code (confirmed)
    lasers: ['uv', 'mopa'],
    defaults: {
      mopa: { /* TBD — needs real test grids; currently mirrors stainless as placeholder */ },
      uv: { /* TBD */ }
    }
  }
  // Future: aluminum, copper, brass, anodized_aluminum, etc.
};

export function getMaterialsForLaser(laserType) { /* filter by lasers[] */ }
export function getMaterialById(id) { /* lookup */ }
export function getXtoolMaterialId(materialId) { /* return xtoolMaterialId */ }
```

### 1.2 Considerations
- Material IDs are stable string keys (not xTool numeric IDs) for internal use
- xTool numeric IDs are only used when generating XCS LASER_PLANE output
- New materials can be added without changing any other code — just add to registry
- Each material can support a different set of lasers
- Each material+laser combo has its own default parameters and ranges
- **Dev mode gate**: Material selector is hidden behind dev mode (`?dev=1` URL param or `localStorage.setItem('pe_dev_mode','true')`) until titanium defaults are validated and color maps are built

---

## Phase 2: UI — Material Dropdown

### 2.1 Add Dropdown to `src/index.html`

Place a material selector above or alongside the device selector, visible in both Standard Grid and Custom Grid tabs:

```html
<label for="materialSelect">Material</label>
<select id="materialSelect" class="input">
  <!-- Populated dynamically based on active laser -->
</select>
```

### 2.2 Dynamic Population in `main.js`

- On device change (UV ↔ MOPA): repopulate dropdown with `getMaterialsForLaser()`
- On material change: update all default values (standard grid params, custom grid inputs)
- Persist selected material in `settings-storage.js`

### 2.3 Update `updateTestGridUI()`

Current function sets MOPA vs UV defaults. Refactor to:
1. Read selected material from dropdown
2. Pull defaults from material registry for that material+laser combo
3. Populate all input fields from material defaults
4. No more hardcoded values in `updateTestGridUI()` — all driven by registry

---

## Phase 3: QR Code Encoding

### 3.1 Current QR Payload (no material field)

**UV v1:**
```json
{ "v": 1, "l": [max, min, cols], "f": [min, max, rows], "p": power, "s": speed, "t": "uv" }
```

**MOPA v3:**
```json
{ "v": 3, "ax": "p", "f": [min, max], "p": [min, max], "s": [min, max], "r": rows, "c": cols, "l": lpi, "pw": pulseWidth, "t": "mopa" }
```

### 3.2 Add Material to QR Payload

Bump version numbers and add `m` field:

**UV v2:**
```json
{ "v": 2, ..., "m": "stainless_304" }
```

**MOPA v4:**
```json
{ "v": 4, ..., "m": "stainless_304" }
```

### 3.3 Backward Compatibility

- QR decoder must handle v1/v3 (no material → assume stainless_304 as legacy default)
- QR encoder always writes latest version with material field
- Material string key is compact enough for QR capacity (keep keys short)

### 3.4 Update `encodeSettings()` and `analyzeImage()`

In `test-grid-generator.js`:
- `encodeSettings()`: add `m: materialId` to QR JSON payload
- `analyzeImage()` / QR parse: read `m` field, fall back to `'stainless_304'` if absent

---

## Phase 4: Color Mapping Per Material

### 4.1 Problem

Currently one color map per device type. Different materials will produce different color responses — a setting that marks dark on stainless may be light on titanium. The color-to-settings lookup must know which material was used.

### 4.2 Approach

Extend `default-color-map.js` entries with material context:

```js
{
  id: 'system_default_mopa_stainless',
  deviceType: 'f2_ultra_mopa',
  materialId: 'stainless_304',
  name: 'MOPA - 304 Stainless',
  data: { entries: [ /* color→settings mappings */ ] }
}
```

### 4.3 `MultiGridPalette` / `ColorIndex` Changes

- `getMergedPalette()` needs a material filter parameter
- When assigning layers to an image, use palette for active device + active material
- Fallback: if no material-specific palette exists, use device-only palette

### 4.4 Grid Generator Color Output

- The HSL gradient is purely visual (for xTool Studio layer identification)
- It does NOT need to change per material — it's just unique-per-cell coloring
- The mapping FROM those colors BACK to laser settings is what's material-specific
- This mapping lives in `default-color-map.js` entries, keyed by material

---

## Phase 5: XCS Generator Updates

### 5.1 `xcs-generator.js`

- Accept `materialId` parameter
- Look up `xtoolMaterialId` from registry
- Set `LASER_PLANE.material` dynamically (currently hardcoded to 1323)

### 5.2 `test-grid-generator.js`

- Accept `materialId` in settings
- Use material's `xtoolMaterialId` for LASER_PLANE
- Use material's default ranges for grid generation
- Include material in QR encoding

---

## Phase 6: Settings Persistence

### 6.1 `settings-storage.js`

Add field:
```js
{
  ...existingSettings,
  material: 'stainless_304',  // New: selected material ID
}
```

- Version bump to 2.1 (or handle migration)
- Default to `'stainless_304'` for existing users (no breaking change)

---

## Phase 7: Additional Considerations

### 7.1 Download Filenames

All exported files should include context in the filename:

**Image processing export (XCS download):**
```
engraving_{originalImageName}_F2_{LaserType}_{Material}.xcs
// e.g.: engraving_my_logo_F2_MOPA_Stainless.xcs
```

**Custom grid export:**
```
CustomGrid_F2_{LaserType}_{Material}_S{min}-{max}_F{min}-{max}.xcs
// e.g.: CustomGrid_F2_MOPA_Stainless_S200-1200_F200-1200.xcs
```

**Original image name**: Stored in `state.originalImageName` when file is loaded. Sanitized (non-alphanumeric → `_`, max 40 chars).

### 7.2 UI Feedback

- Show selected material name in Standard Grid description text
- Consider showing material in the grid preview/download confirmation

### 7.3 Landing Page / Onboarding

- Material selection should be introduced in onboarding flow
- Landing page device cards could mention supported materials

### 7.4 Future: User-Defined Materials

- Allow users to create custom materials with their own parameter ranges
- Store in localStorage alongside settings
- Not in scope for Phase 1, but keep data model extensible

### 7.5 Future: Material-Specific Optimized Ranges

- Once users test titanium grids, we can refine the default ranges
- Registry makes this a single-file update

### 7.6 Default XCS File Generation

- Need to regenerate `public/default_test_grid_MOPA.xcs` and `public/default_test_grid_UV.xcs` after material support is added
- Consider generating per-material default grids if defaults differ significantly

### 7.7 Test Coverage

- Unit tests for material registry lookup functions
- Unit tests for QR encode/decode with material field (and backward compat)
- Update existing test-grid-generator tests to pass materialId
- E2E tests for material dropdown interaction

---

## Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Create material registry | `src/lib/material-registry.js` |
| 2 | Add material dropdown to HTML | `src/index.html` |
| 3 | Wire dropdown population + defaults | `src/main.js` |
| 4 | Persist material in settings | `src/lib/settings-storage.js` |
| 5 | Add material to QR encode/decode | `src/lib/test-grid-generator.js` |
| 6 | Dynamic material ID in XCS output | `src/lib/xcs-generator.js`, `src/lib/test-grid-generator.js` |
| 7 | Material-keyed color maps | `src/lib/default-color-map.js` |
| 8 | Filter palette by material | `src/lib/multi-grid-palette.js`, `src/lib/color-index.js` |
| 9 | Update filenames | `src/main.js` |
| 10 | Add titanium (once material ID known) | `src/lib/material-registry.js` |
| 11 | Tests | `*.test.js` |
| 12 | Regenerate default XCS files | `public/` |

---

## Blocked / Pending

- **Titanium xTool Material ID**: User will look up in xTool Studio
- **Titanium default parameters**: Need test grids on titanium to determine optimal ranges
- **Titanium color response**: May need separate calibration grids before color maps can be built
