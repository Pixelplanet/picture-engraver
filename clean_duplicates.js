
import fs from 'fs';
import { DEFAULT_COLOR_MAP_DATA } from './src/lib/default-color-map.js';

function cleanDuplicates() {
    const originalEntries = DEFAULT_COLOR_MAP_DATA.entries;
    const colorMap = new Map();
    const keptEntries = [];
    let removedCount = 0;

    console.log(`Scanning ${originalEntries.length} entries...`);

    // Group by color
    originalEntries.forEach(entry => {
        const colorKey = `${entry.color.r},${entry.color.g},${entry.color.b}`;
        if (!colorMap.has(colorKey)) {
            colorMap.set(colorKey, []);
        }
        colorMap.get(colorKey).push(entry);
    });

    // Process groups
    // Convert map values to array and sort by original index/row/col order effectively if we iterate? 
    // Actually better to iterate the keys or values and collect "kept".
    // But we want to preserve order.
    // Let's just create a set of entries to REMOVE.

    const entriesToRemove = new Set();

    colorMap.forEach((duplicates, key) => {
        if (duplicates.length > 1) {
            // Sort by LPI ascending (lower is better/faster)
            // If LPI is same, maybe prefer lower frequency? User only specified LPI.
            duplicates.sort((a, b) => a.lpi - b.lpi);

            // Keep the first one (lowest LPI)
            const kept = duplicates[0];

            // Mark others for removal
            for (let i = 1; i < duplicates.length; i++) {
                entriesToRemove.add(duplicates[i]);
                console.log(`Removing duplicate RGB(${kept.color.r},${kept.color.g},${kept.color.b}) with LPI ${duplicates[i].lpi} (Kept LPI ${kept.lpi})`);
                removedCount++;
            }
        }
    });

    // Rebuild entries list preserving (mostly) original structure/order sans removed ones
    // Or just filter.
    const finalEntries = originalEntries.filter(e => !entriesToRemove.has(e));

    console.log(`\nRemoved ${removedCount} duplicates.`);
    console.log(`Remaining entries: ${finalEntries.length}`);

    // Generate JS content
    const jsContent = `/**
 * Default System Color Map
 * Extracted from calibration card 2026-01-26
 * Duplicates cleaned (preferring lower LPI)
 */

export const DEFAULT_COLOR_MAP_DATA = {
    freqRange: ${JSON.stringify(DEFAULT_COLOR_MAP_DATA.freqRange)},
    lpiRange: ${JSON.stringify(DEFAULT_COLOR_MAP_DATA.lpiRange)},
    entries: ${JSON.stringify(finalEntries, null, 4)}
};
`;

    fs.writeFileSync('src/lib/default-color-map.js', jsContent, 'utf8');
    console.log('Successfully updated src/lib/default-color-map.js');
}

cleanDuplicates();
