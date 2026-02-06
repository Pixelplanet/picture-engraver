/**
 * Enhanced Color Quantizer with Gradient Expansion
 * 
 * Extends the base quantization workflow with gradient interpolation,
 * allowing expansion from 8-12 base colors to up to 64 colors for smoother
 * gradients and better image quality.
 * 
 * All processing runs in the browser - no server required.
 */

/**
 * Preset configurations for color expansion
 */
export const EXPANSION_PRESETS = {
    standard: {
        name: 'Standard',
        multiplier: 4,
        maxColors: 32,
        description: '4x expansion - Recommended for most images'
    },
    quality: {
        name: 'Quality',
        multiplier: 6,
        maxColors: 48,
        description: '6x expansion - Better gradients'
    },
    premium: {
        name: 'Premium',
        multiplier: 8,
        maxColors: 64,
        description: '8x expansion - Maximum practical quality'
    }
};

/**
 * Maximum allowed colors (diminishing returns beyond this)
 */
export const MAX_COLORS = 64;

export class EnhancedQuantizer {
    constructor() {
        this.lastExpansionResult = null;
    }

    /**
     * Calculate the brightness of a color (for sorting)
     * Uses standard luminance formula
     * @param {Object} color - {r, g, b}
     * @returns {number} Brightness value 0-255
     */
    getBrightness(color) {
        return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
    }

    /**
     * Calculate Euclidean distance between two colors
     * @param {Object} color1 - {r, g, b}
     * @param {Object} color2 - {r, g, b}
     * @returns {number} Distance
     */
    colorDistance(color1, color2) {
        return Math.sqrt(
            Math.pow(color1.r - color2.r, 2) +
            Math.pow(color1.g - color2.g, 2) +
            Math.pow(color1.b - color2.b, 2)
        );
    }

    /**
     * Interpolate between two colors
     * @param {Object} colorA - Start color {r, g, b}
     * @param {Object} colorB - End color {r, g, b}
     * @param {number} t - Interpolation factor (0-1)
     * @returns {Object} Interpolated color {r, g, b}
     */
    interpolateColor(colorA, colorB, t) {
        return {
            r: Math.round(colorA.r * (1 - t) + colorB.r * t),
            g: Math.round(colorA.g * (1 - t) + colorB.g * t),
            b: Math.round(colorA.b * (1 - t) + colorB.b * t)
        };
    }

    /**
     * Expand a base palette to more colors using gradient interpolation
     * 
     * Algorithm:
     * 1. Sort base colors by brightness
     * 2. Create gradient colors between adjacent sorted colors
     * 3. Include all original base colors in result
     * 4. Apply vibrance boost to make colors pop
     * 
     * @param {Array} basePalette - Array of base colors [{r, g, b}, ...]
     * @param {number} targetColors - Target number of colors
     * @returns {Array} Expanded palette with original + interpolated colors
     */
    expandWithGradients(basePalette, targetColors) {
        // Enforce maximum
        targetColors = Math.min(targetColors, MAX_COLORS);

        // Can't expand to fewer colors than base
        if (targetColors <= basePalette.length) {
            return basePalette.map(c => ({ ...c, isInterpolated: false }));
        }

        // Sort by brightness for smooth gradient transitions
        const sorted = [...basePalette]
            .map((color, originalIndex) => ({ ...color, originalIndex }))
            .sort((a, b) => this.getBrightness(b) - this.getBrightness(a));

        const expandedPalette = [];
        const numGaps = sorted.length - 1;

        // Calculate how many intermediate colors per gap
        const extraColors = targetColors - basePalette.length;
        const colorsPerGap = Math.floor(extraColors / numGaps);
        let remainder = extraColors % numGaps;

        for (let i = 0; i < sorted.length; i++) {
            // Add base color (mark as not interpolated)
            expandedPalette.push({
                r: sorted[i].r,
                g: sorted[i].g,
                b: sorted[i].b,
                isInterpolated: false,
                originalIndex: sorted[i].originalIndex
            });

            // Add gradient colors between this and next (if not last)
            if (i < sorted.length - 1) {
                const colorA = sorted[i];
                const colorB = sorted[i + 1];

                // Distribute remainder to first gaps
                const stepsForThisGap = colorsPerGap + (remainder > 0 ? 1 : 0);
                if (remainder > 0) remainder--;

                for (let j = 1; j <= stepsForThisGap; j++) {
                    const t = j / (stepsForThisGap + 1);
                    const interpolated = this.interpolateColor(colorA, colorB, t);
                    // Apply vibrance boost to interpolated colors
                    const boosted = this.boostVibrance(interpolated, 1.3);
                    expandedPalette.push({
                        ...boosted,
                        isInterpolated: true,
                        gradientFrom: i,
                        gradientTo: i + 1
                    });
                }
            }
        }

        return expandedPalette;
    }

