/**
 * Test Grid Generator Module
 * Generates calibration grids with QR codes for laser engraving settings
 */

import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { getXtoolMaterialId, DEFAULT_MATERIAL_ID } from './material-registry.js';
import { getLaserConfig, getDeviceConfig, resolveDeviceId } from './device-registry.js';

export class TestGridGenerator {
    constructor(settings = {}) {
        // Resolve device + laser config from registry
        const deviceId = resolveDeviceId(settings.activeDevice || 'f2_ultra_uv');
        const laserTypeId = settings.activeLaserType || null;
        const laser = getLaserConfig(deviceId, laserTypeId);

        // A laser is "MOPA-like" if it has pulseWidth and mopaFrequency capabilities
        const isMopaLike = laser ? (laser.hasPulseWidth && laser.hasMopaFrequency) : false;

        this.settings = {
            // Business card dimensions
            cardWidth: 85,
            cardHeight: 55,

            // Grid parameters
            lpiMin: 500,
            lpiMax: 2000,
            lpi: isMopaLike ? 5000 : undefined, // Fixed LPC for MOPA-like default

            freqMin: isMopaLike ? 200 : 40,
            freqMax: isMopaLike ? 1200 : 90,

            // Engraving settings
            power: isMopaLike ? 14 : 70,
            powerMin: undefined,
            powerMax: undefined,

            speed: 425,
            speedMin: isMopaLike ? 200 : undefined,
            speedMax: isMopaLike ? 1200 : undefined,

            passes: 1,
            crossHatch: !isMopaLike, // False for MOPA-like

            // MOPA grid mode: 'power' = fixed power, vary speed & frequency
            gridMode: isMopaLike ? 'power' : undefined,

            // QR code settings
            qrPower: 17.5,
            qrSpeed: 150,
            qrSize: 12,
            qrFrequency: 90,
            qrLpi: 2500,

            // Layout
            cellSize: 5,
            cellGap: 1,
            margin: 1, // All sides

            ...settings
        };
    }

    // Generate evenly spaced values
    linspace(min, max, steps) {
        const result = [];
        if (steps <= 1) return [min];
        for (let i = 0; i < steps; i++) {
            result.push(Math.round(min + (max - min) * i / (steps - 1)));
        }
        return result;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    colorToInt(r, g, b) { return (r << 16) + (g << 8) + b; }
    colorToHex(r, g, b) { return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''); }

    hslToRgb(h, s, l) {
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

    createPathDisplay(id, name, colorHex, colorInt, x, y, width, height, zOrder, dPath, isCompoundPath = false) {
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
            isCompoundPath, isFill: true,
            lineColor: colorInt, fillColor: colorHex
        };
    }

