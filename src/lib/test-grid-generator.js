/**
 * Test Grid Generator Module
 * Generates calibration grids with QR codes for laser engraving settings
 */

import jsQR from 'jsqr';
import { create as createQR } from 'qrcode';

export class TestGridGenerator {
    constructor(settings = {}) {
        this.settings = {
            // Business card dimensions
            cardWidth: 85,
            cardHeight: 55,

            // Grid parameters
            lpiMin: 300,
            lpiMax: 800,
            highLpiMode: false,

            freqMin: 40,
            freqMax: 90,

            // Engraving settings
            power: 70,
            speed: 425,
            passes: 2,
            crossHatch: true,

            // QR code settings
            qrPower: 45,
            qrSpeed: 80,
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

    createDisplaySettings(frequency, lpi, power, speed, passes) {
        return {
            isFill: true, type: 'PATH', processingType: 'FILL_VECTOR_ENGRAVING',
            data: {
                VECTOR_CUTTING: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { power, speed, repeat: passes, frequency: 40 } } },
                VECTOR_ENGRAVING: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { speed, power, repeat: passes, frequency: 40 } } },
                FILL_VECTOR_ENGRAVING: {
                    materialType: 'customize', planType: 'dot_cloud',
                    parameter: {
                        customize: {
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
                            angleType: 2
                        }
                    }
                },
                INTAGLIO: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { speed: 80, density: 300, power: 1, repeat: 1, frequency: 40 } } },
                INNER_THREE_D: { materialType: 'customize', planType: 'dot_cloud', parameter: { customize: { subdivide: 0.1, speed: 80, power: 1, repeat: 1, frequency: 40 } } }
            },
            processIgnore: false
        };
    }

    // Encode settings for QR code
    encodeSettings(numCols, numRows) {
        const s = this.settings;
        // Use very short keys to reduce QR code density
        return JSON.stringify({
            v: 1,
            l: [s.lpiMax, s.lpiMin, numCols],
            f: [s.freqMin, s.freqMax, numRows],
            p: s.power,
            s: s.speed
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
            // Use low version and high error correction for better readability
            const qr = createQR(text, {
                errorCorrectionLevel: 'Q', // Medium-High error correction
                version: 5 // Allow larger versions for more data
            });
            const modules = qr.modules;
            const count = modules.size;
            const cellSize = size / count;
            let path = '';

            for (let r = 0; r < count; r++) {
                for (let c = 0; c < count; c++) {
                    if (modules.get(c, r)) {
                        const cx = x + c * cellSize;
                        const cy = y + r * cellSize;
                        // Use simple L commands for compatibility
                        path += `M${cx} ${cy} L${cx + cellSize} ${cy} L${cx + cellSize} ${cy + cellSize} L${cx} ${cy + cellSize} Z `;
                    }
                }
            }
            return path;
        } catch (e) {
            console.error('QR Gen Error', e);
            // Fallback: square placeholder
            return `M${x} ${y}L${x + size} ${y}L${x + size} ${y + size}L${x} ${y + size}Z`;
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
        // LPI: High to Low (left to right)
        const lpiValues = this.linspace(s.lpiMax, s.lpiMin, numCols);
        // Frequency: Low to High (top to bottom)
        const freqValues = this.linspace(s.freqMin, s.freqMax, numRows);

        // Center the grid in 200x200mm workspace
        const workspaceSize = 200;
        const offsetX = (workspaceSize - s.cardWidth) / 2;
        const offsetY = (workspaceSize - s.cardHeight) / 2;

        // QR Code Position (Bottom Right, 3x3 cells for better readability with version 5)
        const qrCells = 3;
        const qrStartCol = numCols - qrCells;
        const qrStartRow = numRows - qrCells;
        const qrX = offsetX + s.margin + qrStartCol * totalCellSize;
        const qrY = offsetY + s.margin + qrStartRow * totalCellSize;
        const qrSize = (qrCells * totalCellSize) - s.cellGap;

        const displays = [];
        const displaySettings = [];
        const layerData = {};
        let zOrder = 1;
        let cellCount = 0;

        // Generate grid cells
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                // Skip QR area
                if (col >= qrStartCol && row >= qrStartRow) {
                    continue;
                }

                const displayId = this.generateUUID();

                const x = offsetX + s.margin + col * totalCellSize;
                const y = offsetY + s.margin + row * totalCellSize;

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
                layerData[colorHex] = { name: `${frequency}kHz/${lpi}LPI`, order: zOrder, visible: true };

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
            xcs: JSON.stringify(xcs),
            gridInfo: {
                width: s.cardWidth,
                height: s.cardHeight,
                numCols,
                numRows,
                totalCells: cellCount,
                qrData,
                qrSize,
                qrX,
                qrY
            }
        };
    }
}
