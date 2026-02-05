/**
 * Test Grid Generator Module
 * Generates calibration grids with QR codes for laser engraving settings
 */

import jsQR from 'jsqr';
import QRCode from 'qrcode';

export class TestGridGenerator {
    constructor(settings = {}) {
        this.settings = {
            // Business card dimensions
            cardWidth: 85,
            cardHeight: 55,

            // Grid parameters
            lpiMin: 500,
            lpiMax: 2000,


            freqMin: 40,
            freqMax: 90,

            // Engraving settings
            power: 70,
            speed: 425,
            passes: 1,
            crossHatch: true,

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
            bitmapScanMode: this.settings.crossHatch ? 'crossMode' : 'lineMode',
            frequency,
            crossAngle: this.settings.crossHatch,
            scanAngle: 0,
            angleType: 2,
            ...extraParams // Inject extra params like pulseWidth, mopaFrequency, processingLightSource
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
        const type = (deviceId.includes('mopa') || deviceId.includes('base')) ? 'mopa' : 'uv';

        // Use very short keys to reduce QR code density
        return JSON.stringify({
            v: 1,
            l: [s.lpiMax, s.lpiMin, numCols],
            f: [s.freqMin, s.freqMax, numRows],
            p: s.power,
            s: s.speed,
            t: type
        });
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

        const totalCellSize = s.cellSize + s.cellGap;

        // Calculate how many cells fit
        const availableWidth = s.cardWidth - (s.margin * 2);
        const availableHeight = s.cardHeight - (s.margin * 2);

        const numCols = Math.floor((availableWidth + s.cellGap) / totalCellSize);
        const numRows = Math.floor((availableHeight + s.cellGap) / totalCellSize);

        // Generate values
        // LPC: High to Low (left to right)
        const lpiValues = this.linspace(s.lpiMax, s.lpiMin, numCols);
        // Frequency: Low to High (top to bottom)
        const freqValues = this.linspace(s.freqMin, s.freqMax, numRows);

        // Center the grid in 200x200mm workspace
        const workspaceSize = 200;
        const offsetX = (workspaceSize - s.cardWidth) / 2;
        const offsetY = (workspaceSize - s.cardHeight) / 2;

        // FIXED QR CODE LOGIC (17mm x 17mm with 1mm gap)
        const QR_SIZE_MM = 17;
        const QR_GAP_MM = 1;
        const qrSize = QR_SIZE_MM;

        // Position QR code in bottom-right corner of the printable area
        // Coordinates relative to the card's origin (margin included)
        const contentX = s.margin;
        const contentY = s.margin;

        // Relative QR position (top-left of the QR box)
        const relQrX = availableWidth - QR_SIZE_MM;
        const relQrY = availableHeight - QR_SIZE_MM;

        // Absolute QR position in workspace
        const qrX = offsetX + contentX + relQrX;
        const qrY = offsetY + contentY + relQrY;

        // Define the reserved area for collision detection (including the gap)
        // We add the gap to top and left of the QR code
        const reservedBox = {
            left: relQrX - QR_GAP_MM,
            top: relQrY - QR_GAP_MM,
            right: availableWidth,
            bottom: availableHeight
        };

        const displays = [];
        const displaySettings = [];
        const layerData = {};
        let zOrder = 1;
        let cellCount = 0;

        // Generate grid cells
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {

                // Calculate cell position relative to card content area
                const cellRelX = col * totalCellSize;
                const cellRelY = row * totalCellSize;

                // Check for overlap with reserved QR area
                // We check if the cell's bounding box intersects the reserved box
                // Cell box: [cellRelX, cellRelY] to [cellRelX + s.cellSize, cellRelY + s.cellSize]
                const cellRight = cellRelX + s.cellSize;
                const cellBottom = cellRelY + s.cellSize;

                const overlaps = !(
                    cellRight < reservedBox.left ||
                    cellRelX > reservedBox.right ||
                    cellBottom < reservedBox.top ||
                    cellRelY > reservedBox.bottom
                );

                if (overlaps) {
                    continue; // Skip this cell
                }

                const displayId = this.generateUUID();

                const x = offsetX + s.margin + cellRelX;
                const y = offsetY + s.margin + cellRelY;

                const frequency = Math.round(freqValues[row]);
                const lpi = Math.round(lpiValues[col]);

                // Generate color based on position (Logical color for mapping)
                const hue = (col / numCols) * 0.7;
                const lightness = 0.3 + (row / numRows) * 0.4;
                const rgb = this.hslToRgb(hue, 0.8, lightness);

                const colorHex = this.colorToHex(rgb.r, rgb.g, rgb.b);
                const colorInt = this.colorToInt(rgb.r, rgb.g, rgb.b);

                // Create cell path (relative to x,y)
                const path = `M0 0 L${s.cellSize} 0 L${s.cellSize} ${s.cellSize} L0 ${s.cellSize} Z`;

                const display = this.createPathDisplay(
                    displayId,
                    `F${frequency}kHz / L${lpi}`,
                    colorHex, colorInt,
                    x, y, s.cellSize, s.cellSize,
                    zOrder, path,
                    false // isCompoundPath
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
        const qrPath = this.generateQRPath(qrData, 0, 0, qrSize);

        const qrDisplayId = this.generateUUID();
        const qrDisplay = this.createPathDisplay(
            qrDisplayId, 'Settings QR Code',
            '#000000', 0,
            qrX, qrY, qrSize, qrSize,
            zOrder, qrPath,
            true // isCompoundPath
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
                qrSize: QR_SIZE_MM, // Return fixed size
                qrX,
                qrY,
                // Pass gap info if needed by frontend, though XCS is already built
                qrGap: QR_GAP_MM
            }
        };
    }


    generateMopaGrid(canvasId, now) {
        const s = this.settings;
        const displays = [];
        const displaySettings = [];
        const layerData = {};

        // MOPA Grid Configuration
        // X-Axis: Speed
        // Y-Axis: Frequency
        const speedMin = s.speedMin || 200;
        const speedMax = s.speedMax || 1200;
        const freqMin = s.freqMin || 200;
        const freqMax = s.freqMax || 1200;

        // Constants (User Confirmed: Power 14, Pulse 80, LPC 5000 LPC)
        const lpi = s.lpi || 5000;
        const pulseWidth = s.pulseWidth || 80;
        const passes = s.passes || 1;

        // XCS Structure for MOPA
        const extId = "GS009-CLASS-1";
        const extName = "F2 Ultra (MOPA)";
        const lightSource = "red"; // MOPA IR

        // Layout Config
        const cols = Math.floor((s.cardWidth - (s.margin * 2)) / (s.cellSize + s.cellGap));
        const rows = Math.floor((s.cardHeight - (s.margin * 2)) / (s.cellSize + s.cellGap));

        // Calculate steps
        const speedStep = cols > 1 ? (speedMax - speedMin) / (cols - 1) : 0;
        const freqStep = rows > 1 ? (freqMax - freqMin) / (rows - 1) : 0;

        let zOrder = 1;

        // Iterate Rows (Frequency: Min to Max, top to bottom)
        for (let r = 0; r < rows; r++) {
            const rowFreq = Math.round(freqMin + (r * freqStep));

            // Iterate Cols (Speed: Min to Max, left to right)
            for (let c = 0; c < cols; c++) {
                const colSpeed = Math.round(speedMin + (c * speedStep));

                // ID & Position
                const id = this.generateUUID();
                const x = s.margin + (c * (s.cellSize + s.cellGap));
                const y = s.margin + (r * (s.cellSize + s.cellGap));

                // Color Helper (Gray Gradient)
                const grayVal = Math.floor(255 - ((c / cols) * 200));
                const colorHex = this.colorToHex(grayVal, grayVal, grayVal);
                const colorInt = (grayVal << 16) | (grayVal << 8) | grayVal;

                // Create Path
                const path = `M${x} ${y} L${x + s.cellSize} ${y} L${x + s.cellSize} ${y + s.cellSize} L${x} ${y + s.cellSize} Z`;

                // Display Name: "S{speed} F{freq}"
                const displayName = `S${colSpeed} F${rowFreq}`;

                const display = this.createPathDisplay(id, displayName, colorHex, colorInt, x, y, s.cellSize, s.cellSize, zOrder, path);
                displays.push(display);

                // Settings Injection
                const extraParams = {
                    pulseWidth: pulseWidth,
                    mopaFrequency: rowFreq, // Specific for MOPA
                    processingLightSource: lightSource
                };

                // Pass rowFreq as standard frequency too, though MOPA might use mopaFrequency
                const settingsStr = this.createDisplaySettings(rowFreq, lpi, power, colSpeed, passes, extraParams);

                displaySettings.push([id, settingsStr]);
                layerData[colorHex] = { name: displayName, order: zOrder++, visible: true };
            }
        }

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
                numCols: cols,
                numRows: rows,
                totalCells: cols * rows,
                qrData: "{}",
                qrSize: 0,
                qrX: 0,
                qrY: 0
            }
        };
    }

}
