/**
 * Grid Detector Module
 * Automatically detects grid structure in test grid photos
 * Handles perspective distortion, finds cell centers, and excludes QR code regions
 */

export class GridDetector {
    constructor() {
        this.debugMode = false;
    }

    /**
     * Main entry point: Analyze an image and detect the grid
     * @param {ImageData} imageData - The image data from canvas
     * @param {Object} hints - Optional hints {expectedCols, expectedRows}
     * @returns {Object} Detection result with grid info or failure
     */
    async detectGrid(imageData, hints = {}) {
        const { width, height, data } = imageData;

        // Step 1: Convert to grayscale
        const gray = this.toGrayscale(data, width, height);

        // Step 2: Find edges using Sobel operator
        const edges = this.detectEdges(gray, width, height);

        // Step 3: Find the card boundary (largest light rectangle)
        const cardBounds = this.findCardBoundary(gray, edges, width, height);

        if (!cardBounds) {
            return { success: false, reason: 'Could not detect card boundary' };
        }

        // Step 4: Warping - Rectify the image using the card corners
        // This ensures subsequent grid detection runs on a straight, normalized image
        const warpedResult = this.warpImage(imageData, cardBounds.corners);
        const warpedData = warpedResult.imageData;
        const warpedWidth = warpedData.width;
        const warpedHeight = warpedData.height;

        // Step 5: Re-calculate features on warped image
        const warpedGray = this.toGrayscale(warpedData.data, warpedWidth, warpedHeight);
        const warpedEdges = this.detectEdges(warpedGray, warpedWidth, warpedHeight);

        // Since we warped the image to fit the card bounds, the "card" is now
        // essentially the entire image (minus perhaps a very small sampling margin).
        // We can define a virtual card bounds for the warped image.
        const warpedCardBounds = {
            x: 0,
            y: 0,
            width: warpedWidth,
            height: warpedHeight
        };

        // Step 6: Detect grid lines on the warped image
        const gridLines = this.detectGridLines(warpedEdges, warpedWidth, warpedHeight, warpedCardBounds);

        if (!gridLines.horizontal.length || !gridLines.vertical.length) {
            return {
                success: false,
                reason: 'Could not detect grid lines',
                cardBounds
            };
        }

        // Step 7: Find grid intersections (cell corners) on warped image
        const cells = this.findCells(gridLines, warpedCardBounds, hints);

        if (!cells || cells.length === 0) {
            return {
                success: false,
                reason: 'Could not identify cells',
                cardBounds,
                gridLines
            };
        }

        // Step 8: Detect and exclude QR code region (on warped image)
        const { colorCells, qrRegion } = this.excludeQRRegion(cells, warpedGray, warpedWidth, warpedHeight);

        // Step 9: Find precise cell centers
        const cellsWithCenters = this.findCellCenters(colorCells, warpedGray, warpedWidth, warpedHeight);

        // Sample actual colors from the warped image
        const cellsWithColors = cellsWithCenters.map(cell => ({
            ...cell,
            color: this.sampleCellColor(warpedData, cell)
        }));

        return {
            success: true,
            cells: cellsWithColors,
            cardBounds, // Original bounds
            warpedImage: warpedResult, // Return the rectified image data
            gridLines,
            qrRegion,
            numRows: this.countRows(cellsWithCenters),
            numCols: this.countCols(cellsWithCenters)
        };
    }

