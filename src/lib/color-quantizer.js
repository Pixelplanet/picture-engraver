/**
 * Color Quantizer Module
 * Re-implemented using K-Means Clustering with Farthest Point Sampling initialization.
 * This approach (ported from Img2svg_xcs prototype) ensures distinct colors are preserved
 * and creates clean layer separation without "muddy" averaging or aggressive pruning.
 */

export class ColorQuantizer {
    /**
     * Quantize image to specified number of colors
     * @param {ImageData} imageData - Source image data
     * @param {number} numColors - Target number of colors
     * @returns {{ quantizedImage: ImageData, palette: Array }}
     */
    quantize(imageData, numColors) {
        // 1. Downsample for fast K-Means centroid finding
        // Limit max dimension to 256px for palette extraction
        // This ensures the expensive K-Means runs quickly (~65k pixels max)
        const maxDim = 256;
        const scale = Math.min(1, maxDim / Math.max(imageData.width, imageData.height));
        const samplePixels = this.samplePixels(imageData, scale);

        // 2. K-Means Clustering to find optimal palette
        // limit iterations to 10 for performance
        // If we have fewer pixels than requested colors, handle gracefully
        const k = Math.min(numColors, samplePixels.length);
        const kMeansResult = this.kMeansQuantize(samplePixels, k, 10);
        let palette = kMeansResult.palette; // Array of [r,g,b]

        // 3. Vibrance Boost (Legacy enhancement)
        // Kept from original logic to make colors pop
        palette = palette.map(c => this.boostVibrance({ r: c[0], g: c[1], b: c[2] }, 1.4));

        // 4. Apply palette to full image (Nearest Neighbor)
        const width = imageData.width;
        const height = imageData.height;
        const outputData = new Uint8ClampedArray(width * height * 4);
        const inputData = imageData.data;

        // Convert palette to array of arrays for easy distance calc
        // (palette is currently array of {r,g,b} objects)
        const paletteArr = palette.map(p => [p.r, p.g, p.b]);

        for (let i = 0; i < inputData.length; i += 4) {
            // Preserve alpha / skip transparency
            if (inputData[i + 3] < 128) {
                outputData[i] = 0;
                outputData[i + 1] = 0;
                outputData[i + 2] = 0;
                outputData[i + 3] = 0; // Transparent
                continue;
            }

            const r = inputData[i];
            const g = inputData[i + 1];
            const b = inputData[i + 2];

            const bestIdx = this.findNearestColorIndex(r, g, b, paletteArr);
            const color = palette[bestIdx];

            outputData[i] = color.r;
            outputData[i + 1] = color.g;
            outputData[i + 2] = color.b;
            outputData[i + 3] = 255; // Full opacity
        }

        const quantizedImage = new ImageData(outputData, width, height);

        return {
            quantizedImage,
            palette // Array of {r, g, b} objects
        };
    }

