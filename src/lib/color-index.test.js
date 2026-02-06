/**
 * Tests for Color Index and Multi-Grid Palette
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ColorIndex, getMatchQuality, MATCH_QUALITY } from './color-index.js';
import { MultiGridPalette } from './multi-grid-palette.js';

describe('ColorIndex', () => {
    let index;

    beforeEach(() => {
        index = new ColorIndex();
    });

    describe('build', () => {
        it('should build an index from color entries', () => {
            const entries = [
                { color: { r: 255, g: 0, b: 0 }, frequency: 40, lpi: 1000 },
                { color: { r: 0, g: 255, b: 0 }, frequency: 50, lpi: 1200 },
                { color: { r: 0, g: 0, b: 255 }, frequency: 60, lpi: 1400 }
            ];

            index.build(entries);

            expect(index.entries.length).toBe(3);
            expect(index.buildTime).toBeGreaterThan(0);
        });
    });

    describe('findNearest', () => {
        it('should find the exact color when present', () => {
            const entries = [
                { color: { r: 255, g: 0, b: 0 }, frequency: 40, lpi: 1000 },
                { color: { r: 0, g: 255, b: 0 }, frequency: 50, lpi: 1200 }
            ];

            index.build(entries);
            const result = index.findNearest({ r: 255, g: 0, b: 0 });

            expect(result.color.r).toBe(255);
            expect(result.matchDistance).toBe(0);
            expect(result.matchQuality).toBe('Excellent');
        });

        it('should find nearest color for approximate match', () => {
            const entries = [
                { color: { r: 100, g: 100, b: 100 }, frequency: 40, lpi: 1000 },
                { color: { r: 200, g: 200, b: 200 }, frequency: 50, lpi: 1200 }
            ];

            index.build(entries);
            const result = index.findNearest({ r: 110, g: 110, b: 110 });

            expect(result.color.r).toBe(100);
            expect(result.matchDistance).toBeGreaterThan(0);
        });

        it('should return null when index is empty', () => {
            const result = index.findNearest({ r: 100, g: 100, b: 100 });
            expect(result).toBeNull();
        });
    });

    describe('findKNearest', () => {
        it('should return k nearest colors', () => {
            const entries = [
                { color: { r: 100, g: 100, b: 100 }, frequency: 40, lpi: 1000 },
                { color: { r: 120, g: 120, b: 120 }, frequency: 45, lpi: 1100 },
                { color: { r: 200, g: 200, b: 200 }, frequency: 50, lpi: 1200 }
            ];

            index.build(entries);
            const results = index.findKNearest({ r: 100, g: 100, b: 100 }, 2);

            expect(results.length).toBe(2);
            // Results should include the two closest colors (100 and 120, not 200)
            const rgbValues = results.map(r => r.color.r);
            expect(rgbValues).toContain(100);
            expect(rgbValues).toContain(120);
            expect(rgbValues).not.toContain(200);
        });
    });
});

describe('getMatchQuality', () => {
    it('should return Excellent for small distances', () => {
        expect(getMatchQuality(10)).toBe('Excellent');
    });

    it('should return Good for medium distances', () => {
        expect(getMatchQuality(35)).toBe('Good');
    });

    it('should return Approximate for larger distances', () => {
        expect(getMatchQuality(75)).toBe('Approximate');
    });

    it('should return Poor for very large distances', () => {
        expect(getMatchQuality(150)).toBe('Poor');
    });
});

describe('MultiGridPalette', () => {
    let palette;

    beforeEach(() => {
        palette = new MultiGridPalette();
    });

    describe('addGrid', () => {
        it('should add a grid with tagged entries', () => {
            const gridData = {
                entries: [
                    { color: { r: 100, g: 100, b: 100 }, frequency: 40, lpi: 1000 }
                ]
            };

            palette.addGrid(gridData, 'test_grid', 'Test Grid');

            expect(palette.grids.size).toBe(1);
            const grid = palette.grids.get('test_grid');
            expect(grid.entries[0].gridId).toBe('test_grid');
            expect(grid.entries[0].gridName).toBe('Test Grid');
        });
    });

    describe('getMergedPalette - deduplication', () => {
        it('should deduplicate colors preferring lowest LPC', () => {
            // Grid 1: color at 1200 LPC
            palette.addGrid({
                entries: [
                    { color: { r: 100, g: 100, b: 100 }, frequency: 40, lpi: 1200 }
                ]
            }, 'grid1', 'Grid 1');

            // Grid 2: same color at 800 LPC (should win)
            palette.addGrid({
                entries: [
                    { color: { r: 100, g: 100, b: 100 }, frequency: 60, lpi: 800 }
                ]
            }, 'grid2', 'Grid 2');

            const merged = palette.getMergedPalette();

            expect(merged.length).toBe(1);
            expect(merged[0].lpi).toBe(800); // Lowest LPC wins
            expect(merged[0].gridId).toBe('grid2');
            expect(merged[0].alternativeSources.length).toBe(1);
            expect(merged[0].alternativeSources[0].lpi).toBe(1200);
        });

        it('should keep unique colors from multiple grids', () => {
            palette.addGrid({
                entries: [
                    { color: { r: 100, g: 100, b: 100 }, frequency: 40, lpi: 1000 }
                ]
            }, 'grid1', 'Grid 1');

            palette.addGrid({
                entries: [
                    { color: { r: 200, g: 200, b: 200 }, frequency: 60, lpi: 1200 }
                ]
            }, 'grid2', 'Grid 2');

            const merged = palette.getMergedPalette();

            expect(merged.length).toBe(2);
        });
    });

    describe('findBestMatch', () => {
        it('should find best match using k-d tree', () => {
            palette.addGrid({
                entries: [
                    { color: { r: 100, g: 100, b: 100 }, frequency: 40, lpi: 1000 },
                    { color: { r: 200, g: 200, b: 200 }, frequency: 60, lpi: 1200 }
                ]
            }, 'grid1', 'Grid 1');

            const match = palette.findBestMatch({ r: 105, g: 105, b: 105 });

            expect(match.color.r).toBe(100);
            expect(match.matchDistance).toBeDefined();
            expect(match.matchQuality).toBeDefined();
        });
    });

    describe('getStats', () => {
        it('should return accurate statistics', () => {
            palette.addGrid({
                entries: [
                    { color: { r: 100, g: 100, b: 100 }, frequency: 40, lpi: 1200 },
                    { color: { r: 150, g: 150, b: 150 }, frequency: 45, lpi: 1000 }
                ]
            }, 'grid1', 'Grid 1');

            palette.addGrid({
                entries: [
                    { color: { r: 100, g: 100, b: 100 }, frequency: 60, lpi: 800 }, // Duplicate
                    { color: { r: 200, g: 200, b: 200 }, frequency: 70, lpi: 1400 }
                ]
            }, 'grid2', 'Grid 2');

            const stats = palette.getStats();

            expect(stats.gridCount).toBe(2);
            expect(stats.totalColors).toBe(4);
            expect(stats.uniqueColors).toBe(3);
            expect(stats.duplicatesRemoved).toBe(1);
        });
    });
});
