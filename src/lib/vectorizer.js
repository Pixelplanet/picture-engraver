/**
 * Vectorizer Module
 * Converts bitmap images to SVG vector paths using edge tracing
 * Browser-compatible implementation
 */

export class Vectorizer {
    constructor(options = {}) {
        this.options = {
            // Tracing options
            turnPolicy: 'minority',
            turdSize: 4,  // Increased from 2 for cleaner output
            optCurve: true,
            optTolerance: 0.2,
            threshold: 128,
            ...options
        };
    }

    /**
     * Trace a single-color layer to vector paths
     * @param {ImageData} imageData - Binary image (black = shape, white = background)
     * @param {Object} color - Layer color { r, g, b }
     * @returns {Object} - { paths: string[], bounds: { x, y, width, height } }
     */
    traceLayer(imageData, color) {
        // Convert to binary bitmap
        const bitmap = this.toBinaryBitmap(imageData);

        // Find contours
        const contours = this.findContours(bitmap, imageData.width, imageData.height);

        // Convert contours to SVG path strings
        const paths = contours.map(contour => this.contourToPath(contour));

        return {
            paths,
            color,
            bounds: {
                x: 0,
                y: 0,
                width: imageData.width,
                height: imageData.height
            }
        };
    }

    /**
     * Convert ImageData to binary bitmap (1 = black/shape, 0 = white/background)
     */
    toBinaryBitmap(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const bitmap = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            // Check if pixel is not white/transparent
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Consider it a shape pixel if it's dark enough and opaque
            const brightness = (r + g + b) / 3;
            bitmap[pixelIndex] = (brightness < this.options.threshold && a > 128) ? 1 : 0;
        }

