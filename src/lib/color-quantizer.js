/**
 * Color Quantizer Module
 * Reduces image colors using median cut algorithm
 */

export class ColorQuantizer {
    /**
     * Quantize image to specified number of colors
     * @param {ImageData} imageData - Source image data
     * @param {number} numColors - Target number of colors
     * @returns {{ quantizedImage: ImageData, palette: Array }}
     */
    quantize(imageData, numColors) {
        const pixels = this.extractPixels(imageData);
        const palette = this.medianCut(pixels, numColors);
        const quantizedImage = this.applyPalette(imageData, palette);

        return { quantizedImage, palette };
    }

    /**
     * Extract all pixels from image data
     */
    extractPixels(imageData) {
        const pixels = [];
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            pixels.push({
                r: data[i],
                g: data[i + 1],
                b: data[i + 2]
            });
        }

        return pixels;
    }

    /**
     * Median cut algorithm for color quantization
     */
    medianCut(pixels, numColors) {
        // Start with all pixels in one bucket
        let buckets = [pixels];

        // Split until we have enough buckets
        while (buckets.length < numColors) {
            // Find bucket with largest range
            let maxRange = 0;
            let maxRangeIndex = 0;
            let splitChannel = 'r';

            buckets.forEach((bucket, index) => {
                if (bucket.length < 2) return;

                const ranges = this.getColorRanges(bucket);
                const maxChannelRange = Math.max(ranges.r, ranges.g, ranges.b);

                if (maxChannelRange > maxRange) {
                    maxRange = maxChannelRange;
                    maxRangeIndex = index;
                    splitChannel = ranges.r >= ranges.g && ranges.r >= ranges.b ? 'r' :
                        ranges.g >= ranges.b ? 'g' : 'b';
                }
            });

            if (maxRange === 0) break;

            // Split the bucket
            const bucketToSplit = buckets[maxRangeIndex];
            bucketToSplit.sort((a, b) => a[splitChannel] - b[splitChannel]);

            const mid = Math.floor(bucketToSplit.length / 2);
            const bucket1 = bucketToSplit.slice(0, mid);
            const bucket2 = bucketToSplit.slice(mid);

            buckets.splice(maxRangeIndex, 1, bucket1, bucket2);
        }

        // Calculate average color for each bucket
        return buckets.map(bucket => this.averageColor(bucket));
    }

    /**
     * Get color ranges for a bucket
     */
    getColorRanges(bucket) {
        let minR = 255, maxR = 0;
        let minG = 255, maxG = 0;
        let minB = 255, maxB = 0;

        bucket.forEach(pixel => {
            minR = Math.min(minR, pixel.r);
            maxR = Math.max(maxR, pixel.r);
            minG = Math.min(minG, pixel.g);
            maxG = Math.max(maxG, pixel.g);
            minB = Math.min(minB, pixel.b);
            maxB = Math.max(maxB, pixel.b);
        });

        return {
            r: maxR - minR,
            g: maxG - minG,
            b: maxB - minB
        };
    }

    /**
     * Calculate average color of a bucket
     */
    averageColor(bucket) {
        if (bucket.length === 0) return { r: 128, g: 128, b: 128 };

        let sumR = 0, sumG = 0, sumB = 0;
        bucket.forEach(pixel => {
            sumR += pixel.r;
            sumG += pixel.g;
            sumB += pixel.b;
        });

        return {
            r: Math.round(sumR / bucket.length),
            g: Math.round(sumG / bucket.length),
            b: Math.round(sumB / bucket.length)
        };
    }

    /**
     * Apply palette to image
     */
    applyPalette(imageData, palette) {
        const newImageData = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
        const data = newImageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] };
            const closest = this.findClosestColor(pixel, palette);

            data[i] = closest.r;
            data[i + 1] = closest.g;
            data[i + 2] = closest.b;
            // Alpha stays the same
        }

        return newImageData;
    }

    /**
     * Find closest color in palette using Euclidean distance
     */
    findClosestColor(pixel, palette) {
        let minDistance = Infinity;
        let closest = palette[0];

        palette.forEach(color => {
            const distance = Math.sqrt(
                Math.pow(pixel.r - color.r, 2) +
                Math.pow(pixel.g - color.g, 2) +
                Math.pow(pixel.b - color.b, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closest = color;
            }
        });

        return closest;
    }

    /**
     * Extract layer masks from quantized image
     * Returns array of ImageData, one per palette color
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
            const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] };

            // Find which palette color this pixel matches
            const paletteIndex = palette.findIndex(
                c => c.r === pixel.r && c.g === pixel.g && c.b === pixel.b
            );

            if (paletteIndex !== -1) {
                const layerData = layers[paletteIndex].data;
                layerData[i] = 0;     // Black for the mask
                layerData[i + 1] = 0;
                layerData[i + 2] = 0;
                layerData[i + 3] = 255; // Opaque
            }
        }

        return layers;
    }
}