    /**
     * Boost vibrance/saturation of a color while preserving hue
     * @param {Object} color - {r, g, b} color object
     * @param {number} factor - Saturation multiplier (1.0 = no change, 1.5 = 50% more saturated)
     * @returns {Object} Enhanced color
     */
    boostVibrance(color, factor = 1.3) {
        // Convert RGB to HSL
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;

        let h = 0, s = 0;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        // Boost saturation (but preserve very dark/light colors)
        const isNeutral = s < 0.1;
        const isExtreme = l < 0.1 || l > 0.9;

        if (!isNeutral && !isExtreme) {
            s = Math.min(1, s * factor);
        }

        // Convert back to RGB
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        let newR, newG, newB;
        if (s === 0) {
            newR = newG = newB = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            newR = hue2rgb(p, q, h + 1 / 3);
            newG = hue2rgb(p, q, h);
            newB = hue2rgb(p, q, h - 1 / 3);
        }

        return {
            r: Math.round(newR * 255),
            g: Math.round(newG * 255),
            b: Math.round(newB * 255)
        };
    }

    /**
     * Requantize an image to a specific palette
     * Assigns each pixel to nearest palette color
     * 
     * @param {ImageData} imageData - Source image
     * @param {Array} palette - Target palette [{r, g, b}, ...]
     * @param {Function} progressCallback - Optional progress callback (0-1, message)
     * @returns {Object} { quantizedImage, layers, palette }
     */
    requantizeToPalette(imageData, palette, progressCallback = null) {
        const width = imageData.width;
        const height = imageData.height;
        const pixels = imageData.data;
        const totalPixels = width * height;

        // Create output image data
        const outputData = new Uint8ClampedArray(pixels.length);

        // Track pixel counts per palette color
        const pixelCounts = new Array(palette.length).fill(0);

        // Process each pixel
        for (let i = 0; i < totalPixels; i++) {
            const pixelIdx = i * 4;
            const r = pixels[pixelIdx];
            const g = pixels[pixelIdx + 1];
            const b = pixels[pixelIdx + 2];
            const a = pixels[pixelIdx + 3];

            // Skip transparent pixels
            if (a < 128) {
                outputData[pixelIdx] = 0;
                outputData[pixelIdx + 1] = 0;
                outputData[pixelIdx + 2] = 0;
                outputData[pixelIdx + 3] = 0;
                continue;
            }

            // Find nearest palette color
            let minDist = Infinity;
            let nearestIdx = 0;

            for (let p = 0; p < palette.length; p++) {
                const pColor = palette[p];
                const dist =
                    (r - pColor.r) * (r - pColor.r) +
                    (g - pColor.g) * (g - pColor.g) +
                    (b - pColor.b) * (b - pColor.b);

                if (dist < minDist) {
                    minDist = dist;
                    nearestIdx = p;
                }
            }

            // Set output pixel
            const nearestColor = palette[nearestIdx];
            outputData[pixelIdx] = nearestColor.r;
            outputData[pixelIdx + 1] = nearestColor.g;
            outputData[pixelIdx + 2] = nearestColor.b;
            outputData[pixelIdx + 3] = 255;

            pixelCounts[nearestIdx]++;

            // Progress update every 10%
            if (progressCallback && i % Math.floor(totalPixels / 10) === 0) {
                progressCallback(i / totalPixels, 'Requantizing image...');
            }
        }
        // Create output image data object (compatible with both browser and Node.js)
        // In browser, this works with canvas. In tests, it's just a plain object.
        const quantizedImage = {
            data: outputData,
            width: width,
            height: height
        };

        // Filter out colors with no pixels and create layer info
        const layers = [];
        const filteredPalette = [];

        for (let i = 0; i < palette.length; i++) {
            if (pixelCounts[i] > 0) {
                filteredPalette.push(palette[i]);
                layers.push({
                    color: { r: palette[i].r, g: palette[i].g, b: palette[i].b },
                    pixelCount: pixelCounts[i],
                    percentage: (pixelCounts[i] / totalPixels * 100).toFixed(2),
                    isInterpolated: palette[i].isInterpolated || false
                });
            }
        }

        if (progressCallback) progressCallback(1, 'Requantization complete!');

        return {
            quantizedImage,
            layers,
            palette: filteredPalette
        };
    }

