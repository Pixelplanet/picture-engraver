/**
 * Pipeline Test Script for Picture Engraver
 * 
 * Runs an image through the complete pipeline and outputs diagnostics at each step.
 * Designed for LLM agent rapid prototyping and optimization.
 * 
 * Usage: node pipeline-test.mjs <image_path> [options]
 * 
 * Options:
 *   --colors <n>     Number of colors (default: 6)
 *   --width <mm>     Output width in mm (default: 100)
 *   --output <dir>   Output directory (default: testfile/)
 *   --verbose        Show detailed diagnostics
 *   --json           Output machine-readable JSON report only
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

// ========== Configuration ==========
const DEFAULT_CONFIG = {
    colors: 6,
    width: 100,        // mm
    pxPerMm: 10,
    output: 'testfile',
    verbose: false,
    json: false
};

const SETTINGS = {
    power: 70,
    speed: 425,
    passes: 1,
    crossHatch: true,
    freqMin: 40,
    freqMax: 80,
    lpiMin: 300,
    lpiMax: 800
};

// ========== Utility Functions ==========
function parseArgs() {
    const args = process.argv.slice(2);
    const config = { ...DEFAULT_CONFIG };

    if (args.length === 0 || args[0].startsWith('--')) {
        console.error('Usage: node pipeline-test.mjs <image_path> [options]');
        console.error('Options:');
        console.error('  --colors <n>     Number of colors (default: 6)');
        console.error('  --width <mm>     Output width in mm (default: 100)');
        console.error('  --output <dir>   Output directory (default: testfile/)');
        console.error('  --verbose        Show detailed diagnostics');
        console.error('  --json           Output machine-readable JSON report only');
        process.exit(1);
    }

    config.imagePath = args[0];

    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--colors':
                config.colors = parseInt(args[++i]) || DEFAULT_CONFIG.colors;
                break;
            case '--width':
                config.width = parseInt(args[++i]) || DEFAULT_CONFIG.width;
                break;
            case '--output':
                config.output = args[++i] || DEFAULT_CONFIG.output;
                break;
            case '--verbose':
                config.verbose = true;
                break;
            case '--json':
                config.json = true;
                break;
        }
    }

    return config;
}

function log(msg, config) {
    if (!config.json) console.log(msg);
}

function logVerbose(msg, config) {
    if (config.verbose && !config.json) console.log('  ' + msg);
}

function colorToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function colorToInt(r, g, b) {
    return (r << 16) + (g << 8) + b;
}

// ========== Color Quantizer ==========
class ColorQuantizer {
    quantize(imageData, numColors, excludeWhite = true) {
        const pixels = this.extractPixels(imageData, excludeWhite);
        const palette = this.medianCut(pixels, numColors);
        const filteredPalette = excludeWhite
            ? palette.filter(c => c.r < 250 || c.g < 250 || c.b < 250)
            : palette;
        const quantizedImage = this.applyPalette(imageData, filteredPalette);
        return { quantizedImage, palette: filteredPalette };
    }

    extractPixels(imageData, excludeWhite) {
        const pixels = [];
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (excludeWhite && r > 245 && g > 245 && b > 245) continue;
            pixels.push({ r, g, b });
        }
        return pixels;
    }

    medianCut(pixels, numColors) {
        if (pixels.length === 0) return [{ r: 128, g: 128, b: 128 }];
        let buckets = [pixels];
        while (buckets.length < numColors) {
            let maxRange = 0, maxRangeIndex = 0, splitChannel = 'r';
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
            const bucketToSplit = buckets[maxRangeIndex];
            bucketToSplit.sort((a, b) => a[splitChannel] - b[splitChannel]);
            const mid = Math.floor(bucketToSplit.length / 2);
            buckets.splice(maxRangeIndex, 1, bucketToSplit.slice(0, mid), bucketToSplit.slice(mid));
        }
        return buckets.map(bucket => this.averageColor(bucket));
    }

    getColorRanges(bucket) {
        let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
        bucket.forEach(pixel => {
            minR = Math.min(minR, pixel.r); maxR = Math.max(maxR, pixel.r);
            minG = Math.min(minG, pixel.g); maxG = Math.max(maxG, pixel.g);
            minB = Math.min(minB, pixel.b); maxB = Math.max(maxB, pixel.b);
        });
        return { r: maxR - minR, g: maxG - minG, b: maxB - minB };
    }

    averageColor(bucket) {
        if (bucket.length === 0) return { r: 128, g: 128, b: 128 };
        let sumR = 0, sumG = 0, sumB = 0;
        bucket.forEach(pixel => { sumR += pixel.r; sumG += pixel.g; sumB += pixel.b; });
        return {
            r: Math.round(sumR / bucket.length),
            g: Math.round(sumG / bucket.length),
            b: Math.round(sumB / bucket.length)
        };
    }

    applyPalette(imageData, palette) {
        const newData = new Uint8ClampedArray(imageData.data);
        for (let i = 0; i < newData.length; i += 4) {
            const pixel = { r: newData[i], g: newData[i + 1], b: newData[i + 2] };
            if (pixel.r > 245 && pixel.g > 245 && pixel.b > 245) {
                newData[i] = 255; newData[i + 1] = 255; newData[i + 2] = 255;
                continue;
            }
            const closest = this.findClosestColor(pixel, palette);
            newData[i] = closest.r; newData[i + 1] = closest.g; newData[i + 2] = closest.b;
        }
        return { data: newData, width: imageData.width, height: imageData.height };
    }

    findClosestColor(pixel, palette) {
        let minDistance = Infinity, closest = palette[0];
        palette.forEach(color => {
            const distance = Math.sqrt(
                Math.pow(pixel.r - color.r, 2) +
                Math.pow(pixel.g - color.g, 2) +
                Math.pow(pixel.b - color.b, 2)
            );
            if (distance < minDistance) { minDistance = distance; closest = color; }
        });
        return closest;
    }
}

// ========== Vectorizer (Rectangle Merging) ==========
function createMergedRectPaths(quantizedData, color, pxPerMm) {
    const { data, width, height } = quantizedData;
    const scale = 1 / pxPerMm;
    const tolerance = 3;

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

    const rects = [];
    const visited = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (grid[idx] === 1 && !visited[idx]) {
                let maxW = 0;
                for (let tx = x; tx < width && grid[y * width + tx] === 1 && !visited[y * width + tx]; tx++) {
                    maxW++;
                }
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
                for (let ty = y; ty < y + rectH; ty++) {
                    for (let tx = x; tx < x + maxW; tx++) {
                        visited[ty * width + tx] = 1;
                    }
                }
                rects.push({ x, y, w: maxW, h: rectH });
            }
        }
    }

    const paths = rects.map(r => {
        const x1 = (r.x * scale).toFixed(3);
        const y1 = (r.y * scale).toFixed(3);
        const x2 = ((r.x + r.w) * scale).toFixed(3);
        const y2 = ((r.y + r.h) * scale).toFixed(3);
        return `M${x1} ${y1} L${x2} ${y1} L${x2} ${y2} L${x1} ${y2} Z`;
    });

    return { paths, rectCount: rects.length };
}

// ========== XCS Generator ==========
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Calculate bounding box of paths and normalize them to start at (0,0)
 * xTool expects paths to be relative to the display's x,y position
 */
