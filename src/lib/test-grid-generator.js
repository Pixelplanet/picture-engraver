/**
 * Test Grid Generator Module
 * Generates calibration grids with QR codes for laser engraving settings
 */

import jsQR from 'jsqr';
import QRCode from 'qrcode';

export class TestGridGenerator {
    constructor(settings = {}) {
        const isMopa = settings.activeDevice && (settings.activeDevice.includes('mopa') || settings.activeDevice.includes('base'));

        this.settings = {
            // Business card dimensions
            cardWidth: 85,
            cardHeight: 55,

            // Grid parameters
            lpiMin: 500,
            lpiMax: 2000,
            lpi: isMopa ? 3000 : undefined, // Fixed LPC for MOPA default

            freqMin: 40,
            freqMax: isMopa ? 40 : 90, // Fixed freq for MOPA default (Power grid)

            // Engraving settings
            power: 70,
            powerMin: isMopa ? 14 : undefined,
            powerMax: isMopa ? 18 : undefined,

            speed: 425,
            speedMin: isMopa ? 400 : undefined,
            speedMax: isMopa ? 800 : undefined,

            passes: isMopa ? 1 : 1,
            crossHatch: !isMopa, // False for MOPA

            // QR code settings
            qrPower: 75,
            qrSpeed: 100,
            qrSize: 12,
            qrFrequency: 45,
            qrLpi: 500,

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
        const customize = {
            bitmapEngraveMode: 'normal',
            speed,
            density: lpi,
            dpi: lpi,
            power,
            repeat: passes,
            bitmapScanMode: this.settings.crossHatch ? 'crossMode' : 'zMode', // MOPA uses zMode (Bi-directional)
            frequency,
            crossAngle: this.settings.crossHatch,
            scanAngle: 0,
            angleType: 2,
            processingLightSource: 'red', // Per user confirmation for MOPA IR
            ...extraParams // Inject extra params like pulseWidth, mopaFrequency
        };

        return {
            isFill: true, type: 'PATH', processingType: 'FILL_VECTOR_ENGRAVING',
            data: {
                VECTOR_CUTTING: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { ...customize, frequency: 40 } } },
                VECTOR_ENGRAVING: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { ...customize, frequency: 40 } } },
                FILL_VECTOR_ENGRAVING: {
                    materialType: 'customize', planType: 'dot_cloud',
                    parameter: { customize }
                },
                INTAGLIO: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { ...customize, speed: 80, density: 300, power: 1, repeat: 1, frequency: 40 } } },
                INNER_THREE_D: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { ...customize, subdivide: 0.1, speed: 80, power: 1, repeat: 1, frequency: 40 } } }
            },
            processIgnore: false
        };
    }

    // Encode settings for QR code
    encodeSettings(numCols, numRows) {
        const s = this.settings;
        const deviceId = this.settings.activeDevice || 'f2_ultra_uv';
        const isMopa = deviceId.includes('mopa') || deviceId.includes('base');
        const type = isMopa ? 'mopa' : 'uv';

        if (isMopa) {
            // MOPA Mapping:
            // X-Axis (l): Speed
            // Y-Axis (f): Varies. If Freq is fixed, we use Power. If Freq varies, we use Freq.

            const freqFixed = (s.freqMin === s.freqMax);
            let yMin = s.freqMin || 200;
            let yMax = s.freqMax || 1200;

            if (freqFixed) {
                yMin = s.powerMin || 14;
                yMax = s.powerMax || 18;
            }

            return JSON.stringify({
                v: 2, // Version bump for MOPA support
                l: [s.speedMin || 400, s.speedMax || 800, numCols], // X-Axis (Speed)
                f: [yMin, yMax, numRows], // Y-Axis (Power or Freq)
                p: s.power || 14,
                d: s.lpi || 3000, // Density (LPC)
                pw: s.pulseWidth || 80,
                t: type
            });
        } else {
            // UV Mapping:
            // X-Axis (l): LPI
            // Y-Axis (f): Freq
            // Fixed: Power (p), Speed (s)
            return JSON.stringify({
                v: 1,
                l: [s.lpiMax, s.lpiMin, numCols],
                f: [s.freqMin, s.freqMax, numRows],
                p: s.power,
                s: s.speed,
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
                // Support both old and new (shorter) keys
                const settings = {
                    v: raw.v,
                    lpi: raw.l || raw.lpi,
                    freq: raw.f || raw.freq,
                    pwr: raw.p || raw.pwr,
                    spd: raw.s || raw.spd,
                    type: raw.t || 'uv', // Default to UV if missing
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

        // Build XCS
        const deviceId = this.settings.activeDevice || 'f2_ultra_uv';
        const isMopa = deviceId === 'f2_ultra_mopa' || deviceId === 'f2_ultra_base';

        if (isMopa) {
            return this.generateMopaGrid(canvasId, now);
        }

        const extId = "GS009-CLASS-4";
        const extName = "F2 Ultra UV";
        const lightSource = "uv";

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
                power: [5],
                data: {
                    dataType: 'Map',
                    value: [[canvasId, {
                        mode: 'LASER_PLANE',
                        data: { LASER_PLANE: { material: 0, lightSourceMode: lightSource, thickness: 117, isProcessByLayer: false, pathPlanning: 'auto', fillPlanning: 'separate' } },
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
                excStartRow
            }
        };
    }


    generateMopaGrid(canvasId, now) {
        const s = this.settings;
        const displays = [];
        const displaySettings = [];
        const layerData = {};

        // Check if we are doing Speed vs Power (standard request) or Speed vs Freq
        let isPowerGrid = false;

        // If user explicitly provides freq min/max that are different, use Freq.
        // Otherwise, if power min/max differ (or are default), use Power.
        if (s.freqMin !== undefined && s.freqMax !== undefined && s.freqMin !== s.freqMax) {
            isPowerGrid = false;
        } else {
            // Default to Power grid as per user request (14-18%)
            isPowerGrid = true;
        }

        const speedMin = s.speedMin || 400;
        const speedMax = s.speedMax || 800;

        let freqMin, freqMax, powerMin, powerMax;

        if (isPowerGrid) {
            // Power on Y-Axis
            powerMin = s.powerMin || 14;
            powerMax = s.powerMax || 18;
            // Fixed Frequency
            freqMin = s.freqMin || 40; // Default MOPA freq
            freqMax = freqMin;
        } else {
            // Frequency on Y-Axis
            freqMin = s.freqMin || 200;
            freqMax = s.freqMax || 1200;
            // Fixed Power
            powerMin = s.power || 14;
            powerMax = powerMin;
        }

        // Constants (User Confirmed: Pulse 80, 3000 LPC)
        const lpi = s.lpi || 3000;
        const pulseWidth = s.pulseWidth || 80;
        const passes = s.passes || 1;
        // const power = s.power || 14; // Derived inside loop

        // ... existing setup ... (removed duplication of loop logic for clarity, will rewrite loop)

        // XCS Structure for MOPA
        const extId = "GS004-CLASS-4";
        const extName = "F2 Ultra"; // Found in user file
        const lightSource = "infrared"; // MOPA is typically IR

        // FIXED QR CODE LOGIC (17mm x 17mm with 1mm gap)
        const QR_SIZE_MM = 17;
        const QR_GAP_MM = 1;

        // Layout Config
        const availableWidth = s.cardWidth - (s.margin * 2);
        const availableHeight = s.cardHeight - (s.margin * 2);
        const totalCellSize = s.cellSize + s.cellGap;

        let numCols = Math.floor((availableWidth + s.cellGap) / totalCellSize);
        let numRows = Math.floor((availableHeight + s.cellGap) / totalCellSize);

        if (numCols < 1) numCols = 1;
        if (numRows < 1) numRows = 1;

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

        // Calculate steps
        const speedStep = numCols > 1 ? (speedMax - speedMin) / (numCols - 1) : 0;

        // Y-Axis Step (Power or Freq)
        const yMin = isPowerGrid ? powerMin : freqMin;
        const yMax = isPowerGrid ? powerMax : freqMax;

        const yStep = numRows > 1 ? (yMax - yMin) / (numRows - 1) : 0;

        // Generate Axis Values for Metadata
        const colValues = [];
        for (let c = 0; c < numCols; c++) {
            colValues.push(Math.round(speedMin + (c * speedStep)));
        }

        const rowValues = [];
        for (let r = 0; r < numRows; r++) {
            rowValues.push(Math.round(yMin + (r * yStep)));
        }

        let zOrder = 1;
        let cellCount = 0;

        // Iterate Rows (Y Axis: Power or Frequency)
        for (let r = 0; r < numRows; r++) {
            const yVal = Math.round(yMin + (r * yStep));

            // Determine Row Settings
            let rowFreq = isPowerGrid ? freqMin : yVal;
            let rowPower = isPowerGrid ? yVal : powerMin;

            // Iterate Cols (Speed: Min to Max, left to right)
            for (let c = 0; c < numCols; c++) {

                // Exclusion
                if (c >= excStartCol && r >= excStartRow) {
                    continue;
                }

                const colSpeed = Math.round(speedMin + (c * speedStep));

                // ID & Position
                const id = this.generateUUID();
                const x = globalOffsetX + c * colPitch;
                const y = globalOffsetY + r * rowPitch;

                // Color Helper (Gray Gradient)
                const grayVal = Math.floor(255 - ((c / numCols) * 200));
                const colorHex = this.colorToHex(grayVal, grayVal, grayVal);
                const colorInt = (grayVal << 16) | (grayVal << 8) | grayVal;

                // Create Path
                const path = `M${x} ${y} L${x + s.cellSize} ${y} L${x + s.cellSize} ${y + s.cellSize} L${x} ${y + s.cellSize} Z`;

                // Display Name: "S{speed} F{freq}" or "S{speed} P{power}"
                const displayName = isPowerGrid
                    ? `S${colSpeed} P${rowPower}%`
                    : `S${colSpeed} F${rowFreq}k`;

                const display = this.createPathDisplay(id, displayName, colorHex, colorInt, x, y, s.cellSize, s.cellSize, zOrder, path);
                displays.push(display);

                // Settings Injection
                const extraParams = {
                    pulseWidth: pulseWidth,
                    mopaFrequency: rowFreq, // Specific for MOPA
                };

                // Pass rowFreq as standard frequency too, though MOPA might use mopaFrequency
                const settingsStr = this.createDisplaySettings(rowFreq, lpi, rowPower, colSpeed, passes, extraParams);

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
        const qrPwr = s.qrPower || 75;
        const qrSpd = s.qrSpeed || 100;
        const qrFreq = s.qrFrequency || 45;
        const qrL = s.qrLpi || 500;

        displaySettings.push([qrDisplayId, this.createDisplaySettings(qrFreq, qrL, qrPwr, qrSpd, 1, { processingLightSource: 'red', mopaFrequency: qrFreq })]);
        layerData['#000000'] = { name: 'QR Code', order: zOrder, visible: true };

        const xcs = {
            canvasId,
            canvas: [{
                id: canvasId,
                title: `MOPA Grid S${speedMin}-${speedMax} F${freqMin}-${freqMax}`,
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
                power: [20],
                data: {
                    dataType: 'Map',
                    value: [[canvasId, {
                        mode: 'LASER_PLANE',
                        data: { LASER_PLANE: { material: 0, lightSourceMode: lightSource, thickness: 0, isProcessByLayer: false, pathPlanning: 'auto', fillPlanning: 'separate' } },
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
                lpiValues: colValues,
                freqValues: rowValues,
                xAxisLabel: 'Speed (mm/s)',
                yAxisLabel: isPowerGrid ? 'Power (%)' : 'Frequency (kHz)'
            }
        };
    }

}
