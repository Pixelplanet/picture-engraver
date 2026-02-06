import { describe, it, expect } from 'vitest';
import { ContourVectorizer } from './contour-vectorizer.js';

describe('ContourVectorizer', () => {
    const vectorizer = new ContourVectorizer();

    describe('pathToSVGString', () => {
        it('should create valid SVG path from points', () => {
            const points = [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 }
            ];
            const path = vectorizer.pathToSVGString(points, 10);
            expect(path).toContain('M');
            expect(path).toContain('L');
            expect(path).toContain('Z');
        });

        it('should scale coordinates by pxPerMm', () => {
            const points = [
                { x: 10, y: 20 },
                { x: 30, y: 40 }
            ];
            const path = vectorizer.pathToSVGString(points, 10);
            // 10 / 10 = 1.0, 20 / 10 = 2.0
            expect(path).toContain('1.000');
            expect(path).toContain('2.000');
        });
    });

    describe('simplifyPath', () => {
        it('should reduce point count while preserving shape', () => {
            // Create a path with redundant colinear points
            const points = [];
            for (let i = 0; i <= 10; i++) {
                points.push({ x: i, y: 0 });
            }

            const simplified = vectorizer.simplifyPath(points, 0.5);
            expect(simplified.length).toBeLessThan(points.length);
        });

        it('should preserve non-colinear points', () => {
            const points = [
                { x: 0, y: 0 },
                { x: 5, y: 10 }, // Not colinear
                { x: 10, y: 0 }
            ];

            const simplified = vectorizer.simplifyPath(points, 0.5);
            expect(simplified.length).toBe(3);
        });
    });

    describe('calculatePathArea', () => {
        it('should calculate area of a square', () => {
            const square = [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 },
                { x: 0, y: 0 } // Close the path
            ];

            const area = vectorizer.calculatePathArea(square);
            expect(area).toBeCloseTo(100, 0);
        });

        it('should return 0 for paths with less than 3 points', () => {
            const line = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
            expect(vectorizer.calculatePathArea(line)).toBe(0);
        });
    });

    describe('smoothPath', () => {
        it('should increase point count when smoothing', () => {
            const points = [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 }
            ];

            const smoothed = vectorizer.smoothPath(points, 1);
            expect(smoothed.length).toBeGreaterThan(points.length);
        });
    });

    describe('createLayerMask', () => {
        it('should create binary mask for matching color', () => {
            const imageData = {
                width: 2,
                height: 2,
                data: new Uint8ClampedArray([
                    255, 0, 0, 255,  // Red
                    0, 255, 0, 255,  // Green
                    255, 0, 0, 255,  // Red
                    0, 0, 255, 255   // Blue
                ])
            };

            const mask = vectorizer.createLayerMask(imageData, { r: 255, g: 0, b: 0 }, 2, 2);

            expect(mask[0]).toBe(1); // Red
            expect(mask[1]).toBe(0); // Green
            expect(mask[2]).toBe(1); // Red
            expect(mask[3]).toBe(0); // Blue
        });
    });
});