    /**
     * Perspective warp an image to a rectified rectangle
     */
    warpImage(imageData, corners) {
        // Define target dimensions based on the max edge lengths of the detected quad
        // This preserves resolution
        const topW = Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2));
        const botW = Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2));
        const leftH = Math.sqrt(Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2));
        const rightH = Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2));

        // Use a fixed reasonable size for calibration stability, or dynamic
        // Fixed size is safer for consistent UI display (e.g. 800x600) but dynamic is higher fidelity
        // Let's use dynamic but capped to avoid massive memory usage
        const width = Math.min(2000, Math.round(Math.max(topW, botW)));
        const height = Math.min(2000, Math.round(Math.max(leftH, rightH)));

        // Create a canvas for the warp operation
        // (We can't do perspective warp purely in 2D canvas easily without libraries, 
        // so we'll do a manual inverse bilinear mapping pixel-by-pixel, similar to the frontend implementation)

        const destLen = width * height * 4;
        const destData = new Uint8ClampedArray(destLen);
        const srcData = imageData.data;
        const srcW = imageData.width;
        const srcH = imageData.height;

        // Helper for bilinear interpolation
        const interpolate = (p1, p2, t) => ({
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t
        });

        for (let y = 0; y < height; y++) {
            const ty = y / (height - 1);

            // Interpolate left and right edges first
            const left = interpolate(corners[0], corners[3], ty);  // TL -> BL
            const right = interpolate(corners[1], corners[2], ty); // TR -> BR

            for (let x = 0; x < width; x++) {
                const tx = x / (width - 1);

                // Interpolate between left and right points
                const srcPt = interpolate(left, right, tx);

                const srcX = Math.floor(srcPt.x);
                const srcY = Math.floor(srcPt.y);

                if (srcX >= 0 && srcX < srcW && srcY >= 0 && srcY < srcH) {
                    const srcIdx = (srcY * srcW + srcX) * 4;
                    const destIdx = (y * width + x) * 4;

                    destData[destIdx] = srcData[srcIdx];     // R
                    destData[destIdx + 1] = srcData[srcIdx + 1]; // G
                    destData[destIdx + 2] = srcData[srcIdx + 2]; // B
                    destData[destIdx + 3] = 255;             // A
                }
            }
        }

        return {
            imageData: new ImageData(destData, width, height),
            base64: null, // Can be generated later if needed
            width,
            height
        };
    }

    /**
     * Convert RGBA data to grayscale
     */
    toGrayscale(data, width, height) {
        const gray = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }
        return gray;
    }

    /**
     * Detect edges using Sobel operator
     */
    detectEdges(gray, width, height) {
        const edges = new Uint8Array(width * height);

        const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
        const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixel = gray[(y + ky) * width + (x + kx)];
                        gx += pixel * sobelX[ky + 1][kx + 1];
                        gy += pixel * sobelY[ky + 1][kx + 1];
                    }
                }

                edges[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
            }
        }

        return edges;
    }

    /**
     * Find the card boundary (the white/light rectangular card)
     */
    findCardBoundary(gray, edges, width, height) {
        // Find bright regions (the card is typically lighter than background)
        const threshold = this.otsuThreshold(gray, width, height);

        // Find connected bright regions
        const binary = new Uint8Array(width * height);
        for (let i = 0; i < gray.length; i++) {
            binary[i] = gray[i] > threshold ? 255 : 0;
        }

        // Find the largest bright region's bounding box
        let minX = width, maxX = 0, minY = height, maxY = 0;
        let found = false;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (binary[y * width + x] > 0) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                    found = true;
                }
            }
        }

        if (!found || maxX - minX < 50 || maxY - minY < 50) {
            return null;
        }

        // Add small margin
        const margin = 5;
        return {
            x: Math.max(0, minX - margin),
            y: Math.max(0, minY - margin),
            width: Math.min(width - minX + margin * 2, maxX - minX + margin * 2),
            height: Math.min(height - minY + margin * 2, maxY - minY + margin * 2),
            corners: [
                { x: minX, y: minY },     // TL
                { x: maxX, y: minY },     // TR
                { x: maxX, y: maxY },     // BR
                { x: minX, y: maxY }      // BL
            ]
        };
    }

    /**
     * Otsu's method for automatic thresholding
     */
    otsuThreshold(gray, width, height) {
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < gray.length; i++) {
            histogram[gray[i]]++;
        }

        const total = width * height;
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * histogram[i];

        let sumB = 0, wB = 0, wF = 0;
        let maxVariance = 0, threshold = 0;

        for (let t = 0; t < 256; t++) {
            wB += histogram[t];
            if (wB === 0) continue;
            wF = total - wB;
            if (wF === 0) break;

            sumB += t * histogram[t];
            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;

            const variance = wB * wF * (mB - mF) * (mB - mF);
            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = t;
            }
        }

        return threshold;
    }

    /**
     * Detect grid lines within the card boundary
     */
    detectGridLines(edges, width, height, cardBounds) {
        const { x: bx, y: by, width: bw, height: bh } = cardBounds;

        // Accumulate horizontal and vertical edge strengths
        const hStrength = new Array(bh).fill(0);
        const vStrength = new Array(bw).fill(0);

        for (let y = by; y < by + bh && y < height; y++) {
            for (let x = bx; x < bx + bw && x < width; x++) {
                const edge = edges[y * width + x];
                hStrength[y - by] += edge;
                vStrength[x - bx] += edge;
            }
        }

        // Find peaks (grid lines)
        const hLines = this.findPeaks(hStrength, by);
        const vLines = this.findPeaks(vStrength, bx);

        return { horizontal: hLines, vertical: vLines };
    }

    /**
     * Find peaks in an array (positions of grid lines)
     */
    findPeaks(arr, offset) {
        const peaks = [];
        const smoothed = this.smooth(arr, 3);
        const mean = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
        const threshold = mean * 1.5;

        for (let i = 2; i < smoothed.length - 2; i++) {
            if (smoothed[i] > threshold &&
                smoothed[i] > smoothed[i - 1] &&
                smoothed[i] > smoothed[i + 1] &&
                smoothed[i] > smoothed[i - 2] &&
                smoothed[i] > smoothed[i + 2]) {
                peaks.push(i + offset);
            }
        }

        // Filter peaks that are too close together
        return this.filterClosepeaks(peaks, 10);
    }

    /**
     * Simple moving average smoothing
     */
    smooth(arr, windowSize) {
        const result = new Array(arr.length).fill(0);
        const half = Math.floor(windowSize / 2);

        for (let i = 0; i < arr.length; i++) {
            let sum = 0, count = 0;
            for (let j = i - half; j <= i + half; j++) {
                if (j >= 0 && j < arr.length) {
                    sum += arr[j];
                    count++;
                }
            }
            result[i] = sum / count;
        }

        return result;
    }

    /**
     * Filter peaks that are too close together
     */
    filterClosepeaks(peaks, minDistance) {
        if (peaks.length === 0) return peaks;

        const filtered = [peaks[0]];
        for (let i = 1; i < peaks.length; i++) {
            if (peaks[i] - filtered[filtered.length - 1] >= minDistance) {
                filtered.push(peaks[i]);
            }
        }

        return filtered;
    }

    /**
     * Find cells from grid line intersections
     */
    findCells(gridLines, cardBounds, hints) {
        const { horizontal: hLines, vertical: vLines } = gridLines;

        if (hLines.length < 2 || vLines.length < 2) {
            return null;
        }

        const cells = [];

        for (let r = 0; r < hLines.length - 1; r++) {
            for (let c = 0; c < vLines.length - 1; c++) {
                cells.push({
                    row: r,
                    col: c,
                    bounds: {
                        top: hLines[r],
                        bottom: hLines[r + 1],
                        left: vLines[c],
                        right: vLines[c + 1]
                    },
                    center: {
                        x: (vLines[c] + vLines[c + 1]) / 2,
                        y: (hLines[r] + hLines[r + 1]) / 2
                    }
                });
            }
        }

        return cells;
    }

    /**
     * Detect and exclude QR code region
     * QR codes have high-frequency patterns (many edge transitions)
     */
    excludeQRRegion(cells, gray, width, height) {
        const cellVariances = cells.map(cell => {
            const variance = this.calculateCellVariance(cell, gray, width, height);
            return { ...cell, variance };
        });

        // QR code cells have high variance (many black/white transitions)
        const meanVariance = cellVariances.reduce((a, c) => a + c.variance, 0) / cellVariances.length;
        const highVarianceThreshold = meanVariance * 2;

        // Find cluster of high-variance cells (likely QR code)
        const highVarianceCells = cellVariances.filter(c => c.variance > highVarianceThreshold);

        let qrRegion = null;

        if (highVarianceCells.length >= 4) {
            // Find bounding box of high variance region
            const qrRows = [...new Set(highVarianceCells.map(c => c.row))];
            const qrCols = [...new Set(highVarianceCells.map(c => c.col))];

            if (qrRows.length >= 2 && qrCols.length >= 2) {
                qrRegion = {
                    minRow: Math.min(...qrRows),
                    maxRow: Math.max(...qrRows),
                    minCol: Math.min(...qrCols),
                    maxCol: Math.max(...qrCols)
                };
            }
        }

        // Filter out QR region cells
        const colorCells = qrRegion
            ? cellVariances.filter(c =>
                c.row < qrRegion.minRow || c.row > qrRegion.maxRow ||
                c.col < qrRegion.minCol || c.col > qrRegion.maxCol)
            : cellVariances;

        return { colorCells, qrRegion };
    }

    /**
     * Calculate variance within a cell (high = QR, low = solid color)
     */
    calculateCellVariance(cell, gray, width, height) {
        const { bounds } = cell;
        const margin = 2;

        const top = Math.max(0, Math.round(bounds.top) + margin);
        const bottom = Math.min(height - 1, Math.round(bounds.bottom) - margin);
        const left = Math.max(0, Math.round(bounds.left) + margin);
        const right = Math.min(width - 1, Math.round(bounds.right) - margin);

        let sum = 0, sumSq = 0, count = 0;

        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) {
                const val = gray[y * width + x];
                sum += val;
                sumSq += val * val;
                count++;
            }
        }

        if (count === 0) return 0;

        const mean = sum / count;
        return (sumSq / count) - (mean * mean);
    }

    /**
     * Find accurate cell centers by analyzing color distribution
     */
    findCellCenters(cells, gray, width, height) {
        return cells.map(cell => {
            const { bounds } = cell;

            // Sample a grid of points within the cell
            const margin = Math.min(
                (bounds.right - bounds.left) * 0.15,
                (bounds.bottom - bounds.top) * 0.15
            );

            const innerLeft = bounds.left + margin;
            const innerRight = bounds.right - margin;
            const innerTop = bounds.top + margin;
            const innerBottom = bounds.bottom - margin;

            // Find the point with most consistent color around it
            let bestCenter = {
                x: (bounds.left + bounds.right) / 2,
                y: (bounds.top + bounds.bottom) / 2
            };

            // For now, use the geometric center with margin
            // This avoids grid lines affecting the color sample
            return {
                ...cell,
                center: bestCenter,
                sampleBounds: {
                    left: innerLeft,
                    right: innerRight,
                    top: innerTop,
                    bottom: innerBottom
                }
            };
        });
    }

    /**
     * Count unique rows in cells
     */
    countRows(cells) {
        return new Set(cells.map(c => c.row)).size;
    }

    /**
     * Count unique cols in cells
     */
    countCols(cells) {
        return new Set(cells.map(c => c.col)).size;
    }

    /**
     * Sample average color from a cell
     * @param {ImageData} imageData - Full image data
     * @param {Object} cell - Cell with sampleBounds
     * @returns {Object} {r, g, b}
     */
    sampleCellColor(imageData, cell) {
        const { data, width, height } = imageData;
        const { sampleBounds } = cell;

        if (!sampleBounds) {
            // Fallback to center point
            const x = Math.round(cell.center.x);
            const y = Math.round(cell.center.y);
            const idx = (y * width + x) * 4;
            return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
        }

        let rSum = 0, gSum = 0, bSum = 0, count = 0;

        const left = Math.max(0, Math.round(sampleBounds.left));
        const right = Math.min(width - 1, Math.round(sampleBounds.right));
        const top = Math.max(0, Math.round(sampleBounds.top));
        const bottom = Math.min(height - 1, Math.round(sampleBounds.bottom));

        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) {
                const idx = (y * width + x) * 4;
                rSum += data[idx];
                gSum += data[idx + 1];
                bSum += data[idx + 2];
                count++;
            }
        }

        if (count === 0) {
            return { r: 0, g: 0, b: 0 };
        }

        return {
            r: Math.round(rSum / count),
            g: Math.round(gSum / count),
            b: Math.round(bSum / count)
        };
    }
}
