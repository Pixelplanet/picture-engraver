/**
 * Paint Tool Module
 *
 * Interactive touch-up operations on a palette-indexed label map (see
 * image-cleanup.js). All operations mutate the provided label map in place and
 * return whether anything actually changed, so callers can skip needless
 * re-renders. Painting only ever uses existing palette indices, so the layer
 * set (and color count) stays stable.
 */

/**
 * Nearest palette index for an RGB color (squared-distance, exact match wins).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {Array<{r:number,g:number,b:number}>} palette
 * @returns {number} palette index (0 if palette empty)
 */
export function nearestPaletteIndex(r, g, b, palette) {
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < palette.length; c++) {
        const p = palette[c];
        const dr = r - p.r;
        const dg = g - p.g;
        const db = b - p.b;
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
            bestD = d;
            best = c;
            if (d === 0) break;
        }
    }
    return best;
}

/**
 * Flood-fill a contiguous 4-connected region that shares the label at (px).
 * @param {Int32Array} labelMap
 * @param {number} width
 * @param {number} height
 * @param {number} startPx - linear pixel index of the seed
 * @param {number} newLabel - palette index to paint
 * @returns {boolean} true if any pixel changed
 */
export function floodFill(labelMap, width, height, startPx, newLabel) {
    const target = labelMap[startPx];
    if (target === newLabel || target < 0) return false;

    const n = width * height;
    const stack = new Int32Array(n);
    let sp = 0;
    stack[sp++] = startPx;
    let changed = false;

    while (sp > 0) {
        const px = stack[--sp];
        if (labelMap[px] !== target) continue;
        labelMap[px] = newLabel;
        changed = true;
        const x = px % width;
        const y = (px - x) / width;
        if (x > 0 && labelMap[px - 1] === target) stack[sp++] = px - 1;
        if (x < width - 1 && labelMap[px + 1] === target) stack[sp++] = px + 1;
        if (y > 0 && labelMap[px - width] === target) stack[sp++] = px - width;
        if (y < height - 1 && labelMap[px + width] === target) stack[sp++] = px + width;
    }
    return changed;
}

/**
 * Paint a filled circular brush stroke of `newLabel` centered at (cx, cy).
 * Transparent pixels (label -1) are left untouched.
 * @param {Int32Array} labelMap
 * @param {number} width
 * @param {number} height
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius - brush radius in pixels
 * @param {number} newLabel - palette index to paint
 * @returns {boolean} true if any pixel changed
 */
export function paintBrush(labelMap, width, height, cx, cy, radius, newLabel) {
    const r = Math.max(0, Math.floor(radius));
    const r2 = (r + 0.5) * (r + 0.5);
    const x0 = Math.max(0, cx - r);
    const x1 = Math.min(width - 1, cx + r);
    const y0 = Math.max(0, cy - r);
    const y1 = Math.min(height - 1, cy + r);
    let changed = false;

    for (let y = y0; y <= y1; y++) {
        const dy = y - cy;
        for (let x = x0; x <= x1; x++) {
            const dx = x - cx;
            if (dx * dx + dy * dy > r2) continue;
            const px = y * width + x;
            if (labelMap[px] < 0) continue; // don't paint into transparency
            if (labelMap[px] !== newLabel) {
                labelMap[px] = newLabel;
                changed = true;
            }
        }
    }
    return changed;
}
