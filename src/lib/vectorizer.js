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
    /**
     * Internal helper to generate contour paths from a binary grid
     * uses proper boundary tracing to avoid "stripe" artifacts from rectangles
     * @param {Uint8Array} grid - 1D array of 0s and 1s
     * @param {number} width 
     * @param {number} height 
     * @param {number} pxPerMm 
     * @returns {string[]} SVG paths
     */
    /**
     * Internal helper to generate paths from a binary grid
     * uses merged rectangle approach (original logic)
     * @param {Uint8Array} grid - 1D array of 0s and 1s
     * @param {number} width 
     * @param {number} height 
     * @param {number} pxPerMm 
     * @returns {string[]} SVG paths
     */
    gridToPaths(grid, width, height, pxPerMm) {
        const scale = 1 / pxPerMm;
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
        return rects.map(r => {
            const x1 = (r.x * scale).toFixed(3);
            const y1 = (r.y * scale).toFixed(3);
            const x2 = ((r.x + r.w) * scale).toFixed(3);
            const y2 = ((r.y + r.h) * scale).toFixed(3);
            return `M${x1} ${y1} L${x2} ${y1} L${x2} ${y2} L${x1} ${y2} Z`;
        });
    }

    /**
     * Create merged rectangle paths from a quantized image for a specific color
     * NOW USES gridToPaths for original implementation
     */
    createMergedRectPaths(quantizedData, color, pxPerMm = 10) {
        const data = quantizedData.data;
        const width = quantizedData.width;
        const height = quantizedData.height;
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

        return this.gridToPaths(grid, width, height, pxPerMm);
    }

    /**
     * Generate an outline by eroding the original shape and subtracting it.
     * Creates a "thick" outline based on the specified thickness in pixels.
     * 
     * @param {Object} quantizedData - { data: Uint8ClampedArray, width, height }
     * @param {Object} color - Target color { r, g, b }
     * @param {number} thickness - Thickness of the outline in pixels
     * @param {number} pxPerMm - Pixels per mm for scaling (default: 10)
     * @returns {string[]} - Array of SVG path strings
     */
    generateOutline(quantizedData, color, thickness = 2, pxPerMm = 10) {
        const data = quantizedData.data;
        const width = quantizedData.width;
        const height = quantizedData.height;
        const tolerance = this.options.tolerance;

        // 1. Create Binary Mask of the object
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

        // 2. Erode the mask (shrink it)
        // We alternate source/dest buffers to handle iterations
        let current = new Uint8Array(grid);
        let next = new Uint8Array(width * height);

        for (let i = 0; i < thickness; i++) {
            next.fill(0);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (current[idx] === 1) {
                        // Check neighbors (4-connectivity sufficient for erosion)
                        const n = y > 0 ? current[idx - width] : 0;
                        const s = y < height - 1 ? current[idx + width] : 0;
                        const w = x > 0 ? current[idx - 1] : 0;
                        const e = x < width - 1 ? current[idx + 1] : 0;

                        // If any neighbor is 0, this pixel becomes 0 (eroded edge)
                        // Keep 1 only if fully surrounded
                        if (n && s && w && e) {
                            next[idx] = 1;
                        }
                    }
                }
            }
            // Swap buffers
            let temp = current;
            current = next;
            next = temp;
        }

        // 3. Subtract Eroded (current) from Original (grid)
        // Outline = Original AND (NOT Eroded)
        const outlineGrid = new Uint8Array(width * height);
        for (let k = 0; k < width * height; k++) {
            if (grid[k] === 1 && current[k] === 0) {
                outlineGrid[k] = 1;
            }
        }

        // 4. Convert Outline Grid to Paths
        return this.gridToPaths(outlineGrid, width, height, pxPerMm);
    }

    // Kept for compatibility but points to new optimized method
    traceOutlines(quantizedData, color, pxPerMm = 10) {
        return this.generateOutline(quantizedData, color, 3, pxPerMm); // Default 3px thickness
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
