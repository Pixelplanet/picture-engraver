/**
 * Contour-Based Vectorizer using Marching Squares Algorithm
 * 
 * Converts quantized image layers into clean vector paths by tracing contours.
 * This produces 50-500 paths instead of 100,000+ from the rectangle-based approach,
 * resulting in significantly faster rendering and smaller file sizes.
 * 
 * All processing runs in the browser - no server required.
 */

export class ContourVectorizer {
    /**
     * @param {Object} options - Vectorization options
     */
    constructor(options = {}) {
        this.options = {
            simplifyTolerance: options.simplifyTolerance ?? 0.5, // Douglas-Peucker tolerance
            minAreaThreshold: options.minAreaThreshold ?? 4,     // Min pixels for a shape
            smoothing: options.smoothing !== false,              // Enable path smoothing
            smoothIterations: options.smoothIterations ?? 1,     // Chaikin iterations
            ...options
        };
    }

    /**
     * Vectorize all layers from a quantized image
     * Returns paths in the same format as the existing Vectorizer class
     * 
     * @param {ImageData} quantizedImage - Quantized image data
     * @param {Array} palette - Color palette [{r, g, b}, ...]
     * @param {number} pxPerMm - Pixels per millimeter for scaling
     * @returns {Array} Vectorized layers with paths in SVG format
     */
    vectorizeAllLayers(quantizedImage, palette, pxPerMm = 10) {
        const width = quantizedImage.width;
        const height = quantizedImage.height;
        const vectorizedLayers = [];

        for (let colorIdx = 0; colorIdx < palette.length; colorIdx++) {
            const color = palette[colorIdx];

            // Create binary mask for this color
            const mask = this.createLayerMask(quantizedImage, color, width, height);

            // Extract contours using marching squares
            const contours = this.marchingSquares(mask, width, height);

            // Process contours into SVG paths
            const paths = contours
                .map(contour => {
                    const simplified = this.simplifyPath(contour, this.options.simplifyTolerance);
                    const smoothed = this.options.smoothing
                        ? this.smoothPath(simplified, this.options.smoothIterations)
                        : simplified;
                    return smoothed;
                })
                .filter(path => {
                    const area = this.calculatePathArea(path);
                    return area >= this.options.minAreaThreshold;
                })
                .map(path => this.pathToSVGString(path, pxPerMm));

            vectorizedLayers.push({
                color,
                paths,
                pathCount: paths.length
            });
        }

        return vectorizedLayers;
    }

