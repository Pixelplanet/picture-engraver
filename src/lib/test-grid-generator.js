/**
 * Test Grid Generator Module
 * Generates calibration grids with QR codes for laser engraving settings
 */

import jsQR from 'jsqr';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { getXtoolMaterialId, DEFAULT_MATERIAL_ID } from './material-registry.js';
import { getLaserConfig, getDeviceConfig, resolveDeviceId, getDefaultDefocus, normalizeDefocus } from './device-registry.js';
import { XSGenerator } from './xs-generator.js';

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

            // Defocus (mm). 0 = disabled. Defaults to per-laser-type config.
            defocus: getDefaultDefocus(deviceId, laserTypeId),

            // Output format ('xcs' or 'xs'). Test grids stay xcs by default for
            // back-compat; the UI dispatcher overrides this when needed.
            exportFormat: 'xcs',

            // Layout
            cellSize: 5,
            cellGap: 1,
            margin: 1, // All sides

            ...settings
        };

        // Studio's canvas size differs by physical device. Used to center the
        // grid in the work area.
        this._extId = laser ? laser.extId : null;
    }

    // Per-extId workspace size (mm). Each Studio device has a fixed canvas
    // matching its laser-bed dimensions:
    //   GS006          → F2                  → 115 × 115
    //   GS009-CLASS-4  → F2 Ultra UV         → 200 × 200
    //   GS004-CLASS-4  → F2 Ultra Dual       → 220 × 220
    //   GS007-CLASS-4  → F2 Ultra Single MOPA → 220 × 220
    //   GS009-CLASS-1  → legacy MOPA id (xs remaps to GS004-CLASS-4) → 220
    getWorkspaceSize() {
        switch (this._extId) {
            case 'GS006':         return 115;
            case 'GS009-CLASS-4': return 200;
            case 'GS004-CLASS-4': return 220;
            case 'GS007-CLASS-4': return 220;
            case 'GS009-CLASS-1': return 220;
            default:              return 200;
        }
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

    // Evenly spaced values without integer rounding (for defocus mm, which is
    // fractional). Rounds to `decimals` places to keep QR/labels tidy.
    linspaceF(min, max, steps, decimals = 2) {
        const f = Math.pow(10, decimals);
        const round = (v) => Math.round(v * f) / f;
        if (steps <= 1) return [round(min)];
        const result = [];
        for (let i = 0; i < steps; i++) {
            result.push(round(min + (max - min) * i / (steps - 1)));
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

    // Minimal 3×5 pixel font for rendering numeric axis tick labels as solid
    // (fill-engravable) compound paths. Supports digits, '.', '-', and a space.
    getPixelFont() {
        if (this._pixelFont) return this._pixelFont;
        const f = {
            '0': ['111', '101', '101', '101', '111'],
            '1': ['010', '110', '010', '010', '111'],
            '2': ['111', '001', '111', '100', '111'],
            '3': ['111', '001', '111', '001', '111'],
            '4': ['101', '101', '111', '001', '001'],
            '5': ['111', '100', '111', '001', '111'],
            '6': ['111', '100', '111', '101', '111'],
            '7': ['111', '001', '010', '010', '010'],
            '8': ['111', '101', '111', '101', '111'],
            '9': ['111', '101', '111', '001', '111'],
            '.': ['000', '000', '000', '000', '010'],
            '-': ['000', '000', '111', '000', '000'],
            ' ': ['000', '000', '000', '000', '000'],
        };
        this._pixelFont = f;
        return f;
    }

    // Render a numeric string as a compound dPath of filled pixel squares.
    // Returns { dPath, width, height }. Origin (x,y) is the top-left of the text.
    renderPixelText(text, x, y, px) {
        const font = this.getPixelFont();
        const advance = 4 * px; // 3 px glyph + 1 px spacing
        let dPath = '';
        let cursor = x;
        for (const ch of String(text)) {
            const glyph = font[ch] || font[' '];
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 3; c++) {
                    if (glyph[r][c] !== '1') continue;
                    const px0 = cursor + c * px;
                    const py0 = y + r * px;
                    const px1 = px0 + px;
                    const py1 = py0 + px;
                    dPath += `M${px0} ${py0} L${px1} ${py0} L${px1} ${py1} L${px0} ${py1} Z`;
                }
            }
            cursor += advance;
        }
        const width = Math.max(0, text.length * advance - px);
        return { dPath, width, height: 5 * px };
    }

    createDisplaySettings(frequency, lpi, power, speed, passes, extraParams = {}) {
        // Determine laser capabilities from extraParams or active laser config
        const hasMopaFreq = !!extraParams.mopaFrequency;
        const processingLightSource = extraParams.processingLightSource || 'red';
        const planType = extraParams._planType || (hasMopaFreq ? 'red' : 'dot_cloud');

        // Resolve crossHatch: use explicit override if provided, else fall back to global setting
        const crossHatch = extraParams._crossHatch !== undefined ? extraParams._crossHatch : !!this.settings.crossHatch;

        // Strip internal-only keys before spreading into XCS data
        const { _planType, _crossHatch, _defocus, ...xcsParams } = extraParams;

        const customize = {
            bitmapEngraveMode: 'normal',
            speed,
            density: lpi,
            dpi: lpi,
            power,
            repeat: passes,
            bitmapScanMode: crossHatch ? 'crossMode' : 'zMode',
            frequency,
            crossAngle: crossHatch,
            scanAngle: 0,
            angleType: 2,
            processingLightSource,
            ...xcsParams
        };

        // Defocus injection (used by the .xs writer; harmless to xcs consumers).
        // A per-cell override (_defocus) takes precedence over the global setting,
        // enabling defocus-axis test grids where each row uses a different focus.
        // Normalised to the canonical 1–12mm / 0.1mm rules; below 1mm is OFF.
        const rawDefocus = typeof extraParams._defocus === 'number'
            ? extraParams._defocus
            : (typeof this.settings.defocus === 'number' ? this.settings.defocus : 0);
        const defocusMm = normalizeDefocus(rawDefocus);
        if (defocusMm > 0) {
            customize.defocus = true;
            customize.defocus_distance = defocusMm;
        } else {
            customize.defocus = false;
            customize.defocus_distance = 1;
        }

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

        // Flexible (any-axis) grid — generic v6 payload for all laser types.
        if (s.gridMode === 'flexible') {
            const cfg = this.resolveFlexConfig();
            return JSON.stringify({
                v: 6,
                t: 'flex',
                x: { p: cfg.xParam, r: [cfg.xRange.min, cfg.xRange.max] },
                y: { p: cfg.yParam, r: [cfg.yRange.min, cfg.yRange.max] },
                c: {
                    f: cfg.constants.frequency,
                    p: cfg.constants.power,
                    s: cfg.constants.speed,
                    l: cfg.constants.lpc,
                    d: cfg.constants.defocus,
                    pw: cfg.constants.pulseWidth,
                },
                n: numCols,
                r: numRows,
                m: material,
                laser: isMopaLike ? 'mopa' : 'uv',
            });
        }

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
                v: 5,
                ax: mode === 'power' ? 'p' : (mode === 'speed' ? 's' : 'f'),
                f: fRange,
                p: pRange,
                s: sRange,
                r: numRows,
                c: numCols,
                l: s.lpi || 5000, // Density
                pw: s.pulseWidth || 80,
                m: material,
                df: typeof s.defocus === 'number' ? s.defocus : 0,
                t: 'mopa'
            });
        } else if (s.gridMode === 'defocus') {
            // UV defocus-axis grid (v4 — X=LPC, Y=defocus mm, fixed frequency).
            // Only meaningful for .xs export (per-layer focus).
            const fixedFreq = Math.round(typeof s.freq === 'number' ? s.freq : s.freqMin);
            return JSON.stringify({
                v: 4,
                t: 'uv_defocus',
                l: [s.lpiMax, s.lpiMin, numCols],
                d: [
                    typeof s.defocusMin === 'number' ? s.defocusMin : 0,
                    typeof s.defocusMax === 'number' ? s.defocusMax : 6,
                    numRows
                ],
                f: fixedFreq,
                p: s.power,
                s: s.speed,
                m: material
            });
        } else {
            return JSON.stringify({
                v: 3,
                l: [s.lpiMax, s.lpiMin, numCols],
                f: [s.freqMin, s.freqMax, numRows],
                p: s.power,
                s: s.speed,
                m: material,
                df: typeof s.defocus === 'number' ? s.defocus : 0,
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

                // Flexible (any-axis) grid — generic v6 payload.
                if (raw.t === 'flex') {
                    const meta = this.getFlexParamMeta();
                    const cols = raw.n || 14;
                    const rows = raw.r || 9;
                    const xMeta = meta[raw.x?.p] || { label: raw.x?.p || 'X', unit: '', float: false };
                    const yMeta = meta[raw.y?.p] || { label: raw.y?.p || 'Y', unit: '', float: false };
                    const xValues = xMeta.float ? this.linspaceF(raw.x.r[0], raw.x.r[1], cols) : this.linspace(raw.x.r[0], raw.x.r[1], cols);
                    const yValues = yMeta.float ? this.linspaceF(raw.y.r[0], raw.y.r[1], rows) : this.linspace(raw.y.r[0], raw.y.r[1], rows);
                    return {
                        found: true,
                        data: raw,
                        version: raw.v,
                        material: raw.m || 'stainless_304',
                        lpiValues: xValues,
                        freqValues: yValues,
                        xAxisLabel: `${xMeta.label} (${xMeta.unit})`,
                        yAxisLabel: `${yMeta.label} (${yMeta.unit})`,
                        gridMode: 'flex',
                        xParam: raw.x?.p,
                        yParam: raw.y?.p,
                        constants: raw.c,
                    };
                }

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
                        defocus: typeof raw.df === 'number' ? raw.df : 0,
                        lpiValues: xValues,  // Mapped to X
                        freqValues: yValues, // Mapped to Y
                        xAxisLabel: xLabel,
                        yAxisLabel: yLabel,
                        gridMode: mode
                    };
                }

                // UV defocus-axis grid (v4): X = LPC, Y = defocus (mm), fixed freq.
                if (raw.t === 'uv_defocus') {
                    const cols = raw.l[2];
                    const rows = raw.d[2];
                    const xValues = this.linspace(raw.l[0], raw.l[1], cols);
                    const yValues = this.linspaceF(raw.d[0], raw.d[1], rows);
                    return {
                        found: true,
                        data: raw,
                        version: raw.v,
                        material: raw.m || 'stainless_304',
                        defocus: yValues,
                        defocusValues: yValues,
                        fixedFrequency: raw.f,
                        lpiValues: xValues,
                        freqValues: yValues,
                        xAxisLabel: 'LPC',
                        yAxisLabel: 'Defocus (mm)',
                        gridMode: 'defocus',
                        power: raw.p,
                        speed: raw.s
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
                    defocus: typeof raw.df === 'number' ? raw.df : 0,
                    ts: raw.ts || Date.now()
                };

                const lpiValues = this.linspace(settings.lpi[0], settings.lpi[1], settings.lpi[2]);
                const freqValues = this.linspace(settings.freq[0], settings.freq[1], settings.freq[2]);

                return {
                    found: true,
                    data: settings,
                    defocus: settings.defocus,
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

        // Flexible (any-axis) grid takes precedence for all laser types.
        if (s.gridMode === 'flexible') {
            return this.generateFlexibleGrid(canvasId, now);
        }

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

        const workspaceSize = this.getWorkspaceSize();
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
        const fillArea = !!s.fillArea;
        const excStartCol = fillArea ? numCols + 1 : numCols - colsReserved;
        const excStartRow = fillArea ? numRows + 1 : numRows - rowsReserved;

        // QR Position:
        // User wants it "display the QR code in the same size".
        // And implied: Position it in the cleared space.
        // Anchor: Bottom-Right of the EFFECTIVE GRID.
        // X = globalOffsetX + effectiveGridW - QR_SIZE_MM
        const qrX = globalOffsetX + effectiveGridW - QR_SIZE_MM;
        const qrY = globalOffsetY + effectiveGridH - QR_SIZE_MM;

        // Generate values
        // Defocus mode: X axis = LPC (unchanged), Y axis = defocus distance (mm),
        // frequency held fixed. Only possible in .xs (per-layer focus). Standard
        // mode: X = LPC, Y = frequency.
        const isDefocusGrid = s.gridMode === 'defocus';
        const fixedFreq = Math.round(typeof s.freq === 'number' ? s.freq : s.freqMin);
        // LPC (X axis) direction: default descending (left = high energy). An
        // optional s.lpiAscending flag (set by the custom-grid invert button)
        // flips it without affecting server-generated grids.
        const lpiValues = s.lpiAscending
            ? this.linspace(s.lpiMin, s.lpiMax, numCols)
            : this.linspace(s.lpiMax, s.lpiMin, numCols);
        const freqValues = isDefocusGrid
            ? new Array(numRows).fill(fixedFreq)
            : (s.freqDescending
                ? this.linspace(s.freqMax, s.freqMin, numRows)
                : this.linspace(s.freqMin, s.freqMax, numRows));
        const defocusValues = isDefocusGrid
            ? this.linspaceF(
                typeof s.defocusMin === 'number' ? s.defocusMin : 0,
                typeof s.defocusMax === 'number' ? s.defocusMax : 6,
                numRows
            )
            : null;

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
                const cellDefocus = isDefocusGrid ? defocusValues[row] : undefined;

                // Generate color based on position
                const hue = (col / numCols) * 0.7;
                const lightness = 0.3 + (row / numRows) * 0.4;
                const rgb = this.hslToRgb(hue, 0.8, lightness);

                const colorHex = this.colorToHex(rgb.r, rgb.g, rgb.b);
                const colorInt = this.colorToInt(rgb.r, rgb.g, rgb.b);

                // Create cell path
                const path = `M0 0 L${s.cellSize} 0 L${s.cellSize} ${s.cellSize} L0 ${s.cellSize} Z`;

                const cellLabel = isDefocusGrid
                    ? `D${cellDefocus}mm / L${lpi}`
                    : `F${frequency}kHz / L${lpi}`;

                const display = this.createPathDisplay(
                    displayId,
                    cellLabel,
                    colorHex, colorInt,
                    x, y, s.cellSize, s.cellSize,
                    zOrder, path,
                    false
                );

                const extraCellParams = isDefocusGrid ? { _defocus: cellDefocus } : {};

                displays.push(display);
                displaySettings.push([displayId, this.createDisplaySettings(frequency, lpi, s.power, s.speed, s.passes, extraCellParams)]);
                layerData[colorHex] = {
                    name: isDefocusGrid ? `${cellDefocus}mm/${lpi}LPC` : `${frequency}kHz/${lpi}LPC`,
                    order: zOrder, visible: true
                };

                zOrder++;
                cellCount++;
            }
        }

        // Add Real QR Code (skipped in fill-area mode)
        let qrData = null;
        if (!fillArea) {
        qrData = this.encodeSettings(numCols, numRows);
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
        displaySettings.push([qrDisplayId, this.createDisplaySettings(s.qrFrequency, s.qrLpi, s.qrPower, s.qrSpeed, 1, { _crossHatch: !!s.qrCrossHatch })]);
        layerData['#000000'] = { name: 'QR Code', order: zOrder, visible: true };
        }

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
                fillArea,
                lpiValues,
                freqValues,
                defocusValues,
                gridMode: isDefocusGrid ? 'defocus' : 'standard'
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
        const extId = laser ? laser.extId : 'GS004-CLASS-4';
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
        const workspaceSize = this.getWorkspaceSize();
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
        const fillArea = !!s.fillArea;
        const excStartCol = fillArea ? numCols + 1 : numCols - colsReserved;
        const excStartRow = fillArea ? numRows + 1 : numRows - rowsReserved;

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

        // Add QR Code (skipped in fill-area mode)
        let qrData = null;
        if (!fillArea) {
        qrData = this.encodeSettings(numCols, numRows);
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

        displaySettings.push([qrDisplayId, this.createDisplaySettings(qrFreq, qrL, qrPwr, qrSpd, 1, { processingLightSource: 'red', mopaFrequency: qrFreq, pulseWidth: s.pulseWidth || 80, _crossHatch: !!s.qrCrossHatch })]);
        layerData['#000000'] = { name: 'QR Code', order: zOrder, visible: true };
        }

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
                fillArea,

                // MOPA Specific Metadata (reusing lpi/freq names for Analyzer compatibility)
                lpiValues: xValues,
                freqValues: yValues,
                xAxisLabel: mode === 'speed' ? 'Power (%)' : 'Speed (mm/s)',
                yAxisLabel: mode === 'frequency' ? 'Power (%)' : 'Frequency (kHz)',
                gridMode: mode
            }
        };
    }

    // ── Flexible (any-axis) grid ───────────────────────────────────────────────
    // Maps each user-facing variable to the underlying createDisplaySettings knob.
    getFlexParamMeta() {
        return {
            frequency:  { label: 'Frequency',   unit: 'kHz',      knob: 'frequency',  float: false },
            power:      { label: 'Power',        unit: '%',        knob: 'power',      float: false },
            speed:      { label: 'Speed',        unit: 'mm/s',     knob: 'speed',      float: false },
            lpc:        { label: 'LPC',          unit: 'lines/cm', knob: 'lpc',        float: false },
            defocus:    { label: 'Defocus',      unit: 'mm',       knob: 'defocus',    float: true,  requiresXs: true },
            pulseWidth: { label: 'Pulse Width',  unit: 'ns',       knob: 'pulseWidth', float: false, mopaOnly: true },
        };
    }

    // Resolve the flexible-grid configuration (axes, ranges, constants) from
    // settings, applying sensible per-laser defaults. Shared by the generator
    // and the QR encoder so both agree on axis endpoints.
    resolveFlexConfig() {
        const s = this.settings;
        const deviceId = resolveDeviceId(s.activeDevice || 'f2_ultra_uv');
        const laserTypeId = s.activeLaserType || null;
        const laser = getLaserConfig(deviceId, laserTypeId);
        const isMopaLike = laser ? (laser.hasPulseWidth && laser.hasMopaFrequency) : false;
        const meta = this.getFlexParamMeta();

        const flex = s.flex || {};
        const pick = (v, fb) => (typeof v === 'number' && !isNaN(v)) ? v : fb;

        const constants = {
            frequency:  pick(flex.constants?.frequency,  pick(s.freq, isMopaLike ? 200 : 80)),
            power:      pick(flex.constants?.power,      pick(s.power, isMopaLike ? 14 : 70)),
            speed:      pick(flex.constants?.speed,      pick(s.speed, isMopaLike ? 400 : 425)),
            lpc:        pick(flex.constants?.lpc,        pick(s.lpi, isMopaLike ? 5000 : 1000)),
            defocus:    pick(flex.constants?.defocus,    pick(s.defocus, getDefaultDefocus(deviceId, laserTypeId))),
            pulseWidth: pick(flex.constants?.pulseWidth, pick(s.pulseWidth, 80)),
        };

        const defRange = {
            frequency:  [isMopaLike ? 200 : 40, isMopaLike ? 1200 : 90],
            power:      [10, 80],
            speed:      [200, 1500],
            lpc:        [500, 2000],
            defocus:    [1, 12],
            pulseWidth: [2, 350],
        };

        let xParam = flex.xParam || 'speed';
        let yParam = flex.yParam || (xParam === 'power' ? 'frequency' : 'power');
        // Guard: axes must differ and must be valid for this laser
        if (!meta[xParam]) xParam = 'speed';
        if (!meta[yParam] || yParam === xParam) yParam = xParam === 'power' ? 'frequency' : 'power';

        const getRange = (p) => {
            const r = (flex.ranges && flex.ranges[p]) || {};
            const d = defRange[p] || [0, 1];
            return { min: pick(r.min, d[0]), max: pick(r.max, d[1]) };
        };

        return {
            isMopaLike, laser, deviceId, laserTypeId, meta,
            xParam, yParam,
            xRange: getRange(xParam),
            yRange: getRange(yParam),
            constants,
            requiresXs: !!(meta[xParam]?.requiresXs || meta[yParam]?.requiresXs),
        };
    }

    // Build a flexible test grid: any two variables on X/Y, the rest constant.
    // Works for every laser type (UV/IR/Blue and MOPA-like).
    generateFlexibleGrid(canvasId, now) {
        const s = this.settings;
        const cfg = this.resolveFlexConfig();
        const { isMopaLike, laser, meta, xParam, yParam, xRange, yRange, constants } = cfg;

        const QR_SIZE_MM = 17;
        const QR_GAP_MM = 1;

        const availableWidth = s.cardWidth - (s.margin * 2);
        const availableHeight = s.cardHeight - (s.margin * 2);
        const totalCellSize = s.cellSize + s.cellGap;

        let numCols = Math.floor((availableWidth + s.cellGap) / totalCellSize);
        let numRows = Math.floor((availableHeight + s.cellGap) / totalCellSize);
        if (numCols < 1) numCols = 1;
        if (numRows < 1) numRows = 1;

        // Axis values (defocus uses fractional spacing)
        const axisVals = (param, range, steps) => meta[param].float
            ? this.linspaceF(range.min, range.max, steps)
            : this.linspace(range.min, range.max, steps);
        const xValues = axisVals(xParam, xRange, numCols);
        const yValues = axisVals(yParam, yRange, numRows);

        // Layout / centering (same approach as the other grids)
        const effectiveGridW = numCols * s.cellSize + (numCols - 1) * s.cellGap;
        const effectiveGridH = numRows * s.cellSize + (numRows - 1) * s.cellGap;

        const workspaceSize = this.getWorkspaceSize();
        const cardOffsetX = (workspaceSize - s.cardWidth) / 2;
        const cardOffsetY = (workspaceSize - s.cardHeight) / 2;
        const contentOffsetX = s.margin + (availableWidth - effectiveGridW) / 2;
        const contentOffsetY = s.margin + (availableHeight - effectiveGridH) / 2;
        const globalOffsetX = cardOffsetX + contentOffsetX;
        const globalOffsetY = cardOffsetY + contentOffsetY;

        const colPitch = s.cellSize + s.cellGap;
        const rowPitch = s.cellSize + s.cellGap;
        const colsReserved = Math.ceil((QR_SIZE_MM + QR_GAP_MM) / colPitch);
        const rowsReserved = Math.ceil((QR_SIZE_MM + QR_GAP_MM) / rowPitch);
        const fillArea = !!s.fillArea;
        const excStartCol = fillArea ? numCols + 1 : numCols - colsReserved;
        const excStartRow = fillArea ? numRows + 1 : numRows - rowsReserved;

        const qrX = globalOffsetX + effectiveGridW - QR_SIZE_MM;
        const qrY = globalOffsetY + effectiveGridH - QR_SIZE_MM;

        const displays = [];
        const displaySettings = [];
        const layerData = {};
        let zOrder = 1;
        let cellCount = 0;

        const abbr = (p) => meta[p].label.charAt(0);

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                if (col >= excStartCol && row >= excStartRow) continue;

                // Per-cell knob values: constants overridden by the two axes
                const knobs = { ...constants };
                knobs[xParam] = xValues[col];
                knobs[yParam] = yValues[row];

                const x = globalOffsetX + col * colPitch;
                const y = globalOffsetY + row * rowPitch;

                const hue = (col / numCols) * 0.7;
                const lightness = 0.3 + (row / numRows) * 0.4;
                const rgb = this.hslToRgb(hue, 0.8, lightness);
                const colorHex = this.colorToHex(rgb.r, rgb.g, rgb.b);
                const colorInt = this.colorToInt(rgb.r, rgb.g, rgb.b);

                const path = `M${x} ${y} L${x + s.cellSize} ${y} L${x + s.cellSize} ${y + s.cellSize} L${x} ${y + s.cellSize} Z`;
                const id = this.generateUUID();
                const displayName = `${abbr(xParam)}${xValues[col]} ${abbr(yParam)}${yValues[row]}`;

                const display = this.createPathDisplay(id, displayName, colorHex, colorInt, x, y, s.cellSize, s.cellSize, zOrder, path);
                displays.push(display);

                const extraParams = { _defocus: knobs.defocus };
                if (isMopaLike) {
                    extraParams.mopaFrequency = knobs.frequency;
                    extraParams.pulseWidth = knobs.pulseWidth;
                    extraParams.processingLightSource = laser ? laser.lightSource : 'red';
                    extraParams._planType = laser ? laser.planType : 'red';
                }

                displaySettings.push([id, this.createDisplaySettings(
                    knobs.frequency, knobs.lpc, knobs.power, knobs.speed, s.passes || 1, extraParams
                )]);
                layerData[colorHex] = { name: displayName, order: zOrder++, visible: true };
                cellCount++;
            }
        }

        // QR Code (skipped in fill-area mode)
        let qrData = null;
        if (!fillArea) {
        qrData = this.encodeSettings(numCols, numRows);
        const qrPath = this.generateQRPath(qrData, 0, 0, QR_SIZE_MM);
        const qrDisplayId = this.generateUUID();
        const qrDisplay = this.createPathDisplay(qrDisplayId, 'Settings QR Code', '#000000', 0, qrX, qrY, QR_SIZE_MM, QR_SIZE_MM, zOrder, qrPath, true);
        displays.push(qrDisplay);
        const qrExtra = { _crossHatch: !!s.qrCrossHatch };
        if (isMopaLike) {
            qrExtra.mopaFrequency = s.qrFrequency || 90;
            qrExtra.pulseWidth = s.pulseWidth || 80;
            qrExtra.processingLightSource = laser ? laser.lightSource : 'red';
            qrExtra._planType = laser ? laser.planType : 'red';
        }
        displaySettings.push([qrDisplayId, this.createDisplaySettings(s.qrFrequency || 90, s.qrLpi || 2500, s.qrPower || 17.5, s.qrSpeed || 150, 1, qrExtra)]);
        layerData['#000000'] = { name: 'QR Code', order: zOrder, visible: true };
        }

        // Self-labeled grid (Idea 2): engrave axis tick values along the left
        // (Y values) and bottom (X values) edges. Opt-in via settings.showAxisLabels.
        if (s.showAxisLabels) {
            const px = 0.3; // mm per pixel
            const labelH = 5 * px;
            const fmt = (p, v) => meta[p].float ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v));

            const labelExtra = { _crossHatch: false };
            if (isMopaLike) {
                labelExtra.mopaFrequency = s.qrFrequency || 90;
                labelExtra.pulseWidth = s.pulseWidth || 80;
                labelExtra.processingLightSource = laser ? laser.lightSource : 'red';
                labelExtra._planType = laser ? laser.planType : 'red';
            }
            const labelSettings = () => this.createDisplaySettings(
                s.qrFrequency || 90, s.qrLpi || 2500, s.qrPower || 17.5, s.qrSpeed || 150, 1, { ...labelExtra }
            );
            const pushLabel = (text, lx, ly) => {
                const { dPath, width, height } = this.renderPixelText(text, lx, ly, px);
                if (!dPath) return;
                const lid = this.generateUUID();
                displays.push(this.createPathDisplay(lid, `Label ${text}`, '#000000', 0, lx, ly, width, height, ++zOrder, dPath, true));
                displaySettings.push([lid, labelSettings()]);
            };

            // X tick values centered below each column
            const xLabelY = globalOffsetY + effectiveGridH + 0.6;
            for (let col = 0; col < numCols; col++) {
                const text = fmt(xParam, xValues[col]);
                const w = Math.max(0, text.length * 4 * px - px);
                const cx = globalOffsetX + col * colPitch + s.cellSize / 2 - w / 2;
                pushLabel(text, cx, xLabelY);
            }
            // Y tick values right-aligned to the left of each row
            for (let row = 0; row < numRows; row++) {
                const text = fmt(yParam, yValues[row]);
                const w = Math.max(0, text.length * 4 * px - px);
                const lx = globalOffsetX - 0.6 - w;
                const ly = globalOffsetY + row * rowPitch + s.cellSize / 2 - labelH / 2;
                pushLabel(text, lx, ly);
            }
        }

        const extId = laser ? laser.extId : 'GS009-CLASS-4';
        const extName = laser ? laser.extName : 'F2 Ultra UV';
        const lightSource = laser ? laser.lightSource : 'uv';

        const xcs = {
            canvasId,
            canvas: [{
                id: canvasId,
                title: `Flex ${meta[xParam].label}×${meta[yParam].label}`,
                layerData,
                groupData: {},
                displays
            }],
            extId, extName,
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
                        data: { LASER_PLANE: { material: getXtoolMaterialId(this.settings.material || DEFAULT_MATERIAL_ID), lightSourceMode: lightSource, thickness: isMopaLike ? 0 : 117, isProcessByLayer: false, pathPlanning: 'auto', fillPlanning: 'separate' } },
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
                numCols, numRows,
                totalCells: cellCount,
                qrData,
                qrSize: QR_SIZE_MM,
                qrX, qrY,
                gapX: s.cellGap,
                gapY: s.cellGap,
                effectiveGridW,
                effectiveGridH,
                globalOffsetX,
                globalOffsetY,
                excStartCol,
                excStartRow,
                fillArea,
                lpiValues: xValues,
                freqValues: yValues,
                xAxisLabel: `${meta[xParam].label} (${meta[xParam].unit})`,
                yAxisLabel: `${meta[yParam].label} (${meta[yParam].unit})`,
                gridMode: 'flexible',
                xParam, yParam
            }
        };
    }

    /**
     * Generate the test grid as an .xs (v2) bundle instead of .xcs.
     * Internally builds the XCS form first and converts it.
     * Returns { xs: Blob|Buffer, gridInfo, qrData }.
     */
    async generateBusinessCardGridXS() {
        const result = this.generateBusinessCardGrid();
        const xs = await xcsJsonToXsZip(JSON.parse(result.xcs), this.settings);
        return { xs, gridInfo: result.gridInfo, qrData: result.gridInfo.qrData };
    }

}

