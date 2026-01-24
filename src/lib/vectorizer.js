/**
 * Vectorizer Module
 * Converts bitmap images to SVG vector paths using rectangle merging
 * Browser-compatible implementation - produces filled shapes for XCS/xTool
 */

export class Vectorizer {
    constructor(options = {}) {
        this.options = {
            tolerance: 3,  // Color matching tolerance
            ...options
        };
    }

    /**
     * Create merged rectangle paths from a quantized image for a specific color
     * This produces FILLED shapes instead of outlines, which works correctly in xTool
     * 
     * @param {Object} quantizedData - { data: Uint8ClampedArray, width, height }
     * @param {Object} color - Target color { r, g, b }
     * @param {number} pxPerMm - Pixels per mm for scaling (default: 10)
     * @returns {string[]} - Array of SVG path strings (rectangles)
     */
    createMergedRectPaths(quantizedData, color, pxPerMm = 10) {
        const data = quantizedData.data;
        const width = quantizedData.width;
        const height = quantizedData.height;
        const scale = 1 / pxPerMm;
        const tolerance = this.options.tolerance;

        // Build a 2D grid of matching pixels
        const grid = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const matches =
                    Math.abs(data[i] - color.r) <= tolerance &&
                    Math.abs(data[i + 1] - color.g) <= tolerance &&
                    Math.abs(data[i + 2] - color.b) <= tolerance;
                grid[y * width + x] = matches ? 1 : 0;
            }
        }

        // Find and merge rectangles using greedy algorithm
        const rects = [];
        const visited = new Uint8Array(width * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (grid[idx] === 1 && !visited[idx]) {
                    // Find maximum width of contiguous pixels
                    let maxW = 0;
                    for (let tx = x; tx < width && grid[y * width + tx] === 1 && !visited[y * width + tx]; tx++) {
                        maxW++;
                    }

                    // Extend downward as far as possible
                    let rectH = 1;
                    for (let ty = y + 1; ty < height; ty++) {
                        let rowOk = true;
                        for (let tx = x; tx < x + maxW; tx++) {
                            if (grid[ty * width + tx] !== 1 || visited[ty * width + tx]) {
                                rowOk = false;
                                break;
                            }
                        }
                        if (rowOk) rectH++;
                        else break;
                    }

                    // Mark all pixels in this rectangle as visited
                    for (let ty = y; ty < y + rectH; ty++) {
                        for (let tx = x; tx < x + maxW; tx++) {
                            visited[ty * width + tx] = 1;
                        }
                    }

                    rects.push({ x, y, w: maxW, h: rectH });
                }
            }
        }

        // Convert rectangles to SVG path strings
        const paths = rects.map(r => {
            const x1 = (r.x * scale).toFixed(3);
            const y1 = (r.y * scale).toFixed(3);
            const x2 = ((r.x + r.w) * scale).toFixed(3);
            const y2 = ((r.y + r.h) * scale).toFixed(3);
            return `M${x1} ${y1} L${x2} ${y1} L${x2} ${y2} L${x1} ${y2} Z`;
        });

        return paths;
    }

    /**
     * Vectorize all layers from a quantized image
     * @param {ImageData} quantizedImage - Quantized image data
     * @param {Array} palette - Array of colors { r, g, b }
     * @param {number} pxPerMm - Pixels per mm for scaling
     * @returns {Array} - Array of layer data with paths
     */
    vectorizeAllLayers(quantizedImage, palette, pxPerMm = 10) {
        const layers = [];

        // Handle both ImageData and plain objects with data property
        const imageObj = {
            data: quantizedImage.data,
            width: quantizedImage.width,
            height: quantizedImage.height
        };

        palette.forEach((color, index) => {
            // Create filled rectangle paths for this color
            const paths = this.createMergedRectPaths(imageObj, color, pxPerMm);

            layers.push({
                id: `layer-${index}`,
                name: `Layer ${index + 1}`,
                color: color,
                paths: paths,
                bounds: {
                    x: 0,
                    y: 0,
                    width: quantizedImage.width / pxPerMm,
                    height: quantizedImage.height / pxPerMm
                }
            });
        });

        return layers;
    }

    /**
     * Generate SVG preview of all layers
     */
    generateSVGPreview(layers, width, height) {
        let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

        layers.forEach(layer => {
            const colorStr = `rgb(${layer.color.r}, ${layer.color.g}, ${layer.color.b})`;
            layer.paths.forEach(path => {
                svg += `<path d="${path}" fill="${colorStr}" stroke="none"/>`;
            });
        });

        svg += '</svg>';
        return svg;
    }
}