function calculateBoundsAndNormalize(combinedPath) {
    const tokens = combinedPath.match(/[a-df-z]+|[-+]?\d*\.?\d+/gi);
    if (!tokens) return { dPath: combinedPath, bounds: { x: 0, y: 0, width: 100, height: 100 } };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let isX = true;

    // Pass 1: Calculate bounds
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (/[a-z]/i.test(token)) continue;
        const val = parseFloat(token);
        if (!isNaN(val)) {
            if (isX) {
                minX = Math.min(minX, val);
                maxX = Math.max(maxX, val);
            } else {
                minY = Math.min(minY, val);
                maxY = Math.max(maxY, val);
            }
            isX = !isX;
        }
    }

    if (minX === Infinity) {
        return { dPath: combinedPath, bounds: { x: 0, y: 0, width: 100, height: 100 } };
    }

    // Pass 2: Shift coordinates to start at (0,0)
    let normalizedPath = '';
    isX = true;
    let lastWasCommand = false;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (/[a-z]/i.test(token)) {
            normalizedPath += (normalizedPath.length > 0 ? ' ' : '') + token;
            lastWasCommand = true;
            continue;
        }
        const val = parseFloat(token);
        if (!isNaN(val)) {
            const shifted = isX ? (val - minX) : (val - minY);
            const prefix = lastWasCommand ? '' : ' ';
            normalizedPath += prefix + shifted.toFixed(3);
            isX = !isX;
            lastWasCommand = false;
        }
    }

    return {
        dPath: normalizedPath.trim(),
        bounds: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        }
    };
}

