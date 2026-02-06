import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADVANCED_GRID_PATH = path.join(__dirname, '../new-advanced-default-testgrid.json');
const CURRENT_LIB_PATH = path.join(__dirname, '../src/lib/default-color-map.js');

function run() {
    console.log("Starting grid update process...");

    // 1. Read Advanced Grid
    if (!fs.existsSync(ADVANCED_GRID_PATH)) {
        console.error(`Error: Advanced grid file not found at ${ADVANCED_GRID_PATH}`);
        process.exit(1);
    }
    console.log("Reading new advanced grid...");
    const advancedGridRaw = fs.readFileSync(ADVANCED_GRID_PATH, 'utf8');
    const advancedGridJson = JSON.parse(advancedGridRaw);

    // Extract data - check if it's an export format (has grids array) or direct data
    let advancedData;
    if (advancedGridJson.grids && Array.isArray(advancedGridJson.grids) && advancedGridJson.grids.length > 0) {
        advancedData = advancedGridJson.grids[0].data;
        console.log(`Extracted data from grid: ${advancedGridJson.grids[0].name}`);
    } else if (advancedGridJson.maps && Array.isArray(advancedGridJson.maps) && advancedGridJson.maps.length > 0) {
        advancedData = advancedGridJson.maps[0].data;
        console.log(`Extracted data from map: ${advancedGridJson.maps[0].name}`);
    } else if (advancedGridJson.entries && advancedGridJson.gridImage) {
        advancedData = advancedGridJson;
        console.log("File appears to be direct map data.");
    } else {
        console.error("Could not verify structure of advanced grid JSON. Keys found: " + Object.keys(advancedGridJson).join(', '));
        process.exit(1);
    }

    // 2. Read Current Basic Grid
    console.log("Reading existing default-color-map.js...");
    let basicData;
    const currentLibContent = fs.readFileSync(CURRENT_LIB_PATH, 'utf8');

    // Try to extract the JSON object
    // We look for everything between "export const DEFAULT_COLOR_MAP_DATA =" and the end of file (ignoring potential trailing semicolon)
    // We'll utilize a simpler approach: finding the first '{' and assuming the rest is JSON (minus semicolon)
    const startIndex = currentLibContent.indexOf('{');
    const lastSemi = currentLibContent.lastIndexOf(';');
    const endIndex = lastSemi > startIndex ? lastSemi : currentLibContent.length;

    if (startIndex > 0) {
        try {
            const basicJsonStr = currentLibContent.substring(startIndex, endIndex);
            basicData = JSON.parse(basicJsonStr);
            console.log("Successfully parsed existing default map data.");
        } catch (e) {
            console.error("Failed to parse existing JS file content as JSON:", e.message);
            // Fallback: Use a regex that might be more robust?
            // Or maybe the user *already* ran this and the file format changed?
            // Check if parsing SYSTEM_DEFAULTS
            if (currentLibContent.includes("export const SYSTEM_DEFAULTS")) {
                console.log("File already converted to new format? Aborting to prevent data loss.");
                process.exit(1);
            }
            process.exit(1);
        }
    } else {
        console.error("Could not find start of object in default-color-map.js");
        process.exit(1);
    }

    // 3. Generate New Content
    console.log("Generating new library file...");

    const newContent = `/**
 * Default System Color Maps
 * Generated automatically
 * Updated on ${new Date().toISOString()}
 */

export const SYSTEM_DEFAULTS = [
    {
        id: 'system_default_basic',
        name: 'System Default',
        description: 'Standard calibration grid',
        data: ${JSON.stringify(basicData, null, 4)}
    },
    {
        id: 'system_default_advanced',
        name: 'Advanced System Default',
        description: 'Advanced calibration grid',
        data: ${JSON.stringify(advancedData, null, 4)}
    }
];
`;

    fs.writeFileSync(CURRENT_LIB_PATH, newContent);
    console.log(`Success! Updated ${CURRENT_LIB_PATH}`);
}

run();
