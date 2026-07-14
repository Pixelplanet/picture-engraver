/**
 * Image Cleanup Module
 *
 * Operates on a palette-indexed "label map" (Int32Array, one palette index per
 * pixel; -1 = transparent). This is the source of truth for all cleanup passes
 * and manual paint edits, allowing the vector output to be rebuilt without
 * re-running the (expensive) color quantization step.
 *
 * All functions are pure and use typed arrays for performance on large images.
 */

/**
 * Perceptual color distance ("redmean" weighted RGB). Cheap approximation of
 * human color perception without a full Lab conversion. Range ~0..765.
 */
export function colorDistance(c1, c2) {
    const rmean = (c1.r + c2.r) / 2;
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(
        (2 + rmean / 256) * dr * dr +
        4 * dg * dg +
        (2 + (255 - rmean) / 256) * db * db
    );
}

/**
 * Build a palette-indexed label map from an ImageData.
 * @param {ImageData|{data:Uint8ClampedArray,width:number,height:number}} imageData
 * @param {Array<{r:number,g:number,b:number}>} palette
 * @returns {Int32Array} label map (-1 for transparent pixels)
 */
export function buildLabelMap(imageData, palette) {
    const { data, width, height } = imageData;
    const n = width * height;
    const map = new Int32Array(n);
    const pr = new Int32Array(palette.length);
    const pg = new Int32Array(palette.length);
    const pb = new Int32Array(palette.length);
    for (let c = 0; c < palette.length; c++) {
        pr[c] = palette[c].r;
        pg[c] = palette[c].g;
        pb[c] = palette[c].b;
    }

    for (let px = 0; px < n; px++) {
        const i = px * 4;
        if (data[i + 3] < 128) {
            map[px] = -1;
            continue;
        }
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let best = 0;
        let bestD = Infinity;
        for (let c = 0; c < palette.length; c++) {
            const dr = r - pr[c];
            const dg = g - pg[c];
            const db = b - pb[c];
            const d = dr * dr + dg * dg + db * db;
            if (d < bestD) {
                bestD = d;
                best = c;
                if (d === 0) break;
            }
        }
        map[px] = best;
    }
    return map;
}

/**
 * Convert a label map back into an ImageData for canvas display / vectorization.
 * @param {Int32Array} labelMap
 * @param {Array<{r:number,g:number,b:number}>} palette
 * @param {number} width
 * @param {number} height
 * @returns {ImageData}
 */
export function labelMapToImageData(labelMap, palette, width, height) {
    const out = new Uint8ClampedArray(width * height * 4);
    for (let px = 0; px < labelMap.length; px++) {
        const l = labelMap[px];
        const i = px * 4;
        if (l < 0) {
            out[i + 3] = 0;
            continue;
        }
        const c = palette[l];
        out[i] = c.r;
        out[i + 1] = c.g;
        out[i + 2] = c.b;
        out[i + 3] = 255;
    }
    return new ImageData(out, width, height);
}

/**
 * Remove stray pixels / tiny islands.
 *
 * Finds 4-connected components of equal label and reassigns any opaque component
 * smaller than `minSize` to the color that dominates its border. Transparent
 * regions (label -1) are never merged and never absorb neighbors.
 *
 * @param {Int32Array} labelMap
 * @param {number} width
 * @param {number} height
 * @param {number} minSize - minimum island size in pixels (<=0 disables)
 * @returns {Int32Array} new label map (input is not mutated)
 */
