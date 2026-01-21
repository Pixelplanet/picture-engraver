/**
 * Optimized Business Card Test Grid Generator
 * - More test points with smaller cells
 * - QR code in bottom-right (replaces low-value cells)
 */

import QRCode from 'qrcode';
import fs from 'fs';

// ===== Configuration =====
const BUSINESS_CARD = {
    width: 85,
    height: 55
};

const GRID_LAYOUT = {
    cellSize: 5,      // mm - smaller for more cells
    cellGap: 1,       // mm - tighter spacing
    marginLeft: 1,
    marginTop: 1,
    marginRight: 1,
    marginBottom: 1
};

const DEFAULT_SETTINGS = {
    // LPI: HIGH to LOW (left to right) - so low LPI is on right for QR
    lpiMin: 300,
    lpiMax: 800,

    // Frequency: LOW to HIGH (top to bottom) - so high freq is at bottom for QR
    freqMin: 40,
    freqMax: 90,

    // Engraving settings
    power: 70,
    speed: 425,
    passes: 1
};

const QR_SETTINGS = {
    power: 90,
    speed: 50,
    frequency: 40,
    lpi: 600,
    // QR will replace a 2x2 block of cells
    cellsWide: 2,
    cellsHigh: 2
};

// ===== Helpers =====
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function colorToInt(r, g, b) { return (r << 16) + (g << 8) + b; }
function colorToHex(r, g, b) { return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''); }

function linspace(min, max, steps) {
    const result = [];
    for (let i = 0; i < steps; i++) {
        result.push(Math.round(min + (max - min) * i / (steps - 1)));
    }
    return result;
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// ===== QR Code =====
async function generateQRCodePath(data, size, offsetX, offsetY) {
    const qr = await QRCode.create(data, { errorCorrectionLevel: 'M' });
    const modules = qr.modules;
    const moduleCount = modules.size;
    const moduleSize = size / moduleCount;

    let path = '';
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            if (modules.get(row, col)) {
                const x = offsetX + col * moduleSize;
                const y = offsetY + row * moduleSize;
                path += `M${x.toFixed(3)} ${y.toFixed(3)} L${(x + moduleSize).toFixed(3)} ${y.toFixed(3)} L${(x + moduleSize).toFixed(3)} ${(y + moduleSize).toFixed(3)} L${x.toFixed(3)} ${(y + moduleSize).toFixed(3)} Z `;
            }
        }
    }
    return path.trim();
}

// ===== XCS Display Creation =====
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

function createDisplaySettings(frequency, lpi, power, speed, passes) {
    return {
        isFill: true, type: 'PATH', processingType: 'FILL_VECTOR_ENGRAVING',
        data: {
            VECTOR_CUTTING: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { power, speed, repeat: passes, frequency: 40 } } },
            VECTOR_ENGRAVING: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { speed, power, repeat: passes, frequency: 40 } } },
            FILL_VECTOR_ENGRAVING: {
                materialType: 'customize', planType: 'dot_cloud',
                parameter: { customize: { bitmapEngraveMode: 'normal', speed, density: lpi, dpi: lpi, power, repeat: passes, bitmapScanMode: 'crossMode', frequency, crossAngle: true, scanAngle: 0, angleType: 2 } }
            },
            INTAGLIO: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { speed: 80, density: 300, power: 1, repeat: 1, frequency: 40 } } },
            INNER_THREE_D: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { subdivide: 0.1, speed: 80, power: 1, repeat: 1, frequency: 40 } } }
        },
        processIgnore: false
    };
}

