/**
 * Browser-Based Image Vectorization
 * 
 * Converts quantized image layers into clean vector paths using marching squares
 * contour tracing algorithm. Runs entirely in the browser - no server processing.
 * 
 * This replaces the pixel-by-pixel approach with proper contour detection,
 * creating smooth, scalable vector paths for each color layer.
 */

class ImageVectorizer {
    /**
     * Convert quantized image layers to vector paths
     * @param {ImageData} imageData - Quantized image data
     * @param {Array} layers - Color layers from quantization
     * @param {Object} options - Vectorization options
     */
    constructor(options = {}) {
        this.options = {
            simplifyTolerance: options.simplifyTolerance || 0.5, // Douglas-Peucker tolerance
            minAreaThreshold: options.minAreaThreshold || 4, // Min pixels for a shape
            smoothing: options.smoothing !== false, // Enable path smoothing
            cornerThreshold: options.cornerThreshold || 20, // Angle threshold for corners (degrees)
            ...options
        };
    }
    
    /**
     * Vectorize all layers from a quantized image
     * @param {ImageData} imageData - Quantized image
     * @param {Array} layers - Layer information
     * @param {Function} progressCallback - Progress updates
     * @returns {Promise<Object>} Vector data for all layers
     */
    async vectorizeLayers(imageData, layers, progressCallback = null) {
        const width = imageData.width;
        const height = imageData.height;
        const vectorLayers = [];
        
        for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
            if (progressCallback) {
                progressCallback(layerIdx / layers.length, `Vectorizing layer ${layerIdx + 1}/${layers.length}`);
            }
            
            const layer = layers[layerIdx];
            
            // Create binary mask for this layer
            const mask = this.createLayerMask(imageData, layer.color, width, height);
            
            // Extract contours using marching squares
            const contours = this.marchingSquares(mask, width, height);
            
            // Simplify and smooth paths
            const paths = contours.map(contour => {
                const simplified = this.simplifyPath(contour, this.options.simplifyTolerance);
                return this.options.smoothing ? this.smoothPath(simplified) : simplified;
            });
            
            // Filter out tiny paths
            const filteredPaths = paths.filter(path => {
                const area = this.calculatePathArea(path);
                return area >= this.options.minAreaThreshold;
            });
            
            vectorLayers.push({
                layerId: layer.layerId,
                color: layer.color,
                frequency: layer.frequency,
                lpi: layer.lpi,
                paths: filteredPaths,
                pathCount: filteredPaths.length
            });
        }
        
        if (progressCallback) progressCallback(1.0, 'Complete!');
        
