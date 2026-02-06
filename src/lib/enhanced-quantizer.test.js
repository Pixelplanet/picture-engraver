import { describe, it, expect } from 'vitest';
import { EnhancedQuantizer, EXPANSION_PRESETS, MAX_COLORS } from './enhanced-quantizer.js';

describe('EnhancedQuantizer', () => {
    const quantizer = new EnhancedQuantizer();

    describe('getBrightness', () => {
        it('should calculate correct brightness for white', () => {
            const brightness = quantizer.getBrightness({ r: 255, g: 255, b: 255 });
            expect(brightness).toBeCloseTo(255);
        });

        it('should calculate correct brightness for black', () => {
            const brightness = quantizer.getBrightness({ r: 0, g: 0, b: 0 });
            expect(brightness).toBe(0);
        });

        it('should give green more weight than blue', () => {
            const greenBrightness = quantizer.getBrightness({ r: 0, g: 255, b: 0 });
            const blueBrightness = quantizer.getBrightness({ r: 0, g: 0, b: 255 });
            expect(greenBrightness).toBeGreaterThan(blueBrightness);
        });
    });

    describe('colorDistance', () => {
        it('should return 0 for identical colors', () => {
            const dist = quantizer.colorDistance(
                { r: 100, g: 150, b: 200 },
                { r: 100, g: 150, b: 200 }
            );
            expect(dist).toBe(0);
        });

        it('should return correct distance for different colors', () => {
            const dist = quantizer.colorDistance(
                { r: 0, g: 0, b: 0 },
                { r: 3, g: 4, b: 0 }
            );
            expect(dist).toBe(5); // 3-4-5 triangle
        });
    });

    describe('interpolateColor', () => {
        it('should return start color at t=0', () => {
            const result = quantizer.interpolateColor(
                { r: 0, g: 0, b: 0 },
                { r: 255, g: 255, b: 255 },
                0
            );
            expect(result).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('should return end color at t=1', () => {
            const result = quantizer.interpolateColor(
                { r: 0, g: 0, b: 0 },
                { r: 255, g: 255, b: 255 },
                1
            );
            expect(result).toEqual({ r: 255, g: 255, b: 255 });
        });

        it('should return midpoint at t=0.5', () => {
            const result = quantizer.interpolateColor(
                { r: 0, g: 0, b: 0 },
                { r: 200, g: 100, b: 50 },
                0.5
            );
            expect(result).toEqual({ r: 100, g: 50, b: 25 });
        });
    });

    describe('expandWithGradients', () => {
        const basePalette = [
            { r: 255, g: 255, b: 255 }, // White
            { r: 0, g: 0, b: 0 },       // Black
            { r: 128, g: 128, b: 128 }  // Gray
        ];

        it('should return base palette when target <= base count', () => {
            const result = quantizer.expandWithGradients(basePalette, 2);
            expect(result).toHaveLength(3);
            expect(result.every(c => c.isInterpolated === false)).toBe(true);
        });

        it('should expand to target color count', () => {
            const result = quantizer.expandWithGradients(basePalette, 9);
            expect(result.length).toBe(9);
        });

        it('should preserve all base colors', () => {
            const result = quantizer.expandWithGradients(basePalette, 12);
            const baseColorsFound = basePalette.every(baseColor =>
                result.some(c =>
                    c.r === baseColor.r &&
                    c.g === baseColor.g &&
                    c.b === baseColor.b &&
                    c.isInterpolated === false
                )
            );
            expect(baseColorsFound).toBe(true);
        });

        it('should mark interpolated colors correctly', () => {
            const result = quantizer.expandWithGradients(basePalette, 12);
            const interpolatedCount = result.filter(c => c.isInterpolated).length;
            expect(interpolatedCount).toBeGreaterThan(0);
            expect(interpolatedCount).toBe(result.length - basePalette.length);
        });

        it('should cap at MAX_COLORS', () => {
            const result = quantizer.expandWithGradients(basePalette, 1000);
            expect(result.length).toBeLessThanOrEqual(MAX_COLORS);
        });
    });

    describe('requantizeToPalette', () => {
        it('should assign pixels to nearest palette color', () => {
            // 2x2 image with 4 different colors
            const imageData = {
                width: 2,
                height: 2,
                data: new Uint8ClampedArray([
                    255, 0, 0, 255,    // Red
                    0, 255, 0, 255,    // Green
                    0, 0, 255, 255,    // Blue
                    255, 255, 255, 255 // White
                ])
            };

            const palette = [
                { r: 255, g: 0, b: 0 },   // Red
                { r: 0, g: 0, b: 0 }      // Black
            ];

            const result = quantizer.requantizeToPalette(imageData, palette);

            // Should map to palette colors only
            expect(result.quantizedImage.data.length).toBe(16);
            expect(result.palette.length).toBeLessThanOrEqual(2);
        });

        it('should skip transparent pixels', () => {
            const imageData = {
                width: 2,
                height: 1,
                data: new Uint8ClampedArray([
                    255, 0, 0, 255,  // Opaque red
                    0, 255, 0, 0     // Transparent green
                ])
            };

            const palette = [{ r: 255, g: 0, b: 0 }];
            const result = quantizer.requantizeToPalette(imageData, palette);

            // Second pixel should be transparent (alpha = 0)
            expect(result.quantizedImage.data[7]).toBe(0);
        });

        it('should filter out unused palette colors', () => {
            const imageData = {
                width: 1,
                height: 1,
                data: new Uint8ClampedArray([255, 0, 0, 255]) // Red only
            };

            const palette = [
                { r: 255, g: 0, b: 0 },  // Red - used
                { r: 0, g: 0, b: 255 }   // Blue - not used
            ];

            const result = quantizer.requantizeToPalette(imageData, palette);
            expect(result.palette.length).toBe(1);
        });
    });

    describe('expandAndRequantize', () => {
        const basePalette = [
            { r: 255, g: 255, b: 255 },
            { r: 0, g: 0, b: 0 }
        ];

        // Create a simple 2x2 gradient test image
        const testImage = {
            width: 2,
            height: 2,
            data: new Uint8ClampedArray([
                255, 255, 255, 255,  // White
                200, 200, 200, 255,  // Light gray
                100, 100, 100, 255,  // Dark gray
                0, 0, 0, 255         // Black
            ])
        };

        it('should expand using preset name', () => {
            const result = quantizer.expandAndRequantize(testImage, basePalette, 'standard');
            expect(result.stats.preset).toBe('Standard');
            expect(result.stats.baseColors).toBe(2);
        });

        it('should expand using numeric target', () => {
            const result = quantizer.expandAndRequantize(testImage, basePalette, 8);
            expect(result.stats.targetColors).toBe(8);
        });

        it('should include stats in result', () => {
            const result = quantizer.expandAndRequantize(testImage, basePalette, 'quality');
            expect(result.stats).toBeDefined();
            expect(result.stats.baseColors).toBe(2);
            expect(result.stats.actualColors).toBeGreaterThan(0);
        });
    });

    describe('getSuggestedTargets', () => {
        it('should return all presets for small base count', () => {
            const suggestions = EnhancedQuantizer.getSuggestedTargets(8);
            expect(suggestions.length).toBe(3); // All presets applicable
        });

        it('should return preset details', () => {
            const suggestions = EnhancedQuantizer.getSuggestedTargets(8);
            expect(suggestions[0]).toHaveProperty('name');
            expect(suggestions[0]).toHaveProperty('colors');
            expect(suggestions[0]).toHaveProperty('description');
        });

        it('should cap colors at preset maximum', () => {
            const suggestions = EnhancedQuantizer.getSuggestedTargets(20);
            const standard = suggestions.find(s => s.key === 'standard');
            expect(standard.colors).toBeLessThanOrEqual(EXPANSION_PRESETS.standard.maxColors);
        });
    });
});