function createPathDisplay(id, name, colorHex, colorInt, x, y, width, height, zOrder, dPath) {
    return {
        id, name, type: 'PATH',
        x, y, angle: 0,
        scale: { x: 1, y: 1 },
        skew: { x: 0, y: 0 },
        pivot: { x: 0, y: 0 },
        localSkew: { x: 0, y: 0 },
        offsetX: x, offsetY: y,
        lockRatio: false, isClosePath: true,
        zOrder, sourceId: '', groupTag: '',
        layerTag: colorHex, layerColor: colorHex,
        visible: true, originColor: colorHex,
        enableTransform: true, visibleState: true, lockState: false,
        resourceOrigin: '', customData: {},
        rootComponentId: '', minCanvasVersion: '0.0.0',
        fill: { paintType: 'color', visible: true, color: colorInt, alpha: 1 },
        stroke: { paintType: 'color', visible: false, color: colorInt, alpha: 1, width: 0.1, cap: 'butt', join: 'miter', miterLimit: 4, alignment: 0.5 },
        width, height, points: [], dPath,
        fillRule: 'nonzero', graphicX: x, graphicY: y,
        isCompoundPath: true, isFill: true,
        lineColor: colorInt, fillColor: colorHex
    };
}

function createDisplaySettings(layer, settings) {
    return {
        isFill: true, type: 'PATH', processingType: 'FILL_VECTOR_ENGRAVING',
        data: {
            VECTOR_CUTTING: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { power: settings.power, speed: settings.speed, repeat: settings.passes, frequency: 40 } } },
            VECTOR_ENGRAVING: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { speed: settings.speed, power: settings.power, repeat: settings.passes, frequency: 40 } } },
            FILL_VECTOR_ENGRAVING: {
                materialType: 'customize', planType: 'dot_cloud',
                parameter: { customize: { bitmapEngraveMode: 'normal', speed: settings.speed, density: layer.lpi, dpi: layer.lpi, power: settings.power, repeat: settings.passes, bitmapScanMode: settings.crossHatch ? 'crossMode' : 'zMode', frequency: layer.frequency, crossAngle: settings.crossHatch, scanAngle: 0, angleType: 2 } }
            },
            INTAGLIO: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { speed: 80, density: 300, power: 1, repeat: 1, frequency: 40 } } },
            INNER_THREE_D: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { subdivide: 0.1, speed: 80, power: 1, repeat: 1, frequency: 40 } } }
        },
        processIgnore: false
    };
}