    /**
     * Extract sample pixels from ImageData with downsampling
     */
    samplePixels(imageData, scale) {
        const w = imageData.width;
        const h = imageData.height;
        // Calculate step size to achieve target scale
        const step = Math.max(1, Math.floor(1 / scale));
        const pixels = [];
        const data = imageData.data;

        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const i = (y * w + x) * 4;
                if (data[i + 3] < 128) continue; // Skip transparent
                pixels.push([data[i], data[i + 1], data[i + 2]]);
            }
        }

        // Fallback if image was empty or fully transparent
        if (pixels.length === 0) {
            return [[0, 0, 0]];
        }

        return pixels;
    }

    /**
     * K-Means Quantization Algorithm
     */
    kMeansQuantize(pixels, k, iters) {
        const labels = new Uint16Array(pixels.length);
        const centroids = this.initCentroids(pixels, k);

        for (let iter = 0; iter < iters; iter++) {
            // Sums for calculating new centroids: [rSum, gSum, bSum, count]
            const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);

            // Assign pixels to nearest centroid
            for (let i = 0; i < pixels.length; i++) {
                const p = pixels[i];
                let best = 0;
                let bestD = Infinity;
                for (let c = 0; c < k; c++) {
                    const d = this.colorDistSq(p, centroids[c]);
                    if (d < bestD) {
                        bestD = d;
                        best = c;
                    }
                }
                labels[i] = best;
                sums[best][0] += p[0];
                sums[best][1] += p[1];
                sums[best][2] += p[2];
                sums[best][3] += 1;
            }

            // Recalculate centroids
            let moved = 0;
            for (let c = 0; c < k; c++) {
                if (sums[c][3] === 0) {
                    // If cluster is empty, re-init with random pixel
                    const seed = pixels[(Math.random() * pixels.length) | 0];
                    centroids[c] = [seed[0], seed[1], seed[2]];
                    moved += 255;
                    continue;
                }
                const nr = sums[c][0] / sums[c][3];
                const ng = sums[c][1] / sums[c][3];
                const nb = sums[c][2] / sums[c][3];

                moved += Math.abs(centroids[c][0] - nr) +
                    Math.abs(centroids[c][1] - ng) +
                    Math.abs(centroids[c][2] - nb);

                centroids[c] = [nr, ng, nb];
            }
            if (moved < 1) break;
        }

        // Sort palette by popularity (optional, but nice)
        const counts = new Uint32Array(k);
        for (let i = 0; i < labels.length; i++) counts[labels[i]]++;

        const order = Array.from({ length: k }, (_, i) => i).sort((a, b) => counts[b] - counts[a]);
        const finalPalette = [];

        for (let i = 0; i < order.length; i++) {
            finalPalette.push(centroids[order[i]].map(v => Math.round(v)));
        }

        return { labels, palette: finalPalette };
    }

    /**
     * Initialize centroids using Farthest Point Sampling
     * This avoids random initialization traps and ensures distinct colors.
     */
    initCentroids(pixels, k) {
        const out = [];
        // 1. Pick first random point
        out.push(pixels[(Math.random() * pixels.length) | 0].slice());

        // 2. Pick subsequent points to be farthest from existing ones
        while (out.length < k) {
            let bestI = 0;
            let bestD = -1;
            for (let i = 0; i < pixels.length; i += 10) { // Optimization: skip some pixels for init
                const p = pixels[i];
                let nearest = Infinity;
                for (let c = 0; c < out.length; c++) {
                    const d = this.colorDistSq(p, out[c]);
                    if (d < nearest) nearest = d;
                }
                if (nearest > bestD) {
                    bestD = nearest;
                    bestI = i;
                }
            }
            out.push(pixels[bestI].slice());
        }
        return out;
    }

    colorDistSq(a, b) {
        const dr = a[0] - b[0];
        const dg = a[1] - b[1];
        const db = a[2] - b[2];
        return dr * dr + dg * dg + db * db;
    }

    findNearestColorIndex(r, g, b, paletteArr) {
        let best = 0;
        let bestD = Infinity;
        for (let c = 0; c < paletteArr.length; c++) {
            const pal = paletteArr[c];
            // Inline dist calc for speed
            const dr = r - pal[0];
            const dg = g - pal[1];
            const db = b - pal[2];
            const d = dr * dr + dg * dg + db * db;
            if (d < bestD) {
                bestD = d;
                best = c;
            }
        }
        return best;
    }

    /**
     * Boost vibrance/saturation of a color while preserving hue
     * @param {Object} color - {r, g, b} color object
     * @param {number} factor - Saturation multiplier
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
     * Extract layer masks from quantized image
     * Kept for interface compatibility
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
            // Since we quantized by forcing pixels to palette, exact match works
            const idx = palette.findIndex(c => c.r === r && c.g === g && c.b === b);
            if (idx !== -1) {
                const ld = layers[idx].data;
                ld[i] = 0; ld[i + 1] = 0; ld[i + 2] = 0; ld[i + 3] = 255;
            }
        }
        return layers;
    }
}