        return bitmap;
    }

    /**
     * Find contours in binary bitmap using marching squares
     */
    findContours(bitmap, width, height) {
        const contours = [];
        const visited = new Set();

        // Scan for edge pixels
        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const idx = y * width + x;

                // Check if this is an edge starting point (transition from 0 to 1)
                if (bitmap[idx] === 1 && !visited.has(idx)) {
                    // Check if it's on an edge
                    const isEdge = this.isEdgePixel(bitmap, x, y, width, height);
                    if (isEdge) {
                        const contour = this.traceContour(bitmap, x, y, width, height, visited);

                        if (contour.length >= 4) {
                            // Calculate bounding box for turd filtering
                            let minX = Infinity, maxX = -Infinity;
                            let minY = Infinity, maxY = -Infinity;

                            for (const p of contour) {
                                if (p.x < minX) minX = p.x;
                                if (p.x > maxX) maxX = p.x;
                                if (p.y < minY) minY = p.y;
                                if (p.y > maxY) maxY = p.y;
                            }

                            const w = maxX - minX;
                            const h = maxY - minY;

                            // Filter out tiny features (noise/turds)
                            // Increase threshold for cleaner, more consolidated shapes
                            const threshold = this.options.turdSize || 2;
                            if (w >= threshold && h >= threshold) {
                                contours.push(contour);
                            }
                        }
                    }
                }
            }
        }

        return contours;
    }

    /**
     * Check if a pixel is on the edge of a shape
     */
    isEdgePixel(bitmap, x, y, width, height) {
        if (bitmap[y * width + x] !== 1) return false;

        // Check 4-connected neighbors
        const neighbors = [
            [x - 1, y], [x + 1, y],
            [x, y - 1], [x, y + 1]
        ];

        for (const [nx, ny] of neighbors) {
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true;
            if (bitmap[ny * width + nx] === 0) return true;
        }

        return false;
    }

    /**
     * Trace contour starting from a point using Moore neighborhood tracing
     */
    traceContour(bitmap, startX, startY, width, height, visited) {
        const contour = [];
        const directions = [
            [1, 0], [1, 1], [0, 1], [-1, 1],
            [-1, 0], [-1, -1], [0, -1], [1, -1]
        ];

        let x = startX;
        let y = startY;
        let dir = 0; // Start direction
        let startDir = 0;
        let firstPoint = true;

        const maxSteps = width * height * 2; // Safety limit
        let steps = 0;

        do {
            contour.push({ x, y });
            visited.add(y * width + x);

            // Find next edge pixel
            let found = false;
            for (let i = 0; i < 8; i++) {
                const checkDir = (dir + i) % 8;
                const [dx, dy] = directions[checkDir];
                const nx = x + dx;
                const ny = y + dy;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    if (bitmap[ny * width + nx] === 1 && this.isEdgePixel(bitmap, nx, ny, width, height)) {
                        x = nx;
                        y = ny;
                        dir = (checkDir + 5) % 8; // Turn back and continue
                        found = true;
                        break;
                    }
                }
            }

            if (!found) break;

            if (firstPoint) {
                startDir = dir;
                firstPoint = false;
            }

            steps++;
        } while ((x !== startX || y !== startY) && steps < maxSteps);

        return contour;
    }

    /**
     * Convert contour points to SVG path string
     */
    contourToPath(contour) {
        if (contour.length < 2) return '';

        // Simplify contour using Douglas-Peucker algorithm
        const simplified = this.simplifyContour(contour, this.options.optTolerance * 5);

        if (simplified.length < 2) return '';

        // Build path string
        let path = `M${simplified[0].x} ${simplified[0].y}`;

        for (let i = 1; i < simplified.length; i++) {
            path += ` L${simplified[i].x} ${simplified[i].y}`;
        }

        path += ' Z';

        return path;
    }

    /**
     * Simplify contour using Douglas-Peucker algorithm
     */
    simplifyContour(points, tolerance) {
        if (points.length <= 2) return points;

        // Find point with maximum distance from line between first and last
        let maxDist = 0;
        let maxIndex = 0;

        const first = points[0];
        const last = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.perpendicularDistance(points[i], first, last);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }

        // If max distance is greater than tolerance, recursively simplify
        if (maxDist > tolerance) {
            const left = this.simplifyContour(points.slice(0, maxIndex + 1), tolerance);
            const right = this.simplifyContour(points.slice(maxIndex), tolerance);
            return [...left.slice(0, -1), ...right];
        } else {
            return [first, last];
        }
    }

    /**
     * Calculate perpendicular distance from point to line
     */
    perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;

        if (dx === 0 && dy === 0) {
            return Math.sqrt(
                Math.pow(point.x - lineStart.x, 2) +
                Math.pow(point.y - lineStart.y, 2)
            );
        }

        const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);

        let closestX, closestY;
        if (t < 0) {
            closestX = lineStart.x;
            closestY = lineStart.y;
        } else if (t > 1) {
            closestX = lineEnd.x;
            closestY = lineEnd.y;
        } else {
            closestX = lineStart.x + t * dx;
            closestY = lineStart.y + t * dy;
        }

        return Math.sqrt(
            Math.pow(point.x - closestX, 2) +
            Math.pow(point.y - closestY, 2)
        );
    }

    /**
     * Create layer mask from quantized image for a specific color
     */
    createLayerMask(imageData, targetColor, tolerance = 10) {
        const mask = new ImageData(
            new Uint8ClampedArray(imageData.width * imageData.height * 4),
            imageData.width,
            imageData.height
        );

        const data = imageData.data;
        const maskData = mask.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Check if color matches target
            const matches =
                Math.abs(r - targetColor.r) <= tolerance &&
                Math.abs(g - targetColor.g) <= tolerance &&
                Math.abs(b - targetColor.b) <= tolerance;

            if (matches) {
                // Black pixel for the shape
                maskData[i] = 0;
                maskData[i + 1] = 0;
                maskData[i + 2] = 0;
                maskData[i + 3] = 255;
            } else {
                // White/transparent for background
                maskData[i] = 255;
                maskData[i + 1] = 255;
                maskData[i + 2] = 255;
                maskData[i + 3] = 255;
            }
        }

        return mask;
    }

    /**
     * Vectorize all layers from a quantized image
     * @param {ImageData} quantizedImage - Quantized image
     * @param {Array} palette - Array of colors { r, g, b }
     * @param {number} pxPerMm - Pixels per mm for scaling
     * @returns {Array} - Array of layer data with paths
     */
    vectorizeAllLayers(quantizedImage, palette, pxPerMm = 10) {
        const layers = [];

        palette.forEach((color, index) => {
            // Create mask for this color
            const mask = this.createLayerMask(quantizedImage, color);

            // Trace the mask
            const traced = this.traceLayer(mask, color);

            // Scale paths to mm
            const scaledPaths = traced.paths.map(path =>
                this.scalePath(path, 1 / pxPerMm)
            );

            layers.push({
                id: `layer-${index}`,
                name: `Layer ${index + 1}`,
                color: color,
                paths: scaledPaths,
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
     * Scale a path by a factor
     */
    scalePath(pathString, scale) {
        // Parse and scale coordinates
        return pathString.replace(/([0-9.]+)/g, (match) => {
            const num = parseFloat(match);
            return (num * scale).toFixed(3);
        });
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
