/**
 * Color Index - K-D Tree based fast color matching
 * 
 * Uses a k-d tree for O(log n) nearest-neighbor color lookup,
 * essential for performant matching across ~3000 colors.
 */

import { kdTree } from 'kd-tree-javascript';

/**
 * Euclidean distance between two RGB colors
 * @param {Object} a - Color {r, g, b}
 * @param {Object} b - Color {r, g, b}
 * @returns {number} Distance
 */
function colorDistance(a, b) {
    return Math.sqrt(
        Math.pow(a.r - b.r, 2) +
        Math.pow(a.g - b.g, 2) +
        Math.pow(a.b - b.b, 2)
    );
}

/**
 * Match quality thresholds
 */
export const MATCH_QUALITY = {
    EXCELLENT: { maxDistance: 20, label: 'Excellent' },
    GOOD: { maxDistance: 50, label: 'Good' },
    APPROXIMATE: { maxDistance: 100, label: 'Approximate' },
    POOR: { maxDistance: Infinity, label: 'Poor' }
};

/**
 * Get match quality label based on color distance
 * @param {number} distance - Color distance
 * @returns {string} Quality label
 */
export function getMatchQuality(distance) {
    if (distance <= MATCH_QUALITY.EXCELLENT.maxDistance) return MATCH_QUALITY.EXCELLENT.label;
    if (distance <= MATCH_QUALITY.GOOD.maxDistance) return MATCH_QUALITY.GOOD.label;
    if (distance <= MATCH_QUALITY.APPROXIMATE.maxDistance) return MATCH_QUALITY.APPROXIMATE.label;
    return MATCH_QUALITY.POOR.label;
}

export class ColorIndex {
    constructor() {
        this.tree = null;
        this.entries = [];
        this.buildTime = 0;
    }

    /**
     * Build the k-d tree from color entries
     * @param {Array} entries - Array of color entries with {color: {r,g,b}, ...}
     */
    build(entries) {
        const startTime = performance.now();

        this.entries = entries;

        // Transform entries for k-d tree (needs flat r,g,b properties)
        const points = entries.map((entry, index) => ({
            r: entry.color.r,
            g: entry.color.g,
            b: entry.color.b,
            _index: index // Reference back to original entry
        }));

        // Build the tree with r, g, b as dimensions
        this.tree = new kdTree(points, colorDistance, ['r', 'g', 'b']);

        this.buildTime = performance.now() - startTime;
        console.info(`ColorIndex: Built k-d tree for ${entries.length} colors in ${this.buildTime.toFixed(1)}ms`);
    }

    /**
     * Find the nearest color in the index
     * @param {Object} targetColor - {r, g, b}
     * @returns {Object|null} Best match entry with distance and quality
     */
    findNearest(targetColor) {
        if (!this.tree || this.entries.length === 0) {
            return null;
        }

        const target = {
            r: targetColor.r,
            g: targetColor.g,
            b: targetColor.b
        };

        // Find single nearest neighbor
        const [[match, distance]] = this.tree.nearest(target, 1);

        if (!match) return null;

        const entry = this.entries[match._index];

        return {
            ...entry,
            matchDistance: distance,
            matchQuality: getMatchQuality(distance)
        };
    }

    /**
     * Find k nearest colors
     * @param {Object} targetColor - {r, g, b}
     * @param {number} k - Number of nearest neighbors
     * @returns {Array} Array of matches with distances
     */
    findKNearest(targetColor, k = 5) {
        if (!this.tree || this.entries.length === 0) {
            return [];
        }

        const target = {
            r: targetColor.r,
            g: targetColor.g,
            b: targetColor.b
        };

        const results = this.tree.nearest(target, Math.min(k, this.entries.length));

        return results.map(([match, distance]) => ({
            ...this.entries[match._index],
            matchDistance: distance,
            matchQuality: getMatchQuality(distance)
        }));
    }

    /**
     * Get stats about the index
     * @returns {Object} Stats
     */
    getStats() {
        return {
            colorCount: this.entries.length,
            buildTimeMs: this.buildTime,
            hasIndex: this.tree !== null
        };
    }

    /**
     * Clear the index
     */
    clear() {
        this.tree = null;
        this.entries = [];
        this.buildTime = 0;
    }
}

// Singleton instance for app-wide use
export const colorIndex = new ColorIndex();
