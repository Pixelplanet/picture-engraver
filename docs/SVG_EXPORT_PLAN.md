# SVG Export (Virtual Device) Implementation Plan

## Overview
Add a "Virtual Device" option that switches the application from Laser Engraving mode (XCS/G-code output) to **Vector Illustration mode (SVG output)**. This simplifies the UX by removing laser-specific settings (Power, Speed, Frequency) and the Test Grid calibration workflow, offering pure vectorization and coloring capabilities.

## Goals
1.  **New Device Profile**: "SVG Export (Vector Only)".
2.  **Simplified UI**: Hide laser settings, Test Grid analyzer, and calibration prompts when this device is active.
3.  **Direct Export**: "Export XCS" button becomes "Export SVG".
4.  **Color Management**:
    -   Default: Layers use the colors found during quantization.
    -   Override: User can manually pick a visual color for each layer (standard palette or color picker), bypassing the freq/speed mapping logic.

---

## 1. Device Profile Update
**File**: `src/lib/settings-storage.js`

Add a new profile definition:
```javascript
'svg_export': {
    id: 'svg_export',
    name: 'SVG Vector Export',
    description: 'Export strict SVG vectors without laser settings',
    type: 'virtual', // New property to flag behavior
    settings: {
        // Minimal visual defaults if needed, but mostly ignored
        defaultWidth: 200,
        defaultHeight: 200
    }
}
```

## 2. Main Logic Adaptation
**File**: `src/main.js`

### A. Settings UI
-   Modify `loadSettings()`: Check `activeDevice.type === 'virtual'`.
-   If Virtual:
    -   Hide `#settingsPanel` sections related to Laser (Speed, Power, Frequency, LPI).
    -   Hide `#tabAnalyzer` (Test Grid Analysis) entirely or disable it.
    -   Change "Download XCS" button text to "Download SVG".

### B. Layer Editing (Color Selection)
-   Current logic uses `handleLayerClick` to open a mapping dialog.
-   **Change**: If `activeDevice.id === 'svg_export'`:
    -   Do NOT show the mapping grid (Frequency/LPI).
    -   Instead, show a **Simple Color Picker**:
        -   HTML5 `<input type="color">` or a preset palette of generic colors.
    -   On selection: Update the layer's visual color directly in `state.layers`.

### C. Export Logic
-   Create `downloadSVG()` function.
-   Reuse `Vectorizer.generateSVGPreview()` logic but ensure it produces a standalone, valid SVG file.
-   Includes:
    -   Correct viewbox matching document size (mm converted to pixels).
    -   All layers with their assigned fill colors.
    -   Metadata comment (APP version, date).
-   Hook this function to the main Export button when in SVG mode.

## 3. Implementation Steps

### Step 1: Configuration
-   [ ] Update `settings-storage.js` with the new profile.

### Step 2: UI Context Switching
-   [ ] Update `main.js`: `updateSettingsUI()` to toggle visibility of laser controls.
-   [ ] Update `main.js`: Toggle "Top Bar" tabs (hide Analyzer) when SVG mode is active.

### Step 3: Color Override Logic
-   [ ] Modify Layer Edit Modal (`#layerEditModal`? or new modal?) to support "Visual Color Pick" mode.
-   [ ] Allow saving the new color to the layer state without LPI/Freq data.

### Step 4: Export Functionality
-   [ ] Implement `exportSVG` function.
-   [ ] ensure correct scaling (mm to px, typically 96 DPI or similar standard for SVG).

## 4. Technical Nuances

-   **Scaling**: XCS uses 10px/mm (usually). SVG standard is often 96 DPI (approx 3.78 px/mm) or 72 DPI. We should stick to **user-defined mm size** and set `width="Xmm" height="Ymm"` in the SVG header to be software-agnostic.
-   **Vectorizer**: The existing `vectorizer.js` already produces SVG path strings (`d="..."`). We just need to wrap them in `<path>` tags with correct `fill` attributes.

---

## 5. Verification Plan
-   Select "SVG Vector Export" in device list.
-   Verify Laser Settings disappear.
-   Import image -> Vectorize.
-   Click a layer -> Verify simple color picker appears.
-   Click Export -> Verify `.svg` file is downloaded.
-   Open SVG in browser/Illustrator to verify layers and colors.