function generateXCS(layers, size, settings) {
    const canvasId = generateUUID();
    const now = Date.now();

    const displays = [];
    const displaySettings = [];

    layers.forEach((layer, layerIndex) => {
        const colorHex = colorToHex(layer.color.r, layer.color.g, layer.color.b);
        const colorInt = colorToInt(layer.color.r, layer.color.g, layer.color.b);

        if (layer.paths && layer.paths.length > 0) {
            const combinedPath = layer.paths.join(' ');

            // Calculate bounds and normalize paths to start at (0,0)
            const { dPath: normalizedPath, bounds } = calculateBoundsAndNormalize(combinedPath);

            const displayId = generateUUID();
            const display = createPathDisplay(
                displayId, layer.name, colorHex, colorInt,
                bounds.x, bounds.y, bounds.width, bounds.height,
                layerIndex + 1, normalizedPath
            );
            displays.push(display);
            displaySettings.push([displayId, createDisplaySettings(layer, settings)]);
        }
    });

    const layerData = {};
    layers.forEach((layer, index) => {
        const colorHex = colorToHex(layer.color.r, layer.color.g, layer.color.b);
        layerData[colorHex] = { name: layer.name, order: index + 1, visible: true };
    });

    return {
        canvasId,
        canvas: [{ id: canvasId, title: 'Engraved Image', layerData, groupData: {}, displays }],
        extId: 'GS009-CLASS-4', extName: 'F2 Ultra UV', version: '1.3.6',
        created: now, modify: now,
        device: {
            id: 'GS009-CLASS-4', power: [5],
            data: {
                dataType: 'Map',
                value: [[canvasId, {
                    mode: 'LASER_PLANE',
                    data: { LASER_PLANE: { material: 0, lightSourceMode: 'uv', thickness: 117, isProcessByLayer: false, pathPlanning: 'auto', fillPlanning: 'separate' } },
                    displays: { dataType: 'Map', value: displaySettings }
                }]]
            },
            materialList: [], materialTypeList: [],
            customProjectData: { tangentialCuttingUuids: [], flyCutUuid2CanvasIds: {} }
        }
    };
}

// ========== Validation ==========
function validateXCS(xcs, layers) {
    const errors = [];
    const warnings = [];

    // Check valid JSON structure
    if (!xcs.canvas || !xcs.canvas[0]) {
        errors.push('Missing canvas structure');
    }

    const displays = xcs.canvas?.[0]?.displays || [];

    // Check all layers have displays
    if (displays.length !== layers.filter(l => l.paths.length > 0).length) {
        warnings.push(`Display count (${displays.length}) doesn't match layer count`);
    }

    // Check each display
    displays.forEach((disp, i) => {
        if (!disp.dPath || disp.dPath.length === 0) {
            errors.push(`Display ${i} has empty dPath`);
        }
        if (disp.width === 0 || disp.height === 0) {
            errors.push(`Display ${i} has zero dimension`);
        }
        // Check path coordinates are valid numbers
        const pathMatch = disp.dPath?.match(/[0-9.-]+/g);
        if (pathMatch) {
            pathMatch.forEach(num => {
                const val = parseFloat(num);
                if (isNaN(val)) {
                    errors.push(`Display ${i} has invalid path coordinate: ${num}`);
                }
            });
        }
    });

    // Check frequency/LPI ranges
    layers.forEach((layer, i) => {
        if (layer.frequency < 20 || layer.frequency > 100) {
            warnings.push(`Layer ${i} frequency ${layer.frequency} outside typical range (20-100 kHz)`);
        }
        if (layer.lpi < 100 || layer.lpi > 1000) {
            warnings.push(`Layer ${i} LPI ${layer.lpi} outside typical range (100-1000)`);
        }
    });

    return { errors, warnings, valid: errors.length === 0 };
}

