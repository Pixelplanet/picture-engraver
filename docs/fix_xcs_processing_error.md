# XCS Processing Error - Root Cause and Fix

## Date: 2026-01-22

## Issue Summary
The generated XCS test grid files opened successfully in XCS software but **failed during laser processing file generation**, while the original default grid worked perfectly.

## Root Cause

### The Problem
The default `passes` parameter was changed from **1** to **2** at some point, causing the XCS software's processing engine to fail when generating laser job files.

### Affected Parameters
In the `FILL_VECTOR_ENGRAVING` settings (and other processing types):
- **Old Working**: `repeat: 1`
- **New Broken**: `repeat: 2`

### Files Affected
1. `src/lib/test-grid-generator.js` - Default constructor
2. `src/index.html` - Custom grid UI default value

## The Fix

### Changes Made

#### 1. TestGridGenerator Constructor
**File**: `src/lib/test-grid-generator.js`  
**Line**: 27

```javascript
// BEFORE
passes: 2,

// AFTER
passes: 1,
```

#### 2. Custom Grid UI Default
**File**: `src/index.html`  
**Line**: 324

```html
<!-- BEFORE -->
<input type="number" class="input" id="gridPasses" value="2" min="1" max="10">

<!-- AFTER -->
<input type="number" class="input" id="gridPasses" value="1" min="1" max="10">
```

### Verification
Regenerated `public/default_test_grid.xcs` and confirmed:
- ✅ All 123 display settings now use `repeat: 1`
- ✅ Structure matches the old working version exactly
- ✅ File should now process correctly in XCS software

## Why This Broke Processing

The XCS laser software has specific requirements for parameter values during the processing stage. While it can **open** files with `repeat: 2`, the processing engine apparently has issues generating the actual laser job files with this parameter value for test grids.

This suggests:
1. The XCS software validates parameters differently at open-time vs. process-time
2. Multiple passes (`repeat > 1`) may conflict with the specific test grid configuration
3. The crosshatch mode combined with `repeat: 2` might exceed processing limits

## Testing Required

**User should test:**
1. Open `public/default_test_grid.xcs` in XCS software
2. Attempt to generate processing files for the laser
3. Confirm the job generates successfully

## Related Issues
This also fixes any custom grids generated from the browser UI, as the default value there has also been corrected to `passes: 1`.

## Prevention
- Document the critical parameter values that XCS software requires
- Add validation/warnings in the UI if users try to use incompatible combinations
- Compare generated files against known-working versions

## Issue: Layer Settings Ignored in XCS Export (2026-01-25)

### Problem
The XCS export was applying the global settings (power, speed, passes) to **all layers** identically, ignoring the per-layer calibration data (Frequency, LPI) determined by the application. This resulted in every layer having the exact same processing parameters.

### Fix
Modified `src/lib/xcs-generator.js` to:
1. Capture layer-specific settings (`frequency`, `lpi`, `speed`, `power`, `passes`) during the generation loop.
2. Pass these settings to the `generateDeviceData` method via a Map.
3. In `generateDeviceData`, apply the specific settings for each display element.
4. Added missing parameters `density`, `dpi` (mapped from LPI), and `bitmapScanMode` (mapped from crossHatch) to match the working Test Grid generator format.

### Verification
- Generated XCS files should now contain distinct `customize` blocks for each layer, reflecting their specific Frequency and LPI values.