    /**
     * Create binary mask for a specific color
     */
    createLayerMask(imageData, targetColor, width, height) {
        const mask = new Uint8Array(width * height);
        const data = imageData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                if (r === targetColor.r && g === targetColor.g && b === targetColor.b) {
                    mask[y * width + x] = 1;
                }
            }
        }

        return mask;
    }

    /**
     * Marching squares algorithm to extract contours
     */
    marchingSquares(mask, width, height) {
        const contours = [];
        // Use Uint8Array for memory efficiency on large images
        const visited = new Uint8Array(width * height);
        const MAX_CONTOURS = 10000; // Reasonable limit to prevent memory issues

        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const idx = y * width + x;
                if (visited[idx]) continue;

                const topLeft = mask[idx] || 0;
                const topRight = mask[idx + 1] || 0;
                const bottomLeft = mask[idx + width] || 0;
                const bottomRight = mask[idx + width + 1] || 0;

                const cellValue = topLeft | (topRight << 1) | (bottomRight << 2) | (bottomLeft << 3);

                // If not all same, we have an edge
                if (cellValue !== 0 && cellValue !== 15) {
                    const contour = this.traceContour(mask, width, height, x, y, visited);
                    if (contour.length > 2) {
                        contours.push(contour);
                        if (contours.length >= MAX_CONTOURS) {
                            console.warn('ContourVectorizer: Max contour limit reached');
                            return contours;
                        }
                    }
                }
            }
        }

        return contours;
    }

    /**
     * Trace a single contour starting from a point
     */
    traceContour(mask, width, height, startX, startY, visited) {
        const contour = [];
        let x = startX;
        let y = startY;
        let direction = 0;
        // Much more reasonable limit - a contour shouldn't need more than perimeter
        const maxIterations = Math.min(50000, (width + height) * 4);
        let iterations = 0;

        do {
            // Bounds check first
            if (x < 0 || x >= width || y < 0 || y >= height) {
                break;
            }

            const idx = y * width + x;

            // Prevent infinite loop from revisiting same cell in same trace
            if (contour.length > 10 && visited[idx]) {
                break;
            }

            visited[idx] = 1;
            contour.push({ x: x + 0.5, y: y + 0.5 });

            const topLeft = this.getMaskValue(mask, width, height, x, y);
            const topRight = this.getMaskValue(mask, width, height, x + 1, y);
            const bottomLeft = this.getMaskValue(mask, width, height, x, y + 1);
            const bottomRight = this.getMaskValue(mask, width, height, x + 1, y + 1);

            const cellValue = topLeft | (topRight << 1) | (bottomRight << 2) | (bottomLeft << 3);

            const move = this.getMarchingSquaresMove(cellValue, direction);

            // Prevent infinite loop if no movement
            if (move.dx === 0 && move.dy === 0) {
                break;
            }

            direction = move.direction;
            x += move.dx;
            y += move.dy;

            iterations++;
            if (iterations > maxIterations) break;

        } while (x !== startX || y !== startY);

        return contour;
    }

    getMaskValue(mask, width, height, x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0;
        return mask[y * width + x] || 0;
    }

    getMarchingSquaresMove(cellValue, inDirection) {
        const moves = {
            1: { dx: 0, dy: -1, direction: 3 },
            2: { dx: 1, dy: 0, direction: 0 },
            3: { dx: 1, dy: 0, direction: 0 },
            4: { dx: 0, dy: 1, direction: 1 },
            5: { dx: 0, dy: -1, direction: 3 },
            6: { dx: 0, dy: 1, direction: 1 },
            7: { dx: 1, dy: 0, direction: 0 },
            8: { dx: -1, dy: 0, direction: 2 },
            9: { dx: 0, dy: -1, direction: 3 },
            10: { dx: -1, dy: 0, direction: 2 },
            11: { dx: 0, dy: -1, direction: 3 },
            12: { dx: -1, dy: 0, direction: 2 },
            13: { dx: 0, dy: -1, direction: 3 },
            14: { dx: -1, dy: 0, direction: 2 },
        };

        return moves[cellValue] || { dx: 0, dy: 0, direction: inDirection };
    }

    /**
     * Douglas-Peucker path simplification
     */
    simplifyPath(points, tolerance) {
        if (points.length < 3) return points;

        let maxDist = 0;
        let maxIndex = 0;
        const end = points.length - 1;

        for (let i = 1; i < end; i++) {
            const dist = this.perpendicularDistance(points[i], points[0], points[end]);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }

        if (maxDist > tolerance) {
            const left = this.simplifyPath(points.slice(0, maxIndex + 1), tolerance);
            const right = this.simplifyPath(points.slice(maxIndex), tolerance);
            return left.slice(0, -1).concat(right);
        } else {
            return [points[0], points[end]];
        }
    }

    perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const norm = Math.sqrt(dx * dx + dy * dy);
        if (norm === 0) return 0;

        return Math.abs(
            dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
        ) / norm;
    }

    /**
     * Chaikin's corner cutting algorithm for smoothing
     */
    smoothPath(points, iterations = 1) {
        if (points.length < 3) return points;

        let smoothed = [...points];

        for (let iter = 0; iter < iterations; iter++) {
            const newPoints = [];

            for (let i = 0; i < smoothed.length - 1; i++) {
                const p0 = smoothed[i];
                const p1 = smoothed[i + 1];

                newPoints.push({
                    x: 0.75 * p0.x + 0.25 * p1.x,
                    y: 0.75 * p0.y + 0.25 * p1.y
                });
                newPoints.push({
                    x: 0.25 * p0.x + 0.75 * p1.x,
                    y: 0.25 * p0.y + 0.75 * p1.y
                });
            }

            // Close the path
            if (smoothed.length > 0) {
                const first = smoothed[0];
                const last = smoothed[smoothed.length - 1];
                newPoints.push({
                    x: 0.75 * last.x + 0.25 * first.x,
                    y: 0.75 * last.y + 0.25 * first.y
                });
            }

            smoothed = newPoints;
        }

        return smoothed;
    }

    calculatePathArea(points) {
        if (points.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < points.length - 1; i++) {
            area += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
        }
        return Math.abs(area / 2);
    }

    /**
     * Convert contour points to SVG path string (scaled to mm)
     */
    pathToSVGString(points, pxPerMm) {
        if (points.length === 0) return '';

        const scale = 1 / pxPerMm;
        const parts = [`M${(points[0].x * scale).toFixed(3)} ${(points[0].y * scale).toFixed(3)}`];

        for (let i = 1; i < points.length; i++) {
            parts.push(`L${(points[i].x * scale).toFixed(3)} ${(points[i].y * scale).toFixed(3)}`);
        }

        parts.push('Z');
        return parts.join(' ');
    }

    /**
     * Generate outline paths (for outline layers)
     * Uses erosion to create offset paths
     */
    generateOutline(quantizedData, color, thickness = 2, pxPerMm = 10) {
        const { width, height, data } = quantizedData;

        // Create mask for this color
        const mask = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (data[idx] === color.r && data[idx + 1] === color.g && data[idx + 2] === color.b && data[idx + 3] > 128) {
                    mask[y * width + x] = 1;
                }
            }
        }

        // Erode the mask by thickness
        const eroded = this.erodeMask(mask, width, height, thickness);

        // Create outline by subtracting eroded from original
        const outlineMask = new Uint8Array(width * height);
        for (let i = 0; i < mask.length; i++) {
            outlineMask[i] = mask[i] && !eroded[i] ? 1 : 0;
        }

        // Trace contours on outline mask
        const contours = this.marchingSquares(outlineMask, width, height);

        return contours
            .map(contour => {
                const simplified = this.simplifyPath(contour, this.options.simplifyTolerance);
                return this.options.smoothing
                    ? this.smoothPath(simplified, this.options.smoothIterations)
                    : simplified;
            })
            .filter(path => path.length > 2)
            .map(path => this.pathToSVGString(path, pxPerMm));
    }

    erodeMask(mask, width, height, radius) {
        const eroded = new Uint8Array(width * height);

        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                let allSet = true;

                // Check all neighbors within radius
                outer: for (let dy = -radius; dy <= radius && allSet; dy++) {
                    for (let dx = -radius; dx <= radius && allSet; dx++) {
                        if (!mask[(y + dy) * width + (x + dx)]) {
                            allSet = false;
                            break outer;
                        }
                    }
                }

                eroded[y * width + x] = allSet ? 1 : 0;
            }
        }

        return eroded;
    }
}
