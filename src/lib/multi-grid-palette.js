/**
 * Multi-Grid Color System
 * 
 * Manages multiple color calibration grids (system defaults + user grids),
 * handles merging, deduplication (prefer lowest LPC), and provides a unified
 * color palette for the application.
 */

import { colorIndex } from './color-index.js';

/**
 * Grid manifest - describes available system grids
 * Actual data will be lazy-loaded from separate files
 */
export const SYSTEM_GRID_MANIFESTS = [
    // Placeholder - will be populated when grids are created
    // {
    //     id: 'grid_uv_40_60',
    //     name: 'UV 40-60 kHz',
    //     description: 'Low frequency range - warm browns',
    //     freqRange: { min: 40, max: 60 },
    //     lpcRange: { min: 300, max: 2000 },
    //     colorCount: 985,
    //     colorTag: '#8B4513', // Visual identifier
    //     loader: () => import('./grids/uv-40-60.js')
    // }
];

/**
 * Multi-grid color palette manager
 */
export class MultiGridPalette {
    constructor() {
        this.grids = new Map(); // id -> grid data
        this.mergedPalette = []; // Deduplicated, merged entries
        this.indexBuilt = false;
    }

    /**
     * Load a grid into the palette
     * @param {Object} gridData - Grid data with entries array
     * @param {string} gridId - Unique grid identifier
     * @param {string} gridName - Human-readable name
     */
    addGrid(gridData, gridId, gridName) {
        // Tag each entry with its source grid
        const taggedEntries = gridData.entries.map(entry => ({
            ...entry,
            gridId,
            gridName,
            // Ensure color object exists
            color: entry.color || { r: 0, g: 0, b: 0 }
        }));

        this.grids.set(gridId, {
            id: gridId,
            name: gridName,
            entries: taggedEntries,
            colorCount: taggedEntries.length
        });

        // Invalidate merged palette
        this.mergedPalette = [];
        this.indexBuilt = false;
    }

    /**
     * Remove a grid from the palette
     * @param {string} gridId 
     */
    removeGrid(gridId) {
        this.grids.delete(gridId);
        this.mergedPalette = [];
        this.indexBuilt = false;
    }

    /**
     * Merge all grids into a single deduplicated palette
     * Deduplication strategy: prefer LOWEST LPC (faster engraving)
     * @returns {Array} Merged palette entries
     */
    getMergedPalette() {
        if (this.mergedPalette.length > 0) {
            return this.mergedPalette;
        }

        // Collect all entries from all grids
        const allEntries = [];
        for (const grid of this.grids.values()) {
            allEntries.push(...grid.entries);
        }

        // Deduplicate by RGB color, preferring lowest LPC
        const colorMap = new Map(); // key: "r,g,b" -> best entry

        allEntries.forEach(entry => {
            const key = `${entry.color.r},${entry.color.g},${entry.color.b}`;
            const existing = colorMap.get(key);

            if (!existing || entry.lpi < existing.lpi) {
                // This entry has lower LPC (or is first) - use it
                if (existing) {
                    // Track the replaced entry as an alternative
                    entry.alternativeSources = [
                        ...(existing.alternativeSources || []),
                        {
                            gridId: existing.gridId,
                            gridName: existing.gridName,
                            frequency: existing.frequency,
                            lpi: existing.lpi
                        }
                    ];
                } else {
                    entry.alternativeSources = [];
                }
                colorMap.set(key, entry);
            } else {
                // Current has lower LPC - add new entry as alternative
                existing.alternativeSources = existing.alternativeSources || [];
                existing.alternativeSources.push({
                    gridId: entry.gridId,
                    gridName: entry.gridName,
                    frequency: entry.frequency,
                    lpi: entry.lpi
                });
            }
        });

        this.mergedPalette = Array.from(colorMap.values());
        console.info(`MultiGridPalette: Merged ${allEntries.length} entries → ${this.mergedPalette.length} unique colors`);

        return this.mergedPalette;
    }

    /**
     * Build the color index from merged palette
     * Should be called after all grids are loaded
     */
    buildIndex() {
        const palette = this.getMergedPalette();
        colorIndex.build(palette);
        this.indexBuilt = true;
    }

    /**
     * Find best matching color for a target
     * @param {Object} targetColor - {r, g, b}
     * @returns {Object|null} Best match with metadata
     */
    findBestMatch(targetColor) {
        if (!this.indexBuilt) {
            this.buildIndex();
        }
        return colorIndex.findNearest(targetColor);
    }

    /**
     * Get statistics about the current palette
     * @returns {Object} Stats
     */
    getStats() {
        const grids = Array.from(this.grids.values());
        const totalColors = grids.reduce((sum, g) => sum + g.colorCount, 0);
        const uniqueColors = this.getMergedPalette().length;
        const indexStats = colorIndex.getStats();

        return {
            gridCount: grids.length,
            grids: grids.map(g => ({ id: g.id, name: g.name, colorCount: g.colorCount })),
            totalColors,
            uniqueColors,
            duplicatesRemoved: totalColors - uniqueColors,
            indexBuilt: this.indexBuilt,
            indexBuildTimeMs: indexStats.buildTimeMs
        };
    }

    /**
     * Clear all grids and reset
     */
    clear() {
        this.grids.clear();
        this.mergedPalette = [];
        this.indexBuilt = false;
        colorIndex.clear();
    }
}

// Singleton instance for app-wide use
export const multiGridPalette = new MultiGridPalette();

/**
 * Initialize the multi-grid palette from settings storage
 * @param {Object} settingsStorage - SettingsStorage module
 */
export async function initializeMultiGridPalette(settingsStorage) {
    multiGridPalette.clear();

    // Load active color maps from storage
    const colorMaps = settingsStorage.getColorMaps();
    const activeMaps = colorMaps.filter(m => m.active);

    console.info(`MultiGrid: Loading ${activeMaps.length} active grids...`);

    for (const map of activeMaps) {
        if (map.data && map.data.entries) {
            multiGridPalette.addGrid(map.data, map.id, map.name);
        }
    }

    // Build the index
    if (multiGridPalette.grids.size > 0) {
        multiGridPalette.buildIndex();
        console.info('MultiGrid: Palette initialized', multiGridPalette.getStats());
    } else {
        console.warn('MultiGrid: No active grids found');
    }

    return multiGridPalette;
}
