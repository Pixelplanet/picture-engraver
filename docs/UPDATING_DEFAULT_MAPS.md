# Updating System Default Color Map Data

This document outlines the procedure for updating the hardcoded system default color map and calibration grid image. Follow these steps to ensure future agents or developers can update the baseline calibration data efficiently.

## Prerequisites
- A exported JSON file from the application's "Analyzer" tab (e.g., `new_system_default.json`).
- Node.js installed locally.

## Step-by-Step Update Process

### 1. Identify the Source Data
The source JSON file contains a `maps` array. Usually, the first map (`maps[0]`) contains the desired calibration data. The core data needed is held within the `data` property of that map object, including:
- `entries`: Array of RGB colors and their corresponding frequency/LPI.
- `gridImage`: Object containing the base64 encoded calibration image and corner coordinates.
- `numCols` / `numRows`: The grid dimensions.

### 2. Update the Library File
The hardcoded data lives in `src/lib/default-color-map.js`. 

**Action**: Use a script or manual edit to replace the `DEFAULT_COLOR_MAP_DATA` constant with the `data` object from your source JSON.

Example conversion script (ESM):
```javascript
import fs from 'fs';
import path from 'path';

const sourceJson = JSON.parse(fs.readFileSync('./new_system_default.json', 'utf8'));
const data = sourceJson.maps[0].data;

const content = `/**
 * Default System Color Map
 * Updated on ${new Date().toISOString()}
 */
export const DEFAULT_COLOR_MAP_DATA = ${JSON.stringify(data, null, 4)};`;

fs.writeFileSync('./src/lib/default-color-map.js', content);
```

### 3. Force a Local Storage Refresh
The application stores color maps in the browser's `localStorage`. Simply updating the `.js` file will **not** update existing users' data because the app sees the map ID is already present.

**Action**: 
1. Open `src/lib/settings-storage.js`.
2. Locate the `ensureSystemDefaultMap()` method.
3. Increment the `defaultId` version string (e.g., change `system_default_v6` to `system_default_v7`).

```javascript
// src/lib/settings-storage.js
ensureSystemDefaultMap() {
    const defaultId = 'system_default_v7'; // Increment this digit to force update
    // ... logic to inject maps[0] if ID missing
}
```

### 4. Verify the Update
1. Restart the dev server (`npm run dev`).
2. Hard-refresh the browser (Ctrl+F5).
3. The app will detect the missing `v7` ID, load the new data from `DEFAULT_COLOR_MAP_DATA`, and inject it into the local database as the new default.

## Important Note on Grid Images
The `gridImage.base64` string in the JSON is often very large (~50KB+). When using tools to edit these files, be careful not to truncate the file content. Using a script to write the file is always safer than manual copy-pasting.