    /**
     * Full expansion workflow: expand palette then requantize
     * 
     * @param {ImageData} imageData - Original image data
     * @param {Array} basePalette - Current palette from initial quantization
     * @param {string|number} presetOrTarget - Preset name or target color count
     * @param {Function} progressCallback - Optional progress callback
     * @returns {Object} { quantizedImage, palette, layers, stats }
     */
    expandAndRequantize(imageData, basePalette, presetOrTarget, progressCallback = null) {
        // Determine target colors
        let targetColors;
        let presetName = null;

        if (typeof presetOrTarget === 'string' && EXPANSION_PRESETS[presetOrTarget]) {
            const preset = EXPANSION_PRESETS[presetOrTarget];
            targetColors = Math.min(basePalette.length * preset.multiplier, preset.maxColors);
            presetName = preset.name;
        } else if (typeof presetOrTarget === 'number') {
            targetColors = Math.min(presetOrTarget, MAX_COLORS);
        } else {
            // Default to standard preset
            targetColors = Math.min(basePalette.length * 4, 32);
            presetName = 'Standard';
        }

        if (progressCallback) progressCallback(0.1, 'Generating expanded palette...');

        // Expand palette
        const expandedPalette = this.expandWithGradients(basePalette, targetColors);

        if (progressCallback) progressCallback(0.3, `Requantizing to ${expandedPalette.length} colors...`);

        // Requantize
        const result = this.requantizeToPalette(
            imageData,
            expandedPalette,
            (p, msg) => {
                if (progressCallback) progressCallback(0.3 + p * 0.7, msg);
            }
        );

        // Calculate stats
        const stats = {
            baseColors: basePalette.length,
            targetColors,
            actualColors: result.palette.length,
            interpolatedColors: result.palette.filter(c => c.isInterpolated).length,
            preset: presetName
        };

        this.lastExpansionResult = {
            ...result,
            stats
        };

        return {
            ...result,
            stats
        };
    }

    /**
     * Get suggested expansion targets based on base color count
     * @param {number} baseColors - Number of base colors
     * @returns {Array} Array of suggested targets with labels
     */
    static getSuggestedTargets(baseColors) {
        const suggestions = [];

        for (const [key, preset] of Object.entries(EXPANSION_PRESETS)) {
            const target = Math.min(baseColors * preset.multiplier, preset.maxColors);
            if (target > baseColors) {
                suggestions.push({
                    key,
                    name: preset.name,
                    colors: target,
                    description: preset.description,
                    multiplier: preset.multiplier
                });
            }
        }

        return suggestions;
    }
}
