import { describe, it, expect } from 'vitest';
import { Pixelator } from './pixelator.js';

function makeImageData(width, height, fillFn) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const [r, g, b, a] = fillFn(x, y);
            data[i]     = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = a;
        }
    }
    return { width, height, data };
}

function pixel(imageData, x, y) {
    const i = (y * imageData.width + x) * 4;
    return [imageData.data[i], imageData.data[i + 1], imageData.data[i + 2], imageData.data[i + 3]];
}

describe('Pixelator', () => {
    const p = new Pixelator();

    it('returns input unchanged when blockSize is 1 (no-op)', () => {
        const src = makeImageData(4, 4, (x, y) => [x * 10, y * 10, 0, 255]);
        const out = p.pixelate(src, 1);
        expect(out).toBe(src);
    });

    it('returns input unchanged when blockSize is 0 (clamps to no-op)', () => {
        const src = makeImageData(4, 4, () => [100, 100, 100, 255]);
        const out = p.pixelate(src, 0);
        expect(out).toBe(src);
    });

    it('fills a 2×2 image with one 2-pixel block → uniform mean colour', () => {
        // Top-left: (0,255,0,255), top-right: (0,0,255,255)
        // bottom-left: (255,0,0,255), bottom-right: (255,255,0,255)
        // mean = (510/4, 510/4, 255/4, 255) = (128, 128, 64, 255) rounded
        const src = makeImageData(2, 2, (x, y) => {
            if (x === 0 && y === 0) return [0, 255, 0, 255];
            if (x === 1 && y === 0) return [0, 0, 255, 255];
            if (x === 0 && y === 1) return [255, 0, 0, 255];
            return [255, 255, 0, 255]; // x=1 y=1
        });
        const out = p.pixelate(src, 2);
        // All four pixels should have the same mean colour
        const expected = [Math.round(510 / 4), Math.round(510 / 4), Math.round(255 / 4), 255];
        expect(pixel(out, 0, 0)).toEqual(expected);
        expect(pixel(out, 1, 0)).toEqual(expected);
        expect(pixel(out, 0, 1)).toEqual(expected);
        expect(pixel(out, 1, 1)).toEqual(expected);
    });

    it('leaves a uniform image unchanged in values', () => {
        const src = makeImageData(6, 6, () => [50, 100, 150, 200]);
        const out = p.pixelate(src, 3);
        for (let y = 0; y < 6; y++) {
            for (let x = 0; x < 6; x++) {
                expect(pixel(out, x, y)).toEqual([50, 100, 150, 200]);
            }
        }
    });

    it('handles non-divisible dimensions (edge tiles)', () => {
        // 5×5 image with blockSize=3 → four tiles: 3×3, 2×3, 3×2, 2×2
        // Fill top-left 3×3 with red, rest with blue
        const src = makeImageData(5, 5, (x, y) => {
            return (x < 3 && y < 3) ? [255, 0, 0, 255] : [0, 0, 255, 255];
        });
        const out = p.pixelate(src, 3);

        // Top-left 3×3 block: all 9 pixels are red → mean = red
        expect(pixel(out, 0, 0)).toEqual([255, 0, 0, 255]);
        expect(pixel(out, 2, 2)).toEqual([255, 0, 0, 255]);

        // Top-right block (x 3..4, y 0..2): all blue → mean = blue
        expect(pixel(out, 3, 0)).toEqual([0, 0, 255, 255]);
        expect(pixel(out, 4, 2)).toEqual([0, 0, 255, 255]);

        // Bottom-left block (x 0..2, y 3..4): all blue → mean = blue
        expect(pixel(out, 0, 3)).toEqual([0, 0, 255, 255]);

        // Bottom-right block (x 3..4, y 3..4): all blue → mean = blue
        expect(pixel(out, 4, 4)).toEqual([0, 0, 255, 255]);
    });

    it('returns a new ImageData (does not mutate input)', () => {
        const src = makeImageData(4, 4, () => [10, 20, 30, 255]);
        const originalSlice = src.data.slice();
        const out = p.pixelate(src, 2);
        expect(out).not.toBe(src);
        expect(src.data).toEqual(originalSlice);
    });
});
