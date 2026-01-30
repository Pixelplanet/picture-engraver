import { describe, it, expect } from 'vitest';
import { Vectorizer } from './vectorizer.js';

describe('Vectorizer', () => {
    const vectorizer = new Vectorizer();

    describe('gridToPaths', () => {
        it('should generate a path for a single pixel', () => {
            // 10px per mm means 1px = 0.1mm
            const grid = new Uint8Array([1]);
            const width = 1;
            const height = 1;
            const pxPerMm = 10;

            const paths = vectorizer.gridToPaths(grid, width, height, pxPerMm);
            // Rect at (0,0) w=1 h=1 -> (0,0) to (0.1, 0.1)
            expect(paths).toHaveLength(1);
            expect(paths[0]).toBe('M0.000 0.000 L0.100 0.000 L0.100 0.100 L0.000 0.100 Z');
        });

        it('should merge adjacent pixels horizontally', () => {
            // [1, 1] -> 2x1 rect
            const grid = new Uint8Array([1, 1]);
            const width = 2;
            const height = 1;
            const pxPerMm = 10;

            const paths = vectorizer.gridToPaths(grid, width, height, pxPerMm);
            expect(paths).toHaveLength(1);
            // w=2 (0.2mm)
            expect(paths[0]).toBe('M0.000 0.000 L0.200 0.000 L0.200 0.100 L0.000 0.100 Z');
        });

        it('should merge adjacent pixels vertically', () => {
            // [1, 1] vertical
            const grid = new Uint8Array([1, 1]);
            const width = 1;
            const height = 2;
            const pxPerMm = 10;

            const paths = vectorizer.gridToPaths(grid, width, height, pxPerMm);
            expect(paths).toHaveLength(1);
            // h=2 (0.2mm)
            expect(paths[0]).toBe('M0.000 0.000 L0.100 0.000 L0.100 0.200 L0.000 0.200 Z');
        });
    });

    describe('createMergedRectPaths', () => {
        it('should filter by color and generate paths', () => {
            const quantizedData = {
                width: 2,
                height: 2,
                data: new Uint8ClampedArray([
                    255, 0, 0, 255, 0, 0, 0, 0,   // Red, Transparent
                    255, 0, 0, 255, 255, 0, 0, 255 // Red, Red
                ])
            };
            const color = { r: 255, g: 0, b: 0 };

            const paths = vectorizer.createMergedRectPaths(quantizedData, color, 10);

            // Should find 3 red pixels. The algorithm prefers horizontal merging first, then expanding down.
            // (0,0) is Red. (0,1) is Red. (1,1) is Red.
            // (0,0) starts. maxW=1 (next is empty). extends down? (0,1) is Red. yes. rectH=2.
            // Rect 1: x=0, y=0, w=1, h=2
            // (1,1) starts. maxW=1. rectH=1.
            // Rect 2: x=1, y=1, w=1, h=1

            expect(paths).toHaveLength(2);
        });
    });

    describe('generateOutline', () => {
        it('should generate an outline for a solid block', () => {
            // 5x5 block of red in center of 7x7 grid to allow expansion?
            // Actually generateOutline erodes then subtracts.
            // Thickness 1.
            // 3x3 block of 1s surrounded by 0s.
            // Center (1,1) is surrounded by 1s.
            // Erosion keeps center, removes borders.
            // Subtraction: Original (full block) - Eroded (center) = Border.

            const width = 5;
            const height = 5;
            const data = new Uint8ClampedArray(width * height * 4);

            // Fill center 3x3 with red
            for (let y = 1; y < 4; y++) {
                for (let x = 1; x < 4; x++) {
                    const i = (y * width + x) * 4;
                    data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
                }
            }

            const quantizedData = { width, height, data };
            const color = { r: 255, g: 0, b: 0 };

            const paths = vectorizer.generateOutline(quantizedData, color, 1, 10);

            // Center 3x3 is 9 pixels. 
            // Eroded keeps only the very center pixel (2,2) because it has 4 neighbors.
            // Result should be the 8 border pixels.
            // 1 1 1
            // 1 0 1
            // 1 1 1
            // This will break into multiple rects (top row 3, mid row 2 single pixels, bottom row 3).
            // Or merged: top 3x1. bottom 3x1. left mid 1x1. right mid 1x1.

            expect(paths.length).toBeGreaterThan(0);
        });
    });
});