    createDisplaySettings(frequency, lpi, power, speed, passes, extraParams = {}) {
        // Determine laser capabilities from extraParams or active laser config
        const hasMopaFreq = !!extraParams.mopaFrequency;
        const processingLightSource = extraParams.processingLightSource || 'red';
        const planType = extraParams._planType || (hasMopaFreq ? 'red' : 'dot_cloud');

        // Strip internal-only keys before spreading into XCS data
        const { _planType, ...xcsParams } = extraParams;

        const customize = {
            bitmapEngraveMode: 'normal',
            speed,
            density: lpi,
            dpi: lpi,
            power,
            repeat: passes,
            bitmapScanMode: this.settings.crossHatch ? 'crossMode' : 'zMode',
            frequency,
            crossAngle: this.settings.crossHatch,
            scanAngle: 0,
            angleType: 2,
            processingLightSource,
            ...xcsParams
        };

        const processingType = hasMopaFreq ? 'COLOR_FILL_ENGRAVE' : 'FILL_VECTOR_ENGRAVING';

        const data = {
            VECTOR_CUTTING: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { ...customize } } },
            VECTOR_ENGRAVING: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { ...customize } } },
            FILL_VECTOR_ENGRAVING: {
                materialType: 'customize', planType: 'dot_cloud',
                parameter: { customize }
            },
            INTAGLIO: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { ...customize, speed: 80, density: 300, power: 1, repeat: 1, frequency: 40 } } },
            INNER_THREE_D: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { ...customize, subdivide: 0.1, speed: 80, power: 1, repeat: 1, frequency: 40 } } }
        };

        // Add COLOR_FILL_ENGRAVE section for non-UV lasers
        if (hasMopaFreq) {
            data.COLOR_FILL_ENGRAVE = {
                materialType: 'customize', planType,
                parameter: {
                    customize: {
                        ...customize,
                        dotDuration: 100,
                        notResize: true
                    }
                }
            };
        }

        return {
            isFill: true, type: 'PATH', processingType,
            data,
            processIgnore: false
        };
    }

    // Encode settings for QR code
    encodeSettings(numCols, numRows) {
        const s = this.settings;
        const deviceId = resolveDeviceId(this.settings.activeDevice || 'f2_ultra_uv');
        const laserTypeId = this.settings.activeLaserType || null;
        const laser = getLaserConfig(deviceId, laserTypeId);
        const isMopaLike = laser ? (laser.hasPulseWidth && laser.hasMopaFrequency) : false;
        const type = isMopaLike ? 'mopa' : 'uv';
        const material = s.material || 'stainless_304';

        if (isMopaLike) {
            // MOPA Flexible Encoding (v4 — adds material)
            const mode = s.gridMode || 'frequency';

            // Helper to get Range or Fixed
            const getRange = (minKey, maxKey, fixKey, def) => {
                if (s[minKey] !== undefined && s[maxKey] !== undefined) return [s[minKey], s[maxKey]];
                if (s[fixKey] !== undefined) return [s[fixKey], s[fixKey]];
                return [def, def];
            };

            const fRange = getRange('freqMin', 'freqMax', 'freq', 200);
            const pRange = getRange('powerMax', 'powerMin', 'power', 14);
            const sRange = getRange('speedMin', 'speedMax', 'speed', 200);

            return JSON.stringify({
                v: 4,
                ax: mode === 'power' ? 'p' : (mode === 'speed' ? 's' : 'f'),
                f: fRange,
                p: pRange,
                s: sRange,
                r: numRows,
                c: numCols,
                l: s.lpi || 5000, // Density
                pw: s.pulseWidth || 80,
                m: material,
                t: 'mopa'
            });
        } else {
            // UV Encoding (v2 — adds material)
            return JSON.stringify({
                v: 2,
                l: [s.lpiMax, s.lpiMin, numCols],
                f: [s.freqMin, s.freqMax, numRows],
                p: s.power,
                s: s.speed,
                m: material,
                t: type
            });
        }
    }

    // Analayze Image for QR Code
    async analyzeImage(imageData) {
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
            try {
                const raw = JSON.parse(code.data);

                // MOPA v3/v4 Flexible
                if ((raw.v >= 3 || raw.ax) && raw.t === 'mopa') {
                    const mode = raw.ax || 'f'; // f, p, s
                    const rows = raw.r || 9;
                    const cols = raw.c || 14;
                    const material = raw.m || 'stainless_304'; // v4+ includes material

                    let xValues, yValues, xLabel, yLabel;

                    if (mode === 'p') { // Fixed Power, Speed(X) vs Freq(Y)
                        xValues = this.linspace(raw.s[0], raw.s[1], cols);
                        yValues = this.linspace(raw.f[0], raw.f[1], rows);
                        xLabel = 'Speed (mm/s)'; yLabel = 'Frequency (kHz)';
                    } else if (mode === 's') { // Fixed Speed, Power(X) vs Freq(Y)
                        xValues = this.linspace(raw.p[0], raw.p[1], cols);
                        yValues = this.linspace(raw.f[0], raw.f[1], rows);
                        xLabel = 'Power (%)'; yLabel = 'Frequency (kHz)';
                    } else { // Fixed Freq, Speed(X) vs Power(Y)
                        xValues = this.linspace(raw.s[0], raw.s[1], cols);
                        yValues = this.linspace(raw.p[0], raw.p[1], rows);
                        xLabel = 'Speed (mm/s)'; yLabel = 'Power (%)';
                    }

                    return {
                        found: true,
                        data: raw,
                        version: raw.v,
                        material,
                        lpiValues: xValues,  // Mapped to X
                        freqValues: yValues, // Mapped to Y
                        xAxisLabel: xLabel,
                        yAxisLabel: yLabel,
                        gridMode: mode
                    };
                }

                // Legacy (UV / Old MOPA)
                const settings = {
                    v: raw.v,
                    lpi: raw.l || raw.lpi,
                    freq: raw.f || raw.freq,
                    pwr: raw.p || raw.pwr,
                    spd: raw.s || raw.spd,
                    type: raw.t || 'uv',
                    ts: raw.ts || Date.now()
                };

                const lpiValues = this.linspace(settings.lpi[0], settings.lpi[1], settings.lpi[2]);
                const freqValues = this.linspace(settings.freq[0], settings.freq[1], settings.freq[2]);

                return {
                    found: true,
                    data: settings,
                    lpiValues,
                    freqValues
                };
            } catch (e) {
                console.error('Failed to parse QR data:', e);
                return { found: true, error: 'Invalid QR data format' };
            }
        }

        return { found: false };
    }

    // Generate QR Code Path
    generateQRPath(text, x, y, size) {
        try {
            // Robustly find the create function (handles different bundling targets)
            let qrc = QRCode;
            if (qrc && qrc.default) qrc = qrc.default;

            if (typeof qrc.create !== 'function') {
                throw new Error('QRCode.create is not a function');
            }

            const qr = qrc.create(text, {
                errorCorrectionLevel: 'M'
            });
            const modules = qr.modules;
            const count = modules.size;
            const cellSize = size / count;
            let path = '';

            for (let r = 0; r < count; r++) {
                for (let c = 0; c < count; c++) {
                    if (modules.get(r, c)) { // row, col
                        const cx = x + c * cellSize;
                        const cy = y + r * cellSize;
                        // Use relative coordinates for smaller output
                        path += `M${cx.toFixed(3)} ${cy.toFixed(3)}h${cellSize.toFixed(3)}v${cellSize.toFixed(3)}h-${cellSize.toFixed(3)}z `;
                    }
                }
            }
            return path;
        } catch (e) {
            console.error('QR Gen Error:', e);
            // Fallback: A recognizable frame with an X instead of a solid box
            const s = size;
            return `M${x} ${y}h${s}v${s}h-${s}z M${x + 2} ${y + 2}L${x + s - 2} ${y + s - 2} M${x + s - 2} ${y + 2}L${x + 2} ${y + s - 2}`;
        }
    }

    // Generate the business card test grid XCS
    generateBusinessCardGrid() {
        const s = this.settings;
        const canvasId = this.generateUUID();
        const now = Date.now();

        // FIXED QR CODE LOGIC (17mm x 17mm with 1mm gap)
        const QR_SIZE_MM = 17;
        const QR_GAP_MM = 1;

        // Calculate how many cells fit
        const availableWidth = s.cardWidth - (s.margin * 2);
        const availableHeight = s.cardHeight - (s.margin * 2);

        // Initial Calculation (Standard)
        const totalCellSize = s.cellSize + s.cellGap;
        let numCols = Math.floor((availableWidth + s.cellGap) / totalCellSize);
        let numRows = Math.floor((availableHeight + s.cellGap) / totalCellSize);

        // Gap Logic (Standard vs Fill)
        let gapX = s.cellGap;
        let gapY = s.cellGap;

        if (s.fillGaps) {
            // Force Fit Logic:
            // Check if there is enough space for "almost" another column (80% threshold)
            // Space used by N cols with standard gap = N * cell + (N-1) * gap
            // Max space = availableWidth
            // Actually, simplified:
            // Current used width = numCols * totalCellSize - gap
            // Remaining = availableWidth - usedWidth
            // If Remaining > 0.8 * totalCellSize, try to squeeze one more in.

            const usedW = numCols * totalCellSize - s.cellGap;
            const remW = availableWidth - usedW;

            if (remW > (0.8 * totalCellSize)) {
                numCols++;
            }

            // Recalculate gapX to fit numCols exactly into availableWidth
            // available = numCols * cell + (numCols - 1) * gapX
            // gapX = (available - numCols * cell) / (numCols - 1)
            if (numCols > 1) {
                gapX = (availableWidth - (numCols * s.cellSize)) / (numCols - 1);
                // Safety: Don't let gap become negative or absurdly small (e.g. overlap)
                if (gapX < 0) gapX = 0;
            }

            // Same for Rows
            const usedH = numRows * totalCellSize - s.cellGap;
            const remH = availableHeight - usedH;

            if (remH > (0.8 * totalCellSize)) {
                numRows++;
            }

            if (numRows > 1) {
                gapY = (availableHeight - (numRows * s.cellSize)) / (numRows - 1);
                if (gapY < 0) gapY = 0;
            }
        }

        // Safety check
        if (numCols < 1) numCols = 1;
        if (numRows < 1) numRows = 1;

        // Final layout parameters (effective)
        // With justified/forced gaps, the grid spans exactly availableWidth (approximately)
        const effectiveGridW = numCols * s.cellSize + (numCols - 1) * gapX;
        const effectiveGridH = numRows * s.cellSize + (numRows - 1) * gapY;

        const workspaceSize = 200;
        // Offsets to center the effective grid within the workspace
        // (Note: s.cardWidth includes margins, so we center the card, then add margin + (available - effective)/2)
        // Actually, we can just center the effective grid in the workspace directly?
        // Standard card offset:
        const cardOffsetX = (workspaceSize - s.cardWidth) / 2;
        const cardOffsetY = (workspaceSize - s.cardHeight) / 2;

        // Grid content offset within card (centering the leftovers if not justified)
        const contentOffsetX = s.margin + (availableWidth - effectiveGridW) / 2;
        const contentOffsetY = s.margin + (availableHeight - effectiveGridH) / 2;

        const globalOffsetX = cardOffsetX + contentOffsetX;
        const globalOffsetY = cardOffsetY + contentOffsetY;

        // QR Code Quantized Exclusion Logic
        // We need to clear at least QR_SIZE_MM + gap
        const qrSpaceW = QR_SIZE_MM + QR_GAP_MM;
        const qrSpaceH = QR_SIZE_MM + QR_GAP_MM;

        // Calculate how many columns/rows from the END we need to drop
        // Each col width = cell + gapX
        const colPitch = s.cellSize + gapX;
        const rowPitch = s.cellSize + gapY;

        // We assume we cut from the bottom-right corner of the GRID.
        // We need to free up `qrSpace` amount of physical space.
        // The space freed by removing K columns is roughly K * pitch - gap? 
        // Let's simpler: Find index I such that cell I overlaps the exclusion box.

        // Exclusion box is anchored bottom-right of the EFFECTIVE GRID.
        // relQrX = effectiveGridW - QR_SIZE_MM

        // But the user wants "Dynamic" - "take as many rows... as needed".
        // This implies grid-aligned chopping.
        // We just count back from the edge until we have enough space.
        // Space provided by removing 1 col = cell width. (The gap remains? No gap is removed too).
        // Actually, removing last col removes 1 cell width. The gap before it becomes margin.

        // Let's implement: count how many cols fit in `qrSpaceW`.
        // If qrSpaceW = 18mm. pitch = 6mm.
        // 18 / 6 = 3 cols.
        // So we reserve 3 cols.
        const colsReserved = Math.ceil(qrSpaceW / colPitch);
        const rowsReserved = Math.ceil(qrSpaceH / rowPitch);

        // Start indices for exclusion
        const excStartCol = numCols - colsReserved;
        const excStartRow = numRows - rowsReserved;

        // QR Position:
        // User wants it "display the QR code in the same size".
        // And implied: Position it in the cleared space.
        // Anchor: Bottom-Right of the EFFECTIVE GRID.
        // X = globalOffsetX + effectiveGridW - QR_SIZE_MM
        const qrX = globalOffsetX + effectiveGridW - QR_SIZE_MM;
        const qrY = globalOffsetY + effectiveGridH - QR_SIZE_MM;

        // Generate values
        const lpiValues = this.linspace(s.lpiMax, s.lpiMin, numCols);
        const freqValues = this.linspace(s.freqMin, s.freqMax, numRows);

        const displays = [];
        const displaySettings = [];
        const layerData = {};
        let zOrder = 1;
        let cellCount = 0;

        // Generate grid cells
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {

                // Quantized Grid-Index Exclusion
                if (col >= excStartCol && row >= excStartRow) {
                    continue;
                }

                const displayId = this.generateUUID();

                const x = globalOffsetX + col * colPitch;
                const y = globalOffsetY + row * rowPitch;

                const frequency = Math.round(freqValues[row]);
                const lpi = Math.round(lpiValues[col]);

                // Generate color based on position
                const hue = (col / numCols) * 0.7;
                const lightness = 0.3 + (row / numRows) * 0.4;
                const rgb = this.hslToRgb(hue, 0.8, lightness);

                const colorHex = this.colorToHex(rgb.r, rgb.g, rgb.b);
                const colorInt = this.colorToInt(rgb.r, rgb.g, rgb.b);

                // Create cell path
                const path = `M0 0 L${s.cellSize} 0 L${s.cellSize} ${s.cellSize} L0 ${s.cellSize} Z`;

                const display = this.createPathDisplay(
                    displayId,
                    `F${frequency}kHz / L${lpi}`,
                    colorHex, colorInt,
                    x, y, s.cellSize, s.cellSize,
                    zOrder, path,
                    false
                );

                displays.push(display);
                displaySettings.push([displayId, this.createDisplaySettings(frequency, lpi, s.power, s.speed, s.passes)]);
                layerData[colorHex] = { name: `${frequency}kHz/${lpi}LPC`, order: zOrder, visible: true };

                zOrder++;
                cellCount++;
            }
        }

        // Add Real QR Code
        const qrData = this.encodeSettings(numCols, numRows);
        const qrPath = this.generateQRPath(qrData, 0, 0, QR_SIZE_MM);

        const qrDisplayId = this.generateUUID();
        const qrDisplay = this.createPathDisplay(
            qrDisplayId, 'Settings QR Code',
            '#000000', 0,
            qrX, qrY, QR_SIZE_MM, QR_SIZE_MM,
            zOrder, qrPath,
            true
        );

        displays.push(qrDisplay);
        displaySettings.push([qrDisplayId, this.createDisplaySettings(s.qrFrequency, s.qrLpi, s.qrPower, s.qrSpeed, 1)]);
        layerData['#000000'] = { name: 'QR Code', order: zOrder, visible: true };

        // Build XCS — resolve device + laser config
        const deviceId = resolveDeviceId(this.settings.activeDevice || 'f2_ultra_uv');
        const laserTypeId = this.settings.activeLaserType || null;
        const laser = getLaserConfig(deviceId, laserTypeId);
        const isMopaLike = laser ? (laser.hasPulseWidth && laser.hasMopaFrequency) : false;

        if (isMopaLike) {
            return this.generateMopaGrid(canvasId, now);
        }

        const extId = laser ? laser.extId : 'GS009-CLASS-4';
        const extName = laser ? laser.extName : 'F2 Ultra UV';
        const lightSource = laser ? laser.lightSource : 'uv';

        const xcs = {
            canvasId,
            canvas: [{
                id: canvasId,
                title: `Test Grid ${numCols}x${numRows}`,
                layerData,
                groupData: {},
                displays
            }],
            extId: extId,
            extName: extName,
            version: '1.3.6',
            created: now,
            modify: now,
            device: {
                id: extId,
                power: laser ? laser.powerLevels : [5],
                data: {
                    dataType: 'Map',
                    value: [[canvasId, {
                        mode: 'LASER_PLANE',
                        data: { LASER_PLANE: { material: getXtoolMaterialId(this.settings.material || DEFAULT_MATERIAL_ID), lightSourceMode: lightSource, thickness: 117, isProcessByLayer: false, pathPlanning: 'auto', fillPlanning: 'separate' } },
                        displays: { dataType: 'Map', value: displaySettings }
                    }]]
                },
                materialList: [],
                materialTypeList: [],
                customProjectData: { tangentialCuttingUuids: [], flyCutUuid2CanvasIds: {} }
            }
        };

        return {
            xcs: JSON.stringify(xcs),
            gridInfo: {
                width: s.cardWidth,
                height: s.cardHeight,
                numCols,
                numRows,
                totalCells: cellCount,
                qrData,
                qrSize: QR_SIZE_MM,
                qrX,
                qrY,
                qrGap: QR_GAP_MM,
                // Return effective gaps for preview
                gapX,
                gapY,
                effectiveGridW,
                effectiveGridH,
                globalOffsetX,
                globalOffsetY,
                excStartCol,
                excStartRow,
                lpiValues,
                freqValues
            }
        };
    }


    generateMopaGrid(canvasId, now) {
        const s = this.settings;
        const displays = [];
        const displaySettings = [];
        const layerData = {};

        // Flexible MOPA Grid Logic
        const mode = s.gridMode || 'frequency';

        // Layout Config (Moved Up)
        const availableWidth = s.cardWidth - (s.margin * 2);
        const availableHeight = s.cardHeight - (s.margin * 2);
        const totalCellSize = s.cellSize + s.cellGap;

        let numCols = Math.floor((availableWidth + s.cellGap) / totalCellSize);
        let numRows = Math.floor((availableHeight + s.cellGap) / totalCellSize);
        if (numCols < 1) numCols = 1;
        if (numRows < 1) numRows = 1;

        // Determine Axes & Fixed Values
        let xValues, yValues;
        let fixedFreq = s.freq !== undefined ? s.freq : 200;
        let fixedPower = s.power !== undefined ? s.power : 14;
        let fixedSpeed = s.speed !== undefined ? s.speed : 400;

        // Defaults if ranges are missing
        const defSpeedMin = 200, defSpeedMax = 1200;
        const defPowerMin = 14, defPowerMax = 14;
        const defFreqMin = 200, defFreqMax = 1200;

        if (mode === 'power') {
            // Fixed Power: Vary Speed (X) & Freq (Y)
            fixedPower = s.power || 70;
            xValues = this.linspace(s.speedMin || defSpeedMin, s.speedMax || defSpeedMax, numCols);
            yValues = this.linspace(s.freqMin || defFreqMin, s.freqMax || defFreqMax, numRows);
        } else if (mode === 'speed') {
            // Fixed Speed: Vary Power (X) & Freq (Y)
            fixedSpeed = s.speed || defSpeedMin;
            xValues = this.linspace(s.powerMax || defPowerMax, s.powerMin || defPowerMin, numCols);
            yValues = this.linspace(s.freqMin || defFreqMin, s.freqMax || defFreqMax, numRows);
        } else {
            // Fixed Frequency (Default): Vary Speed (X) & Power (Y)
            fixedFreq = s.freq || 40;
            xValues = this.linspace(s.speedMin || defSpeedMin, s.speedMax || defSpeedMax, numCols);
            yValues = this.linspace(s.powerMax || defPowerMax, s.powerMin || defPowerMin, numRows);
        }

        // Constants
        const pulseWidth = s.pulseWidth || 80;
        const passes = s.passes || 1;
        const mopaLpi = s.lpi || 5000;

        // XCS Structure — from device registry
        const deviceId = resolveDeviceId(this.settings.activeDevice || 'f2_ultra_mopa');
        const laserTypeId = this.settings.activeLaserType || null;
        const laser = getLaserConfig(deviceId, laserTypeId);
        const extId = laser ? laser.extId : 'GS009-CLASS-1';
        const extName = laser ? laser.extName : 'F2 Ultra';
        const lightSource = laser ? laser.lightSource : 'red';

        // FIXED QR CODE LOGIC (17mm x 17mm with 1mm gap)
        const QR_SIZE_MM = 17;
        const QR_GAP_MM = 1;

        // Layout Config (Moved to Top)

        // Effective Layout
        const effectiveGridW = numCols * s.cellSize + (numCols - 1) * s.cellGap;
        const effectiveGridH = numRows * s.cellSize + (numRows - 1) * s.cellGap;

        // Centering
        const workspaceSize = 200;
        const cardOffsetX = (workspaceSize - s.cardWidth) / 2;
        const cardOffsetY = (workspaceSize - s.cardHeight) / 2;
        const contentOffsetX = s.margin + (availableWidth - effectiveGridW) / 2;
        const contentOffsetY = s.margin + (availableHeight - effectiveGridH) / 2;
        const globalOffsetX = cardOffsetX + contentOffsetX;
        const globalOffsetY = cardOffsetY + contentOffsetY;

        // QR Quantized Exclusion Logic
        const qrSpaceW = QR_SIZE_MM + QR_GAP_MM;
        const qrSpaceH = QR_SIZE_MM + QR_GAP_MM;
        const colPitch = s.cellSize + s.cellGap;
        const rowPitch = s.cellSize + s.cellGap;

        const colsReserved = Math.ceil(qrSpaceW / colPitch);
        const rowsReserved = Math.ceil(qrSpaceH / rowPitch);
        const excStartCol = numCols - colsReserved;
        const excStartRow = numRows - rowsReserved;

        const qrX = globalOffsetX + effectiveGridW - QR_SIZE_MM;
        const qrY = globalOffsetY + effectiveGridH - QR_SIZE_MM;





        let zOrder = 1;
        let cellCount = 0;

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {

                // Determine Cell Parameters based on Axis
                let cellFreq = fixedFreq;
                let cellPower = fixedPower;
                let cellSpeed = fixedSpeed;

                if (mode === 'power') {
                    cellSpeed = isNaN(xValues[col]) ? fixedSpeed : xValues[col];
                    cellFreq = isNaN(yValues[row]) ? fixedFreq : yValues[row];
                } else if (mode === 'speed') {
                    cellPower = isNaN(xValues[col]) ? fixedPower : xValues[col];
                    cellFreq = isNaN(yValues[row]) ? fixedFreq : yValues[row];
                } else { // frequency
                    cellSpeed = isNaN(xValues[col]) ? fixedSpeed : xValues[col];
                    cellPower = isNaN(yValues[row]) ? fixedPower : yValues[row];
                }

                // Check exclusion
                if (col >= excStartCol && row >= excStartRow) {
                    continue;
                }

                const x = globalOffsetX + col * colPitch;
                const y = globalOffsetY + row * rowPitch;

                // Visual Color - HSL gradient matching UV grid for visibility in xTool Studio
                const hue = (col / numCols) * 0.7;
                const lightness = 0.3 + (row / numRows) * 0.4;
                const rgb = this.hslToRgb(hue, 0.8, lightness);
                const colorHex = this.colorToHex(rgb.r, rgb.g, rgb.b);
                const colorInt = this.colorToInt(rgb.r, rgb.g, rgb.b);

                const path = `M${x} ${y} L${x + s.cellSize} ${y} L${x + s.cellSize} ${y + s.cellSize} L${x} ${y + s.cellSize} Z`;
                const id = this.generateUUID();
                const displayName = `MOPA S${cellSpeed} P${cellPower} F${cellFreq}`;

                const display = this.createPathDisplay(id, displayName, colorHex, colorInt, x, y, s.cellSize, s.cellSize, zOrder, path);
                displays.push(display);

                // Settings Injection
                const extraParams = {
                    pulseWidth: pulseWidth,
                    mopaFrequency: cellFreq,
                    processingLightSource: laser ? laser.lightSource : 'red',
                    _planType: laser ? laser.planType : 'red',
                };

                // Create Settings
                const settingsStr = this.createDisplaySettings(cellFreq, mopaLpi, cellPower, cellSpeed, passes, extraParams);

                displaySettings.push([id, settingsStr]);
                layerData[colorHex] = { name: displayName, order: zOrder++, visible: true };
                cellCount++;
            }
        }

        // Add QR Code
        const qrData = this.encodeSettings(numCols, numRows);
        const qrPath = this.generateQRPath(qrData, 0, 0, QR_SIZE_MM);
        const qrDisplayId = this.generateUUID();
        const qrDisplay = this.createPathDisplay(
            qrDisplayId, 'Settings QR Code',
            '#000000', 0,
            qrX, qrY, QR_SIZE_MM, QR_SIZE_MM,
            zOrder, qrPath,
            true
        );

        displays.push(qrDisplay);
        // QR Settings: Use default engraving for QR (e.g. 100 speed, 75 power? No, use s.qr*)
        const qrPwr = s.qrPower || 17.5;
        const qrSpd = s.qrSpeed || 150;
        const qrFreq = s.qrFrequency || 90;
        const qrL = s.qrLpi || 2500;

        displaySettings.push([qrDisplayId, this.createDisplaySettings(qrFreq, qrL, qrPwr, qrSpd, 1, { processingLightSource: 'red', mopaFrequency: qrFreq, pulseWidth: s.pulseWidth || 80 })]);
        layerData['#000000'] = { name: 'QR Code', order: zOrder, visible: true };

        const xcs = {
            canvasId,
            canvas: [{
                id: canvasId,
                title: `MOPA ${mode.toUpperCase()} X${xValues[0]}-${xValues[xValues.length - 1]} Y${yValues[0]}-${yValues[yValues.length - 1]}`,
                layerData,
                groupData: {},
                displays
            }],
            extId: extId,
            extName: extName,
            version: '1.3.6',
            created: now,
            modify: now,
            device: {
                id: extId,
                power: laser ? laser.powerLevels : [20],
                data: {
                    dataType: 'Map',
                    value: [[canvasId, {
                        mode: 'LASER_PLANE',
                        data: { LASER_PLANE: { material: getXtoolMaterialId(this.settings.material || DEFAULT_MATERIAL_ID), lightSourceMode: lightSource, thickness: 0, isProcessByLayer: false, pathPlanning: 'auto', fillPlanning: 'separate' } },
                        displays: { dataType: 'Map', value: displaySettings }
                    }]]
                },
                materialList: [],
                materialTypeList: [],
                customProjectData: { tangentialCuttingUuids: [], flyCutUuid2CanvasIds: {} }
            }
        };

        return {
            xcs: JSON.stringify(xcs),
            gridInfo: {
                width: s.cardWidth,
                height: s.cardHeight,
                numCols: numCols,
                numRows: numRows,
                totalCells: cellCount,
                qrData: qrData,
                qrSize: QR_SIZE_MM,
                qrX: qrX,
                qrY: qrY,
                gapX: s.cellGap,
                gapY: s.cellGap,
                effectiveGridW,
                effectiveGridH,
                globalOffsetX,
                globalOffsetY,
                excStartCol,
                excStartRow,

                // MOPA Specific Metadata (reusing lpi/freq names for Analyzer compatibility)
                lpiValues: xValues,
                freqValues: yValues,
                xAxisLabel: mode === 'speed' ? 'Power (%)' : 'Speed (mm/s)',
                yAxisLabel: mode === 'frequency' ? 'Power (%)' : 'Frequency (kHz)',
                gridMode: mode
            }
        };
    }

}
