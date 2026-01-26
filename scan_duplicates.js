
import fs from 'fs';
import { DEFAULT_COLOR_MAP_DATA } from './src/lib/default-color-map.js';

function scanForDuplicates() {
    const entries = DEFAULT_COLOR_MAP_DATA.entries;
    const colorMap = new Map();
    const duplicates = [];

    console.log(`Scanning ${entries.length} entries for duplicate colors...`);

    entries.forEach((entry, index) => {
        const colorKey = `${entry.color.r},${entry.color.g},${entry.color.b}`;

        if (colorMap.has(colorKey)) {
            duplicates.push({
                color: entry.color,
                originalIndex: colorMap.get(colorKey),
                duplicateIndex: index,
                original: entries[colorMap.get(colorKey)],
                duplicate: entry
            });
        } else {
            colorMap.set(colorKey, index);
        }
    });

    const reportPath = 'duplicates_report_utf8.txt';
    let output = '';

    if (duplicates.length === 0) {
        output += "No exact duplicate colors found.\n";
    } else {
        output += `Found ${duplicates.length} duplicate color(s):\n`;
        duplicates.forEach(d => {
            output += `\nDuplicate RGB(${d.color.r}, ${d.color.g}, ${d.color.b})\n`;
            output += `  Original (Idx ${d.originalIndex}): Freq ${d.original.frequency}kHz, LPI ${d.original.lpi}\n`;
            output += `  Duplicate (Idx ${d.duplicateIndex}): Freq ${d.duplicate.frequency}kHz, LPI ${d.duplicate.lpi}\n`;
        });
    }

    fs.writeFileSync(reportPath, output, 'utf8');
    console.log(`Report written to ${reportPath}`);
}

scanForDuplicates();
