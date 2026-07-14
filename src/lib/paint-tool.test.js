import { describe, it, expect } from 'vitest';
import { nearestPaletteIndex, floodFill, paintBrush } from './paint-tool.js';

describe('nearestPaletteIndex', () => {
    const palette = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, { r: 255, g: 0, b: 0 }];

    it('returns the index of the closest color', () => {
        expect(nearestPaletteIndex(240, 10, 10, palette)).toBe(2);
        expect(nearestPaletteIndex(5, 5, 5, palette)).toBe(0);
        expect(nearestPaletteIndex(250, 250, 250, palette)).toBe(1);
    });
});

describe('floodFill', () => {
    it('fills a contiguous region', () => {
        const map = new Int32Array(16); // 4x4 all label 0
        const changed = floodFill(map, 4, 4, 0, 1);
        expect(changed).toBe(true);
        expect(Array.from(map).every(v => v === 1)).toBe(true);
    });

    it('does not cross a boundary of a different label', () => {
        const map = new Int32Array(16); // 4x4 all 0
        // wall of label 9 along column x=2
        for (let y = 0; y < 4; y++) map[y * 4 + 2] = 9;
        floodFill(map, 4, 4, 0, 1); // seed top-left
        // left of wall filled
        expect(map[0]).toBe(1);
        expect(map[1]).toBe(1);
        // wall untouched
        expect(map[2]).toBe(9);
        // right of wall untouched
        expect(map[3]).toBe(0);
    });

    it('returns false when the seed already has the target label', () => {
        const map = new Int32Array([5, 5, 5, 5]);
        expect(floodFill(map, 2, 2, 0, 5)).toBe(false);
    });

    it('never fills transparent pixels', () => {
        const map = new Int32Array([-1, -1, -1, -1]);
        expect(floodFill(map, 2, 2, 0, 3)).toBe(false);
    });
});

describe('paintBrush', () => {
    it('paints a filled disc of the given radius', () => {
        const map = new Int32Array(25); // 5x5 all 0
        const changed = paintBrush(map, 5, 5, 2, 2, 1, 7);
        expect(changed).toBe(true);
        // radius 1 covers the full 3x3 block around the center
        for (let y = 1; y <= 3; y++) {
            for (let x = 1; x <= 3; x++) {
                expect(map[y * 5 + x]).toBe(7);
            }
        }
        // corners of the 5x5 remain untouched
        expect(map[0]).toBe(0);
        expect(map[24]).toBe(0);
    });

    it('does not paint into transparent pixels', () => {
        const map = new Int32Array(9); // 3x3
        map[4] = -1; // center transparent
        paintBrush(map, 3, 3, 1, 1, 1, 7);
        expect(map[4]).toBe(-1);
    });
});