        return {
            width,
            height,
            layers: vectorLayers,
            totalPaths: vectorLayers.reduce((sum, l) => sum + l.pathCount, 0)
        };
    }
    
    /**
     * Create binary mask for a specific color layer
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
                
                // Check if pixel matches this layer's color
                if (r === targetColor.r && g === targetColor.g && b === targetColor.b) {
                    mask[y * width + x] = 1;
                }
            }
        }
        
        return mask;
    }
    
    /**
     * Marching squares algorithm to extract contours
     * @param {Uint8Array} mask - Binary mask
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Array} Array of contours (each contour is an array of points)
     */
    marchingSquares(mask, width, height) {
        const contours = [];
        const visited = new Set();
        
        // Scan for contour starting points
        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const key = `${x},${y}`;
                if (visited.has(key)) continue;
                
                // Check if this is a contour edge
                const topLeft = mask[y * width + x];
                const topRight = mask[y * width + (x + 1)];
                const bottomLeft = mask[(y + 1) * width + x];
                const bottomRight = mask[(y + 1) * width + (x + 1)];
                
                const cellValue = topLeft | (topRight << 1) | (bottomRight << 2) | (bottomLeft << 3);
                
                // If not all same, we have an edge
                if (cellValue !== 0 && cellValue !== 15) {
                    const contour = this.traceContour(mask, width, height, x, y, visited);
                    if (contour.length > 2) {
                        contours.push(contour);
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
        let direction = 0; // 0=right, 1=down, 2=left, 3=up
        const maxIterations = width * height * 4; // Prevent infinite loops
        let iterations = 0;
        
        do {
            visited.add(`${x},${y}`);
            contour.push({ x: x + 0.5, y: y + 0.5 }); // Center of cell
            
            // Get cell configuration
            const topLeft = this.getMaskValue(mask, width, height, x, y);
            const topRight = this.getMaskValue(mask, width, height, x + 1, y);
            const bottomLeft = this.getMaskValue(mask, width, height, x, y + 1);
            const bottomRight = this.getMaskValue(mask, width, height, x + 1, y + 1);
            
            const cellValue = topLeft | (topRight << 1) | (bottomRight << 2) | (bottomLeft << 3);
            
            // Determine next direction based on marching squares lookup
            const move = this.getMarchingSquaresMove(cellValue, direction);
            direction = move.direction;
            x += move.dx;
            y += move.dy;
            
            iterations++;
            if (iterations > maxIterations) break;
            
        } while (x !== startX || y !== startY);
        
        return contour;
    }
    
    /**
     * Get value from mask with bounds checking
     */
    getMaskValue(mask, width, height, x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0;
        return mask[y * width + x] || 0;
    }
    
    /**
     * Marching squares movement lookup table
     */
    getMarchingSquaresMove(cellValue, inDirection) {
        // Simplified marching squares - follows contour clockwise
        const moves = {
            1: { dx: 0, dy: -1, direction: 3 },  // Top
            2: { dx: 1, dy: 0, direction: 0 },   // Right
            3: { dx: 1, dy: 0, direction: 0 },   // Right
            4: { dx: 0, dy: 1, direction: 1 },   // Down
            5: { dx: 0, dy: -1, direction: 3 },  // Top
            6: { dx: 0, dy: 1, direction: 1 },   // Down (ambiguous)
            7: { dx: 1, dy: 0, direction: 0 },   // Right
            8: { dx: -1, dy: 0, direction: 2 },  // Left
            9: { dx: 0, dy: -1, direction: 3 },  // Top (ambiguous)
            10: { dx: -1, dy: 0, direction: 2 }, // Left
            11: { dx: 0, dy: -1, direction: 3 }, // Top
            12: { dx: -1, dy: 0, direction: 2 }, // Left
            13: { dx: 0, dy: -1, direction: 3 }, // Top
            14: { dx: -1, dy: 0, direction: 2 }, // Left
        };
        
        return moves[cellValue] || { dx: 0, dy: 0, direction: inDirection };
    }
    
    /**
     * Douglas-Peucker path simplification
     * Reduces number of points while preserving shape
     */
    simplifyPath(points, tolerance) {
        if (points.length < 3) return points;
        
        // Find point with maximum distance from line
        let maxDist = 0;
        let maxIndex = 0;
        const end = points.length - 1;
        
        for (let i = 1; i < end; i++) {
            const dist = this.perpendicularDistance(
                points[i],
                points[0],
                points[end]
            );
            
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }
        
        // If max distance is greater than tolerance, recursively simplify
        if (maxDist > tolerance) {
            const left = this.simplifyPath(points.slice(0, maxIndex + 1), tolerance);
            const right = this.simplifyPath(points.slice(maxIndex), tolerance);
            
            return left.slice(0, -1).concat(right);
        } else {
            return [points[0], points[end]];
        }
    }
    
    /**
     * Calculate perpendicular distance from point to line
     */
    perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        
        const norm = Math.sqrt(dx * dx + dy * dy);
        if (norm === 0) return 0;
        
        const dist = Math.abs(
            dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
        ) / norm;
        
        return dist;
    }
    
    /**
     * Smooth path using Chaikin's corner cutting algorithm
     */
    smoothPath(points, iterations = 1) {
        if (points.length < 3) return points;
        
        let smoothed = [...points];
        
        for (let iter = 0; iter < iterations; iter++) {
            const newPoints = [];
            
            for (let i = 0; i < smoothed.length - 1; i++) {
                const p0 = smoothed[i];
                const p1 = smoothed[i + 1];
                
                // Create two new points at 1/4 and 3/4 along the segment
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
    
    /**
     * Calculate area of a path (for filtering tiny shapes)
     */
    calculatePathArea(points) {
        if (points.length < 3) return 0;
        
        let area = 0;
        for (let i = 0; i < points.length - 1; i++) {
            area += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
        }
        return Math.abs(area / 2);
    }
    
    /**
     * Convert vectorized layers to SVG string
     * @param {Object} vectorData - Output from vectorizeLayers()
     * @param {Object} options - SVG generation options
     * @returns {string} SVG markup
     */
    toSVG(vectorData, options = {}) {
        const { width, height, layers } = vectorData;
        const {
            widthMM = 200,
            heightMM = 200,
            includeMetadata = true
        } = options;
        
        let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        if (includeMetadata) {
            svg += `<!-- Generated by Picture Engraver - lasertools.org -->\n`;
            svg += `<!-- Date: ${new Date().toISOString()} -->\n`;
            svg += `<!-- Total paths: ${vectorData.totalPaths} (vs ${width * height} pixels) -->\n`;
        }
        
        svg += `<svg xmlns="http://www.w3.org/2000/svg"\n`;
        svg += `     width="${widthMM}mm"\n`;
        svg += `     height="${heightMM}mm"\n`;
        svg += `     viewBox="0 0 ${width} ${height}">\n`;
        
        // Add each layer
        layers.forEach((layer, idx) => {
            svg += `  <!-- Layer ${idx + 1}: ${layer.pathCount} paths -->\n`;
            svg += `  <g id="layer-${layer.layerId}" `;
            svg += `fill="rgb(${layer.color.r}, ${layer.color.g}, ${layer.color.b})" `;
            svg += `stroke="none"`;
            
            if (includeMetadata) {
                svg += ` data-frequency="${layer.frequency}" data-lpi="${layer.lpi}"`;
            }
            
            svg += `>\n`;
            
            // Add paths for this layer
            layer.paths.forEach(path => {
                if (path.length === 0) return;
                
                svg += `    <path d="`;
                svg += `M${path[0].x.toFixed(3)} ${path[0].y.toFixed(3)}`;
                
                for (let i = 1; i < path.length; i++) {
                    svg += ` L${path[i].x.toFixed(3)} ${path[i].y.toFixed(3)}`;
                }
                
                svg += ` Z"/>\n`;
            });
            
            svg += `  </g>\n`;
        });
        
        svg += `</svg>`;
        
        return svg;
    }
    
    /**
     * Export as downloadable SVG file
     */
    downloadSVG(vectorData, filename = 'vector-engraving.svg', options = {}) {
        const svgContent = this.toSVG(vectorData, options);
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}


/**
 * Alternative: Potrace-style vectorization for smoother curves
 * Uses bezier curves instead of straight line segments
 */
class BezierVectorizer extends ImageVectorizer {
    /**
     * Convert path to bezier curves using cubic spline fitting
     */
    pathToBezier(points) {
        if (points.length < 4) return this.pathToSVG(points);
        
        let path = `M${points[0].x.toFixed(3)} ${points[0].y.toFixed(3)}`;
        
        for (let i = 1; i < points.length - 2; i += 3) {
            const p0 = points[i];
            const p1 = points[Math.min(i + 1, points.length - 1)];
            const p2 = points[Math.min(i + 2, points.length - 1)];
            
            path += ` C${p0.x.toFixed(3)} ${p0.y.toFixed(3)}, `;
            path += `${p1.x.toFixed(3)} ${p1.y.toFixed(3)}, `;
            path += `${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
        }
        
        path += ` Z`;
        return path;
    }
}


// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ImageVectorizer, BezierVectorizer };
}