export function despeckle(labelMap, width, height, minSize) {
    if (minSize <= 0) return labelMap;
    const n = width * height;
    const compId = new Int32Array(n).fill(-1);
    const stack = new Int32Array(n);
    const compSize = [];
    const compLabel = [];
    let comp = 0;

    // 1. Label connected components (4-connectivity, same label value)
    for (let start = 0; start < n; start++) {
        if (compId[start] !== -1) continue;
        const label = labelMap[start];
        let sp = 0;
        stack[sp++] = start;
        compId[start] = comp;
        let size = 0;
        while (sp > 0) {
            const px = stack[--sp];
            size++;
            const x = px % width;
            const y = (px - x) / width;
            if (x > 0) {
                const nb = px - 1;
                if (compId[nb] === -1 && labelMap[nb] === label) { compId[nb] = comp; stack[sp++] = nb; }
            }
            if (x < width - 1) {
                const nb = px + 1;
                if (compId[nb] === -1 && labelMap[nb] === label) { compId[nb] = comp; stack[sp++] = nb; }
            }
            if (y > 0) {
                const nb = px - width;
                if (compId[nb] === -1 && labelMap[nb] === label) { compId[nb] = comp; stack[sp++] = nb; }
            }
            if (y < height - 1) {
                const nb = px + width;
                if (compId[nb] === -1 && labelMap[nb] === label) { compId[nb] = comp; stack[sp++] = nb; }
            }
        }
        compSize.push(size);
        compLabel.push(label);
        comp++;
    }

    // 2. Collect small opaque components
    const votes = new Map(); // compId -> Map(label -> count)
    for (let c = 0; c < comp; c++) {
        if (compLabel[c] !== -1 && compSize[c] < minSize) votes.set(c, new Map());
    }
    if (votes.size === 0) return labelMap;

    // 3. Tally border-neighbor labels for each small component
    for (let px = 0; px < n; px++) {
        const c = compId[px];
        const v = votes.get(c);
        if (!v) continue;
        const x = px % width;
        const y = (px - x) / width;
        const tally = (nb) => {
            if (compId[nb] === c) return;
            const nl = labelMap[nb];
            if (nl !== -1) v.set(nl, (v.get(nl) || 0) + 1);
        };
        if (x > 0) tally(px - 1);
        if (x < width - 1) tally(px + 1);
        if (y > 0) tally(px - width);
        if (y < height - 1) tally(px + width);
    }

    // 4. Pick winning neighbor label per small component
    const winner = new Map();
    for (const [c, v] of votes) {
        let best = -1;
        let bestCount = 0;
        for (const [label, count] of v) {
            if (count > bestCount) { bestCount = count; best = label; }
        }
        if (best !== -1) winner.set(c, best);
    }
    if (winner.size === 0) return labelMap;

    // 5. Apply reassignment
    const out = new Int32Array(labelMap);
    for (let px = 0; px < n; px++) {
        const w = winner.get(compId[px]);
        if (w !== undefined) out[px] = w;
    }
    return out;
}

/**
 * Merge perceptually-similar palette colors ("smooth gradients").
 *
 * Agglomeratively merges the closest pair of palette colors while their distance
 * is below `threshold`, weighting the merged color by pixel population. Collapses
 * banded gradients (e.g. one gradient split into 10 near-identical colors) into
 * fewer solid colors. Palette size is small (<=32) so O(k^2) per merge is fine.
 *
 * @param {Array<{r:number,g:number,b:number}>} palette
 * @param {Int32Array} labelMap
 * @param {number} threshold - perceptual distance below which colors merge (<=0 disables)
 * @returns {{palette:Array, labelMap:Int32Array, changed:boolean}}
 */
export function mergeSimilarColors(palette, labelMap, threshold) {
    if (threshold <= 0 || palette.length <= 1) {
        return { palette, labelMap, changed: false };
    }

    const k = palette.length;
    const counts = new Array(k).fill(0);
    for (let i = 0; i < labelMap.length; i++) {
        const l = labelMap[i];
        if (l >= 0) counts[l]++;
    }

    const clusters = palette.map((c, i) => ({
        r: c.r, g: c.g, b: c.b,
        count: counts[i] || 0,
        members: [i],
        alive: true
    }));

    let mergedAny = false;
    while (true) {
        let bestD = Infinity;
        let a = -1;
        let b = -1;
        for (let i = 0; i < clusters.length; i++) {
            if (!clusters[i].alive) continue;
            for (let j = i + 1; j < clusters.length; j++) {
                if (!clusters[j].alive) continue;
                const d = colorDistance(clusters[i], clusters[j]);
                if (d < bestD) { bestD = d; a = i; b = j; }
            }
        }
        if (a === -1 || bestD > threshold) break;

        const ca = clusters[a];
        const cb = clusters[b];
        const tot = ca.count + cb.count || 1;
        ca.r = Math.round((ca.r * ca.count + cb.r * cb.count) / tot);
        ca.g = Math.round((ca.g * ca.count + cb.g * cb.count) / tot);
        ca.b = Math.round((ca.b * ca.count + cb.b * cb.count) / tot);
        ca.count = tot;
        ca.members = ca.members.concat(cb.members);
        cb.alive = false;
        mergedAny = true;
    }

    if (!mergedAny) return { palette, labelMap, changed: false };

    const newPalette = [];
    const remap = new Int32Array(k).fill(-1);
    for (const cl of clusters) {
        if (!cl.alive) continue;
        const ni = newPalette.length;
        newPalette.push({ r: cl.r, g: cl.g, b: cl.b });
        for (const m of cl.members) remap[m] = ni;
    }

    const newMap = new Int32Array(labelMap.length);
    for (let i = 0; i < labelMap.length; i++) {
        const l = labelMap[i];
        newMap[i] = l >= 0 ? remap[l] : -1;
    }

    return { palette: newPalette, labelMap: newMap, changed: true };
}
