import { describe, it, expect } from 'vitest';
import {
    colorDistance,
    buildLabelMap,
    labelMapToImageData,
    despeckle,
    mergeSimilarColors
} from './image-cleanup.js';

// Minimal ImageData polyfill for the node test environment.
if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class {
        constructor(data, width, height) {
            this.data = data;
            this.width = width;
            this.height = height;
        }
    };
}

describe('colorDistance', () => {
    it('returns 0 for identical colors', () => {
        expect(colorDistance({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBe(0);
    });

    it('grows with color difference', () => {
        const near = colorDistance({ r: 0, g: 0, b: 0 }, { r: 2, g: 2, b: 2 });
        const far = colorDistance({ r: 0, g: 0, b: 0 }, { r: 250, g: 250, b: 250 });
        expect(far).toBeGreaterThan(near);
    });
});

describe('buildLabelMap', () => {
    const palette = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }];

    it('maps each pixel to the nearest palette index', () => {
        // 2 pixels: near-black, near-white
        const data = new Uint8ClampedArray([
            10, 10, 10, 255,
            240, 240, 240, 255
        ]);
        const map = buildLabelMap({ data, width: 2, height: 1 }, palette);
        expect(Array.from(map)).toEqual([0, 1]);
    });

    it('marks transparent pixels as -1', () => {
        const data = new Uint8ClampedArray([0, 0, 0, 0]);
        const map = buildLabelMap({ data, width: 1, height: 1 }, palette);
        expect(map[0]).toBe(-1);
    });
});

describe('labelMapToImageData', () => {
    it('renders palette colors and transparency', () => {
        const palette = [{ r: 10, g: 20, b: 30 }];
        const map = new Int32Array([0, -1]);
        const img = labelMapToImageData(map, palette, 2, 1);
        expect(Array.from(img.data)).toEqual([10, 20, 30, 255, 0, 0, 0, 0]);
    });
});

describe('despeckle', () => {
    it('replaces a stray single pixel with the surrounding color', () => {
        // 5x5 field of label 0 with a single label-1 pixel in the center
        const map = new Int32Array(25); // all 0
        map[12] = 1; // center (x=2, y=2)
        const out = despeckle(map, 5, 5, 2);
        expect(out[12]).toBe(0);
    });

    it('leaves islands >= minSize untouched', () => {
        const map = new Int32Array(25);
        // 2-pixel island of label 1 at indices 12 and 13
        map[12] = 1;
        map[13] = 1;
        const out = despeckle(map, 5, 5, 2);
        expect(out[12]).toBe(1);
        expect(out[13]).toBe(1);
    });

    it('is a no-op when minSize <= 0', () => {
        const map = new Int32Array([0, 1, 0, 0]);
        expect(despeckle(map, 2, 2, 0)).toBe(map);
    });
});

describe('mergeSimilarColors', () => {
    it('merges near-identical colors and remaps the label map', () => {
        const palette = [{ r: 0, g: 0, b: 0 }, { r: 2, g: 2, b: 2 }, { r: 250, g: 250, b: 250 }];
        const map = new Int32Array([0, 1, 2, 2]);
        const res = mergeSimilarColors(palette, map, 10);
        expect(res.changed).toBe(true);
        expect(res.palette.length).toBe(2); // the two dark colors merged
        // pixels formerly 0 and 1 now share one index; the white stays distinct
        expect(res.labelMap[0]).toBe(res.labelMap[1]);
        expect(res.labelMap[2]).not.toBe(res.labelMap[0]);
    });

    it('does nothing below threshold 0', () => {
        const palette = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }];
        const map = new Int32Array([0, 1]);
        const res = mergeSimilarColors(palette, map, 0);
        expect(res.changed).toBe(false);
        expect(res.palette).toBe(palette);
    });
});
