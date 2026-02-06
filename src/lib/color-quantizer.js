/**
 * Color Quantizer Module
 * Powered by image-q library for high-fidelity palette generation.
 * Includes adaptive noise suppression to handle anti-aliasing in simple graphics.
 */

import * as iq from 'image-q';

export class ColorQuantizer {
    /**
     * Quantize image to specified number of colors
     * @param {ImageData} imageData - Source image data
     * @param {number} numColors - Target number of colors
     * @returns {{ quantizedImage: ImageData, palette: Array }}
     */
    quantize(imageData, numColors) {
        const totalPixels = imageData.width * imageData.height;

        // 1. Convert ImageData to image-q PointContainer
        const inPointContainer = iq.utils.PointContainer.fromImageData(imageData);

        // 2. Build Palette using WuQuant (high quality)
        const palette = iq.buildPaletteSync([inPointContainer], {
            colors: numColors,
            paletteQuantization: 'wuquant',
            colorDistanceFormula: 'euclidean'
        });

        // 3. Initial application to get pixel counts per palette color
        // This helps us distinguish 'Main' layers from 'Edge/Noise' layers.
        const firstOut = iq.applyPaletteSync(inPointContainer, palette, {
            imageQuantization: 'nearest'
        });
        const outData = firstOut.toUint8Array();
        const counts = new Map();
        for (let i = 0; i < outData.length; i += 4) {
            const key = (outData[i] << 16) | (outData[i + 1] << 8) | outData[i + 2];
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        const rawPalette = palette.getPointContainer().getPointArray().map(p => {
            const key = (p.r << 16) | (p.g << 8) | p.b;
            return { r: p.r, g: p.g, b: p.b, count: counts.get(key) || 0 };
        });

        // 4. ADAPTIVE PRUNING: Consolidate 'ghost' layers (anti-aliasing/noise)
        // Main colors are those representing more than 0.5% of the image.
        const main = rawPalette.filter(c => c.count > totalPixels * 0.005);
        const minor = rawPalette.filter(c => c.count <= totalPixels * 0.005);

        // Sort main by popularity to ensure we merge minor into the most dominant neighbor
        main.sort((a, b) => b.count - a.count);

        const finalPalette = [...main];
        const mergeThreshold = 120; // Aggressive for minor colors to catch anti-aliasing

        minor.forEach(minColor => {
            let foundMainNeighbor = false;
            for (const mainColor of main) {
                const dist = Math.sqrt(
                    Math.pow(minColor.r - mainColor.r, 2) +
                    Math.pow(minColor.g - mainColor.g, 2) +
                    Math.pow(minColor.b - mainColor.b, 2)
                );
                if (dist < mergeThreshold) {
                    foundMainNeighbor = true;
                    break;
                }
            }
            // Only keep the minor color if it's NOT a neighbor of a main color
            // (meaning it's a small but distinct detail)
            if (!foundMainNeighbor) {
                finalPalette.push(minColor);
            }
        });

        // 5. VIBRANCE BOOST: Increase saturation to make colors pop
        // This keeps the hue direction but makes colors more brilliant
        const vibrantPalette = finalPalette.map(c => this.boostVibrance(c, 1.4));

        // 6. Final Application with the enhanced palette
        const finalIQPalette = this.createIQPalette(vibrantPalette);
        const finalOutPointContainer = iq.applyPaletteSync(inPointContainer, finalIQPalette, {
            imageQuantization: 'nearest'
        });

        const quantizedImage = new ImageData(
            new Uint8ClampedArray(finalOutPointContainer.toUint8Array()),
            imageData.width,
            imageData.height
        );

        return {
            quantizedImage,
            palette: vibrantPalette.map(p => ({ r: p.r, g: p.g, b: p.b }))
        };
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
        // Don't boost near-white, near-black, or near-gray colors too much
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
            b: Math.round(newB * 255),
            count: color.count
        };
    }

    /**
     * Helper to convert our {r,g,b} array back to IQ Palette
     */
    createIQPalette(colors) {
        const p = new iq.utils.Palette();
        colors.forEach(c => {
            p.add(iq.utils.Point.createByRGBA(c.r, c.g, c.b, 255));
        });
        return p;
    }

    /**
     * Extract layer masks from quantized image
     */
    extractLayers(imageData, palette) {
        const layers = palette.map(() => {
            return new ImageData(
                new Uint8ClampedArray(imageData.width * imageData.height * 4),
                imageData.width,
                imageData.height
            );
        });

        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const idx = palette.findIndex(c => c.r === r && c.g === g && c.b === b);
            if (idx !== -1) {
                const ld = layers[idx].data;
                ld[i] = 0; ld[i + 1] = 0; ld[i + 2] = 0; ld[i + 3] = 255;
            }
        }
        return layers;
    }
}
