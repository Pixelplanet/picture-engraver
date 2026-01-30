import { describe, it, expect } from 'vitest';
import { TestGridGenerator } from './test-grid-generator.js';

describe('TestGridGenerator', () => {
    const generator = new TestGridGenerator();

    describe('generateQRPath', () => {
        it('should generate a complex path for a valid string', () => {
            const path = generator.generateQRPath('test-string', 10, 10, 10);

            // A QR code path should have many 'M' (move to) commands for the bits
            // If it's the 1x1 fallback, it only has one M.
            const moveCount = (path.match(/M/g) || []).length;

            // Version 1 (smallest) has 21x21 modules = 441. 
            // Even if many are white, black modules should be > 100.
            expect(moveCount).toBeGreaterThan(50);
            expect(path).toContain('M10');
        });

        it('should handle special characters in strings', () => {
            const json = JSON.stringify({ v: 1, l: [2000, 500, 14], f: [40, 90, 8], p: 70, s: 425, t: 'uv' });
            const path = generator.generateQRPath(json, 0, 0, 20);

            const moveCount = (path.match(/M/g) || []).length;
            expect(moveCount).toBeGreaterThan(100);
        });
    });
});