// ── XCS (v1) → XS (v2) directory ZIP converter ─────────────────────────────────
// Used to re-emit test-grid output in the new format. Keeps every display's
// engraving parameters intact and externalizes its dPath into the v2 vector
// bucket.

async function sha256Hex(str) {
    if (typeof globalThis !== 'undefined'
        && globalThis.crypto
        && globalThis.crypto.subtle
        && typeof TextEncoder !== 'undefined') {
        const buf = new TextEncoder().encode(str);
        const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
        const bytes = new Uint8Array(digest);
        let out = '';
        for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
        return out;
    }
    const mod = await import('node:crypto');
    return mod.createHash('sha256').update(str, 'utf-8').digest('hex');
}

function uuid4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const NANOID_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function nanoid12() {
    let s = '';
    for (let i = 0; i < 12; i++) s += NANOID_ALPHA[Math.floor(Math.random() * NANOID_ALPHA.length)];
    return s;
}

export async function xcsJsonToXsZip(xcsObj, settings = {}) {
    const now = Date.now();
    const canvas = xcsObj.canvas[0];
    const canvasId = xcsObj.canvasId || canvas.id;
    let extId = xcsObj.extId || 'GS009-CLASS-4';
    let extName = xcsObj.extName || 'F2 Ultra UV';

    // v1 (.xcs) → v2 (.xs) device id remap. Studio's v2 only accepts a fixed
    // set of extIds; the legacy MOPA id 'GS009-CLASS-1' loads as F2 Ultra UV
    // in .xs because v2 doesn't know it. Translate to the correct dual-head
    // device id.
    if (extId === 'GS009-CLASS-1') {
        extId = 'GS004-CLASS-4';
        extName = 'F2 Ultra';
    }

    // Extract per-display settings from the v1 device map
    const displayCustomize = new Map();
    let lightSourceMode = 'uv';
    let material = null;
    try {
        const canvasEntry = xcsObj.device.data.value[0][1];
        lightSourceMode = canvasEntry.data.LASER_PLANE.lightSourceMode || lightSourceMode;
        material = canvasEntry.data.LASER_PLANE.material;
        for (const [displayId, info] of canvasEntry.displays.value) {
            const processingType = info.processingType || 'FILL_VECTOR_ENGRAVING';
            const block = info.data[processingType] || info.data.FILL_VECTOR_ENGRAVING;
            const customize = block ? block.parameter.customize : {};
            displayCustomize.set(displayId, { processingType, customize, info });
        }
    } catch { /* tolerate missing device map */ }

    // Build profiles + display vectorRefs
    const profiles = {};
    const displayProfileMap = {};
    const vectorBucket = new Map();
    const displays = [];

    // Studio only externalizes large dPaths; small ones stay inline.
    // Threshold chosen to roughly match observed Studio behavior.
    const VECTOR_BUCKET_THRESHOLD = 1024;
    for (const d of canvas.displays) {
        const out = { ...d };
        if (out.dPath && out.dPath.length >= VECTOR_BUCKET_THRESHOLD) {
            const hash = await sha256Hex(out.dPath);
            if (!vectorBucket.has(hash)) vectorBucket.set(hash, out.dPath);
            out.vectorRef = { vectorHash: hash, bucketType: 'svg', originalField: 'dPath' };
            delete out.dPath;
        }

        const settingsForDisplay = displayCustomize.get(d.id);

        // v2 union fields observed in real Studio-saved files
        if (out.groupTags === undefined) out.groupTags = [];
        if (out.alpha === undefined) out.alpha = 1;
        if (out.effects === undefined) out.effects = [];
        if (out.customData === undefined || Object.keys(out.customData).length === 0) {
            out.customData = { tabBreaks: {}, startPoint: {} };
        }

        // v2 (.xs) only uses FILL_VECTOR_ENGRAVING — the v1 'COLOR_FILL_ENGRAVE'
        // processingType is not recognized by Studio's v2 reader and causes
        // displays to render as outlines without any fill. Force it here for
        // both the display and the profile we emit.
        if (out.processingType && out.processingType !== 'FILL_VECTOR_ENGRAVING') {
            out.processingType = 'FILL_VECTOR_ENGRAVING';
        }

        displays.push(out);

        if (settingsForDisplay) {
            const processingType = 'FILL_VECTOR_ENGRAVING';
            const cust = { ...settingsForDisplay.customize };

            // v2 expects a richer customize/values block. Normalize the test-grid
            // shape (which targets v1 .xcs) to match the engraving XSGenerator output
            // so xTool Studio treats these displays as solid fills with full settings.
            //
            // Normalizations:
            //   - bitmapScanMode: v1 'zMode' → v2 'lineMode'
            //   - density / dpi: ensure both are set (test-grid only sets density)
            //   - processingType: required inside values for v2
            //   - default flags that xTool reads for engraving behavior
            if (cust.bitmapScanMode === 'zMode') cust.bitmapScanMode = 'lineMode';
            if (cust.density != null && cust.dpi == null) cust.dpi = cust.density;
            if (cust.dpi != null && cust.density == null) cust.density = cust.dpi;
            if (cust.crossAngle == null) cust.crossAngle = cust.bitmapScanMode === 'crossMode';
            if (cust.scanAngle == null) cust.scanAngle = 0;
            if (cust.angleType == null) cust.angleType = 2;
            if (cust.bitmapEngraveMode == null) cust.bitmapEngraveMode = 'normal';
            if (cust.processingLightSource == null) {
                cust.processingLightSource = lightSourceMode === 'uv' ? 'red' : lightSourceMode;
            }
            if (cust.defocus == null) { cust.defocus = false; cust.defocus_distance = 1; }

            // F2 family (GS006) uses dwellTime fields; F2 Ultra uses delayPerLine.
            const isF2Family = extId === 'GS006';
            const delayFields = isF2Family
                ? { enableDwellTime: false, dwellTime: 0.3 }
                : { enableDelayPerLine: false, delayPerLine: 0.3 };

            const enrichedValues = {
                dotDuration: 100,
                ...delayFields,
                outlineTrace: false,
                needGapNumDensity: true,
                enableKerf: false,
                kerfDistance: 0,
                ...cust,
                processingType,
            };

            const profileId = `profile:${nanoid12()}`;
            profiles[profileId] = {
                id: profileId,
                processingType,
                values: enrichedValues,
            };
            displayProfileMap[d.id] = profileId;
        }
    }

    const files = {};
    files['.format'] = 'v2';
    files['meta/persistence-meta.json'] = { schemaVersion: '2.0.0', protocol: 'xcs-workspace-v2' };

    const projectId = uuid4();
    const deviceInstanceId = `${extId}-1`;

    files['project.json'] = {
        __v2__: true,
        version: '2.0.0',
        schemaMeta: {
            schemaVersion: '2',
            format: 'directory',
            migratedFrom: 'v1',
            migratedAt: now,
        },
        projectId,
        projectTraceID: projectId,
        projectName: canvas.title || 'Test Grid',
        activeCanvasId: canvasId,
        activeDeviceId: deviceInstanceId,
        versionInfo: {
            source: 'picture-engraver',
            appVersion: '2.0.0',
            savedAt: now,
            ua: typeof navigator !== 'undefined' ? (navigator.userAgent || '') : 'node',
            minRequiredVersion: '2.6.0',
            appMinRequiredVersion: '',
            webMinRequiredVersion: '',
        },
        created: xcsObj.created || now,
        modify: xcsObj.modify || now,
        modules: { canvases: [canvasId], devices: [deviceInstanceId] },
        customProjectData: { projectTraceID: projectId },
    };
    files['profiles.json'] = { profiles };
    files[`canvases/${canvasId}.json`] = {
        id: canvasId,
        title: canvas.title || 'Test Grid',
        hidden: false,
        layerData: canvas.layerData || {},
        groupData: canvas.groupData || {},
        extendInfo: {
            version: '2.0.0',
            minCanvasVersion: '0.0.0',
            displayProcessConfigMap: {},
            rulerPluginData: { rulerGuide: [] },
            type: '2d',
        },
        chunkLayout: {
            displayCount: displays.length,
            chunkCount: displays.length > 0 ? 1 : 0,
            chunkIndexes: displays.length > 0 ? [0] : [],
        },
    };
    files[`canvases/${canvasId}/displays-0.json`] = {
        canvasId,
        chunkIndex: 0,
        displays,
    };

    // Device file — real Studio v2 layout uses profileRefs + bindings + patches.
    // Bindings are consolidated by profile id (displays sharing the same profile
    // share one binding with displayIds[]).
    const profileRefs = [];
    const patches = {};
    const bindingByProfile = new Map();
    for (const d of displays) {
        const pid = displayProfileMap[d.id];
        if (!pid) continue;
        if (!profileRefs.includes(pid)) profileRefs.push(pid);
        const baseValues = profiles[pid].values;
        const overrides = { ...baseValues };
        delete overrides.dotDuration;
        delete overrides.enableDelayPerLine;
        delete overrides.delayPerLine;
        delete overrides.enableDwellTime;
        delete overrides.dwellTime;
        delete overrides.outlineTrace;
        delete overrides.needGapNumDensity;
        delete overrides.enableKerf;
        delete overrides.kerfDistance;
        const patchId = `patch:${nanoid12()}`;
        patches[patchId] = {
            id: patchId,
            profileId: pid,
            source: 'custom',
            overrides,
        };
        let binding = bindingByProfile.get(pid);
        if (!binding) {
            binding = {
                bindingId: `binding:${nanoid12()}`,
                baseProfileId: pid,
                patchIds: [],
                displayIds: [],
                canvasId,
                mode: 'LASER_PLANE',
            };
            bindingByProfile.set(pid, binding);
        }
        binding.patchIds.push(patchId);
        binding.displayIds.push(d.id);
    }
    const bindings = [...bindingByProfile.values()];

    files[`devices/device-${deviceInstanceId}.json`] = {
        id: deviceInstanceId,
        deviceCode: extId,
        extId,
        extName,
        power: xcsObj.device?.power || [20],
        processing: {
            [canvasId]: {
                id: canvasId,
                activeMode: 'LASER_PLANE',
                modes: {
                    LASER_PLANE: {
                        ignoredDisplayIds: [],
                        data: {
                            material,
                            lightSourceMode,
                            thickness: 0,
                            isProcessByLayer: false,
                            pathPlanning: 'auto',
                            fillPlanning: 'separate',
                        },
                        profileRefs,
                        patches,
                        bindings,
                    },
                },
            },
        },
        customProjectData: { tangentialCuttingUuids: [], flyCutUuid2CanvasIds: {} },
    };

    const bucketEntries = {};
    const indexEntries = {};
    for (const [hash, value] of vectorBucket.entries()) {
        bucketEntries[hash] = value;
        indexEntries[hash] = { hash, size: value.length };
    }
    files['vectors/svg/index.json'] = {
        bucketType: 'svg',
        version: '1.0',
        entryCount: vectorBucket.size,
        entries: indexEntries,
    };
    files['vectors/svg/data-0.json'] = {
        bucketType: 'svg',
        chunkIndex: 0,
        entries: bucketEntries,
    };

    const zip = new JSZip();
    for (const [path, content] of Object.entries(files)) {
        if (typeof content === 'string') zip.file(path, content);
        else zip.file(path, JSON.stringify(content));
    }
    const isBrowser = typeof window !== 'undefined' && typeof Blob !== 'undefined';
    return zip.generateAsync({
        type: isBrowser ? 'blob' : 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
        mimeType: 'application/zip',
    });
}