// ========== Main Pipeline ==========
async function runPipeline(config) {
    const report = {
        input: config.imagePath,
        config: {
            colors: config.colors,
            width: config.width,
            pxPerMm: config.pxPerMm
        },
        stages: {},
        palette: [],
        layers: [],
        validation: {},
        outputFiles: {}
    };

    const baseName = path.basename(config.imagePath, path.extname(config.imagePath));
    const outputDir = config.output;

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    log(`\n╔══════════════════════════════════════════════════════════╗`, config);
    log(`║       PICTURE ENGRAVER PIPELINE TEST                     ║`, config);
    log(`╚══════════════════════════════════════════════════════════╝\n`, config);

    // ===== STAGE 1: Load & Resize =====
    log(`▸ Stage 1: Load & Resize`, config);
    const startResize = Date.now();

    const img = await loadImage(config.imagePath);
    logVerbose(`Original: ${img.width} x ${img.height}px`, config);

    // Calculate output dimensions maintaining aspect ratio
    let widthMm, heightMm;
    if (img.width > img.height) {
        widthMm = config.width;
        heightMm = Math.round(config.width * img.height / img.width);
    } else {
        heightMm = config.width;
        widthMm = Math.round(config.width * img.width / img.height);
    }

    const widthPx = widthMm * config.pxPerMm;
    const heightPx = heightMm * config.pxPerMm;

    const canvas = createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, widthPx, heightPx);
    const imageData = ctx.getImageData(0, 0, widthPx, heightPx);

    report.stages.resize = {
        duration: Date.now() - startResize,
        inputSize: { width: img.width, height: img.height },
        outputSize: { widthMm, heightMm, widthPx, heightPx }
    };

    // Save resized image
    const resizedPath = path.join(outputDir, `${baseName}_1_resized.png`);
    fs.writeFileSync(resizedPath, canvas.toBuffer('image/png'));
    report.outputFiles.resized = resizedPath;

    logVerbose(`Output: ${widthMm}mm x ${heightMm}mm (${widthPx}x${heightPx}px)`, config);
    log(`  ✓ Complete (${report.stages.resize.duration}ms)`, config);

    // ===== STAGE 2: Quantization =====
    log(`▸ Stage 2: Color Quantization`, config);
    const startQuantize = Date.now();

    const quantizer = new ColorQuantizer();
    const { quantizedImage, palette } = quantizer.quantize(imageData, config.colors, true);

    report.stages.quantize = {
        duration: Date.now() - startQuantize,
        colorCount: palette.length
    };
    report.palette = palette.map(c => ({
        rgb: [c.r, c.g, c.b],
        hex: colorToHex(c.r, c.g, c.b)
    }));

    // Save quantized image
    const qCanvas = createCanvas(widthPx, heightPx);
    const qCtx = qCanvas.getContext('2d');
    const qid = qCtx.createImageData(widthPx, heightPx);
    qid.data.set(quantizedImage.data);
    qCtx.putImageData(qid, 0, 0);

    const quantizedPath = path.join(outputDir, `${baseName}_2_quantized.png`);
    fs.writeFileSync(quantizedPath, qCanvas.toBuffer('image/png'));
    report.outputFiles.quantized = quantizedPath;

    logVerbose(`Palette: ${palette.map(c => colorToHex(c.r, c.g, c.b)).join(', ')}`, config);
    log(`  ✓ Complete (${report.stages.quantize.duration}ms) - ${palette.length} colors`, config);

    // ===== STAGE 3: Vectorization =====
    log(`▸ Stage 3: Vectorization`, config);
    const startVectorize = Date.now();

    const layers = [];
    let totalRects = 0;

    for (let i = 0; i < palette.length; i++) {
        const color = palette[i];
        const { paths, rectCount } = createMergedRectPaths(quantizedImage, color, config.pxPerMm);
        totalRects += rectCount;

        layers.push({
            id: `layer-${i}`,
            name: `Layer ${i + 1}`,
            color,
            visible: true,
            frequency: Math.round(SETTINGS.freqMin + ((SETTINGS.freqMax - SETTINGS.freqMin) * i) / Math.max(1, palette.length - 1)),
            lpi: Math.round(SETTINGS.lpiMax - ((SETTINGS.lpiMax - SETTINGS.lpiMin) * i) / Math.max(1, palette.length - 1)),
            paths
        });

        logVerbose(`Layer ${i + 1} (${colorToHex(color.r, color.g, color.b)}): ${rectCount} rects`, config);
    }

    report.stages.vectorize = {
        duration: Date.now() - startVectorize,
        totalRectangles: totalRects
    };
    report.layers = layers.map(l => ({
        name: l.name,
        color: colorToHex(l.color.r, l.color.g, l.color.b),
        frequency: l.frequency,
        lpi: l.lpi,
        pathCount: l.paths.length
    }));

    // Save SVG preview
    let svg = `<svg viewBox="0 0 ${widthMm} ${heightMm}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;">`;
    layers.forEach(layer => {
        const colorStr = `rgb(${layer.color.r}, ${layer.color.g}, ${layer.color.b})`;
        layer.paths.forEach(p => {
            svg += `<path d="${p}" fill="${colorStr}" stroke="none"/>`;
        });
    });
    svg += '</svg>';

    const svgPath = path.join(outputDir, `${baseName}_3_vectors.svg`);
    fs.writeFileSync(svgPath, svg);
    report.outputFiles.vectors = svgPath;

    log(`  ✓ Complete (${report.stages.vectorize.duration}ms) - ${totalRects} total rectangles`, config);

    // ===== STAGE 4: XCS Generation =====
    log(`▸ Stage 4: XCS Generation`, config);
    const startXCS = Date.now();

    const xcs = generateXCS(layers, { width: widthMm, height: heightMm }, SETTINGS);
    const xcsJson = JSON.stringify(xcs);

    report.stages.xcsGenerate = {
        duration: Date.now() - startXCS,
        fileSize: xcsJson.length,
        fileSizeMB: (xcsJson.length / 1024 / 1024).toFixed(2)
    };

    const xcsPath = path.join(outputDir, `${baseName}_4_output.xcs`);
    fs.writeFileSync(xcsPath, xcsJson);
    report.outputFiles.xcs = xcsPath;

    log(`  ✓ Complete (${report.stages.xcsGenerate.duration}ms) - ${report.stages.xcsGenerate.fileSizeMB} MB`, config);

    // ===== VALIDATION =====
    log(`\n▸ Validation`, config);
    const validation = validateXCS(xcs, layers);
    report.validation = validation;

    if (validation.errors.length > 0) {
        log(`  ✗ ERRORS:`, config);
        validation.errors.forEach(e => log(`    - ${e}`, config));
    }
    if (validation.warnings.length > 0) {
        log(`  ⚠ Warnings:`, config);
        validation.warnings.forEach(w => log(`    - ${w}`, config));
    }
    if (validation.valid) {
        log(`  ✓ All checks passed`, config);
    }

    // ===== SUMMARY =====
    const totalTime = (report.stages.resize?.duration || 0) +
        (report.stages.quantize?.duration || 0) +
        (report.stages.vectorize?.duration || 0) +
        (report.stages.xcsGenerate?.duration || 0);

    report.summary = {
        totalDuration: totalTime,
        valid: validation.valid
    };

    log(`\n╔══════════════════════════════════════════════════════════╗`, config);
    log(`║  SUMMARY                                                 ║`, config);
    log(`╠══════════════════════════════════════════════════════════╣`, config);
    log(`║  Total Time: ${String(totalTime).padStart(6)}ms                                  ║`, config);
    log(`║  Colors: ${String(palette.length).padStart(2)} | Rectangles: ${String(totalRects).padStart(6)} | Size: ${String(report.stages.xcsGenerate.fileSizeMB).padStart(5)}MB   ║`, config);
    log(`║  Status: ${validation.valid ? '✓ VALID' : '✗ ERRORS'}                                          ║`, config);
    log(`╚══════════════════════════════════════════════════════════╝\n`, config);

    // Save report
    const reportPath = path.join(outputDir, `${baseName}_report.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    report.outputFiles.report = reportPath;

    log(`Output files:`, config);
    log(`  📄 ${resizedPath}`, config);
    log(`  🎨 ${quantizedPath}`, config);
    log(`  📐 ${svgPath}`, config);
    log(`  📦 ${xcsPath}`, config);
    log(`  📋 ${reportPath}`, config);

    if (config.json) {
        console.log(JSON.stringify(report, null, 2));
    }

    return report;
}

// ========== Entry Point ==========
const config = parseArgs();

runPipeline(config).catch(err => {
    console.error('Pipeline error:', err);
    process.exit(1);
});
