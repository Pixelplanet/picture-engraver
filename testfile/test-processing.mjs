/**
 * High Quality Picture Engraver Test - FIXED
 * - Uses correct aspect ratio (no white bars)
 * - Excludes white from palette
 * Run with: node test-processing.mjs
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';

// ===== Color Quantizer =====
class ColorQuantizer {
    quantize(imageData, numColors, excludeWhite = true) {
        const pixels = this.extractPixels(imageData, excludeWhite);
        const palette = this.medianCut(pixels, numColors);

        // Remove any near-white colors from palette
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
            // Skip near-white pixels if excluding white
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

            // Skip near-white pixels (leave them as-is, they won't be engraved)
            if (pixel.r > 245 && pixel.g > 245 && pixel.b > 245) {
                newData[i] = 255;
                newData[i + 1] = 255;
                newData[i + 2] = 255;
                continue;
            }

            const closest = this.findClosestColor(pixel, palette);
            newData[i] = closest.r;
            newData[i + 1] = closest.g;
            newData[i + 2] = closest.b;
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

// ===== Merged Rectangle Vectorizer =====
function createMergedRectPaths(quantizedData, color, pxPerMm) {
    const { data, width, height } = quantizedData;
    const scale = 1 / pxPerMm;
    const tolerance = 3;

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

    // Find and merge rectangles
    const rects = [];
    const visited = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (grid[idx] === 1 && !visited[idx]) {
                // Find maximum width
                let maxW = 0;
                for (let tx = x; tx < width && grid[y * width + tx] === 1 && !visited[y * width + tx]; tx++) {
                    maxW++;
                }

                // Extend downward
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

                // Mark as visited
                for (let ty = y; ty < y + rectH; ty++) {
                    for (let tx = x; tx < x + maxW; tx++) {
                        visited[ty * width + tx] = 1;
                    }
                }

                rects.push({ x, y, w: maxW, h: rectH });
            }
        }
    }

    // Convert to paths
    const paths = rects.map(r => {
        const x1 = (r.x * scale).toFixed(3);
        const y1 = (r.y * scale).toFixed(3);
        const x2 = ((r.x + r.w) * scale).toFixed(3);
        const y2 = ((r.y + r.h) * scale).toFixed(3);
        return `M${x1} ${y1} L${x2} ${y1} L${x2} ${y2} L${x1} ${y2} Z`;
    });

    return paths;
}

// ===== XCS Generator =====
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function colorToInt(r, g, b) { return (r << 16) + (g << 8) + b; }
function colorToHex(r, g, b) { return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''); }

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

            const displayId = generateUUID();
            const display = createPathDisplay(
                displayId, layer.name, colorHex, colorInt,
                0, 0, size.width, size.height,
                layerIndex + 1, combinedPath
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

// ===== Main =====
async function main() {
    console.log('=== FIXED High Quality Picture Engraver ===\n');

    const img = await loadImage('test_image_cats.jpg');
    console.log(`Original: ${img.width} x ${img.height} pixels (aspect: ${(img.width / img.height).toFixed(2)})`);

    // Use actual image aspect ratio
    const maxDimMm = 100;  // Max dimension in mm
    const pxPerMm = 10;    // 10 pixels per mm
    const numColors = 6;   // 6 color levels (excluding white)

    // Calculate output dimensions maintaining aspect ratio
    let widthMm, heightMm;
    if (img.width > img.height) {
        widthMm = maxDimMm;
        heightMm = Math.round(maxDimMm * img.height / img.width);
    } else {
        heightMm = maxDimMm;
        widthMm = Math.round(maxDimMm * img.width / img.height);
    }

    const widthPx = widthMm * pxPerMm;
    const heightPx = heightMm * pxPerMm;

    console.log(`Output: ${widthMm}mm x ${heightMm}mm @ ${pxPerMm}px/mm = ${widthPx}x${heightPx}px`);
    console.log(`Colors: ${numColors} (excluding white)\n`);

    // Create canvas with exact dimensions (no padding!)
    const canvas = createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext('2d');

    // Draw image to fill entire canvas (no white borders)
    ctx.drawImage(img, 0, 0, widthPx, heightPx);

    const imageData = ctx.getImageData(0, 0, widthPx, heightPx);

    // Quantize (excluding white from palette)
    console.log('Quantizing (excluding white)...');
    const quantizer = new ColorQuantizer();
    const { quantizedImage, palette } = quantizer.quantize(imageData, numColors, true);
    console.log('Palette:');
    palette.forEach((c, i) => console.log(`  ${i + 1}: ${colorToHex(c.r, c.g, c.b)} RGB(${c.r}, ${c.g}, ${c.b})`));

    // Create paths for each color
    console.log('\nVectorizing...');
    const settings = { power: 70, speed: 425, passes: 1, crossHatch: true, freqMin: 40, freqMax: 80, lpiMin: 300, lpiMax: 800 };

    const layers = [];
    for (let i = 0; i < palette.length; i++) {
        const color = palette[i];
        console.log(`  Layer ${i + 1}: ${colorToHex(color.r, color.g, color.b)}...`);
        const paths = createMergedRectPaths(quantizedImage, color, pxPerMm);
        console.log(`    ${paths.length} rectangles`);

        layers.push({
            id: `layer-${i}`, name: `Layer ${i + 1}`, color, visible: true,
            frequency: Math.round(settings.freqMin + ((settings.freqMax - settings.freqMin) * i) / Math.max(1, palette.length - 1)),
            lpi: Math.round(settings.lpiMax - ((settings.lpiMax - settings.lpiMin) * i) / Math.max(1, palette.length - 1)),
            paths
        });
    }

    // Generate XCS
    console.log('\nGenerating XCS...');
    const xcs = generateXCS(layers, { width: widthMm, height: heightMm }, settings);
    const xcsJson = JSON.stringify(xcs);

    const outputPath = 'test_output_cats_FIXED.xcs';
    fs.writeFileSync(outputPath, xcsJson);
    console.log(`Saved: ${outputPath} (${(xcsJson.length / 1024 / 1024).toFixed(2)} MB)`);

    // Save quantized PNG
    const qCanvas = createCanvas(widthPx, heightPx);
    const qCtx = qCanvas.getContext('2d');
    const qid = qCtx.createImageData(widthPx, heightPx);
    qid.data.set(quantizedImage.data);
    qCtx.putImageData(qid, 0, 0);
    fs.writeFileSync('test_output_cats_FIXED.png', qCanvas.toBuffer('image/png'));
    console.log('Saved: test_output_cats_FIXED.png');

    console.log('\n✓ Done! Open test_output_cats_FIXED.xcs in xTool Studio');
}

main().catch(console.error);