// ===== Main Grid Generator =====
async function generateOptimizedGrid(settings = DEFAULT_SETTINGS) {
    const canvasId = generateUUID();
    const now = Date.now();

    const { cellSize, cellGap, marginLeft, marginTop, marginRight, marginBottom } = GRID_LAYOUT;
    const totalCellSize = cellSize + cellGap;

    // Calculate how many cells fit
    const availableWidth = BUSINESS_CARD.width - marginLeft - marginRight;
    const availableHeight = BUSINESS_CARD.height - marginTop - marginBottom;

    const numCols = Math.floor((availableWidth + cellGap) / totalCellSize);
    const numRows = Math.floor((availableHeight + cellGap) / totalCellSize);

    console.log(`Grid dimensions: ${numCols} cols x ${numRows} rows = ${numCols * numRows} cells`);

    // Generate LPI values (HIGH to LOW, left to right) - reversed!
    const lpiValues = linspace(settings.lpiMax, settings.lpiMin, numCols);
    // Generate Freq values (LOW to HIGH, top to bottom)
    const freqValues = linspace(settings.freqMin, settings.freqMax, numRows);

    console.log('LPI (left→right):', lpiValues);
    console.log('Freq (top→bottom):', freqValues);

    // QR code position: bottom-right corner, spanning 2x2 cells
    const qrCellsWide = QR_SETTINGS.cellsWide;
    const qrCellsHigh = QR_SETTINGS.cellsHigh;
    const qrStartCol = numCols - qrCellsWide;
    const qrStartRow = numRows - qrCellsHigh;

    // QR code bounds
    const qrX = marginLeft + qrStartCol * totalCellSize;
    const qrY = marginTop + qrStartRow * totalCellSize;
    const qrSize = qrCellsWide * totalCellSize - cellGap;

    console.log(`QR code: ${qrSize.toFixed(1)}mm at (${qrX.toFixed(1)}, ${qrY.toFixed(1)})`);

    // Create QR data
    const qrData = JSON.stringify({
        v: 1,
        lpi: [settings.lpiMin, settings.lpiMax, numCols],
        freq: [settings.freqMin, settings.freqMax, numRows],
        pwr: settings.power,
        spd: settings.speed,
        ts: now
    });

    const displays = [];
    const displaySettings = [];
    const layerData = {};
    let zOrder = 1;
    let cellCount = 0;

    // Generate grid cells (skip QR area)
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            // Skip cells in QR code area
            if (col >= qrStartCol && row >= qrStartRow) {
                continue;
            }

            const displayId = generateUUID();

            const x = marginLeft + col * totalCellSize;
            const y = marginTop + row * totalCellSize;

            const lpi = lpiValues[col];
            const frequency = freqValues[row];

            // Color based on position
            const hue = (col / numCols) * 0.7;
            const lightness = 0.3 + (row / numRows) * 0.4;
            const rgb = hslToRgb(hue, 0.8, lightness);
            const colorHex = colorToHex(rgb.r, rgb.g, rgb.b);
            const colorInt = colorToInt(rgb.r, rgb.g, rgb.b);

            const path = `M${x} ${y} L${x + cellSize} ${y} L${x + cellSize} ${y + cellSize} L${x} ${y + cellSize} Z`;

            const display = createPathDisplay(
                displayId,
                `F${frequency}kHz/L${lpi}`,
                colorHex, colorInt,
                x, y, cellSize, cellSize,
                zOrder, path
            );

            displays.push(display);
            displaySettings.push([displayId, createDisplaySettings(frequency, lpi, settings.power, settings.speed, settings.passes)]);
            layerData[colorHex] = { name: `${frequency}kHz/${lpi}LPI`, order: zOrder, visible: true };

            zOrder++;
            cellCount++;
        }
    }

    console.log(`Created ${cellCount} test cells`);

    // Add QR code
    console.log('Generating QR code...');
    const qrPath = await generateQRCodePath(qrData, qrSize, qrX, qrY);

    const qrDisplayId = generateUUID();
    const qrDisplay = createPathDisplay(
        qrDisplayId,
        'Settings QR',
        '#000000', 0,
        qrX, qrY, qrSize, qrSize,
        zOrder, qrPath
    );

    displays.push(qrDisplay);
    displaySettings.push([qrDisplayId, createDisplaySettings(QR_SETTINGS.frequency, QR_SETTINGS.lpi, QR_SETTINGS.power, QR_SETTINGS.speed, 1)]);
    layerData['#000000'] = { name: 'QR Code', order: zOrder, visible: true };

    // Build XCS
    const xcs = {
        canvasId,
        canvas: [{
            id: canvasId,
            title: `Test Grid ${numCols}x${numRows}`,
            layerData,
            groupData: {},
            displays
        }],
        extId: 'GS009-CLASS-4',
        extName: 'F2 Ultra UV',
        version: '1.3.6',
        created: now,
        modify: now,
        device: {
            id: 'GS009-CLASS-4',
            power: [5],
            data: {
                dataType: 'Map',
                value: [[canvasId, {
                    mode: 'LASER_PLANE',
                    data: { LASER_PLANE: { material: 0, lightSourceMode: 'uv', thickness: 117, isProcessByLayer: false, pathPlanning: 'auto', fillPlanning: 'separate' } },
                    displays: { dataType: 'Map', value: displaySettings }
                }]]
            },
            materialList: [],
            materialTypeList: [],
            customProjectData: { tangentialCuttingUuids: [], flyCutUuid2CanvasIds: {} }
        }
    };

    return {
        xcs,
        gridInfo: {
            numCols,
            numRows,
            totalCells: cellCount,
            lpiValues,
            freqValues,
            qrData,
            cellSize,
            cellGap
        }
    };
}

// ===== Main =====
async function main() {
    console.log('=== Optimized Business Card Test Grid ===\n');
    console.log(`Card: ${BUSINESS_CARD.width}mm x ${BUSINESS_CARD.height}mm`);
    console.log(`Cell: ${GRID_LAYOUT.cellSize}mm, Gap: ${GRID_LAYOUT.cellGap}mm\n`);

    const { xcs, gridInfo } = await generateOptimizedGrid();

    const xcsJson = JSON.stringify(xcs);
    const outputPath = 'test_grid_optimized.xcs';
    fs.writeFileSync(outputPath, xcsJson);

    console.log(`\n✓ Saved: ${outputPath} (${(xcsJson.length / 1024).toFixed(1)} KB)`);
    console.log(`  Grid: ${gridInfo.numCols} x ${gridInfo.numRows}`);
    console.log(`  Test cells: ${gridInfo.totalCells}`);
    console.log(`  QR replaces: ${QR_SETTINGS.cellsWide * QR_SETTINGS.cellsHigh} cells`);

    // Save grid info
    fs.writeFileSync('test_grid_optimized_info.json', JSON.stringify(gridInfo, null, 2));
    console.log('✓ Saved: test_grid_optimized_info.json');

    console.log('\n📋 QR Code contains:');
    console.log(gridInfo.qrData);

    console.log('\n→ Open test_grid_optimized.xcs in xTool Studio');
}

main().catch(console.error);
