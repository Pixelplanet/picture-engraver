/**
 * XCS Generator Module
 * Generates XCS files for xTool laser engravers
 */

export class XCSGenerator {
    constructor(settings) {
        this.settings = settings;
        this.pxPerMm = 10; // Pixels per mm for conversion
    }

    /**
     * Generate a UUID v4
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Convert RGB to hex color integer
     */
    colorToInt(r, g, b) {
        return (r << 16) + (g << 8) + b;
    }

    /**
     * Convert RGB to hex string
     */
    colorToHex(r, g, b) {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate XCS file from processed image and layers
     */
    generate(imageData, layers, size) {
        const canvasId = this.generateUUID();
        const now = Date.now();

        // Calculate centering offsets for 200x200mm workspace
        const contentWidth = imageData.width / this.pxPerMm;
        const contentHeight = imageData.height / this.pxPerMm;

        const workspaceWidth = size.width || 200;
        const workspaceHeight = size.height || 200;

        const offsetX = (workspaceWidth - contentWidth) / 2;
        const offsetY = (workspaceHeight - contentHeight) / 2;

        // Generate displays (path elements) for each layer
        const displays = [];
        const displaySettings = [];

        layers.forEach((layer, layerIndex) => {
            if (!layer.visible) return;

            const colorHex = this.colorToHex(layer.color.r, layer.color.g, layer.color.b);
            const colorInt = this.colorToInt(layer.color.r, layer.color.g, layer.color.b);

            // Combine all paths for this layer into a single display
            if (layer.paths && layer.paths.length > 0) {
                // Join all paths with a space
                const combinedPath = layer.paths.filter(p => p && p.length > 0).join(' ');

                if (combinedPath.length > 0) {
                    const displayId = this.generateUUID();
                    const display = this.createPathDisplayWithPath(
                        displayId,
                        layer.name,
                        colorHex,
                        colorInt,
                        offsetX, offsetY,  // Use calculated offsets for centering
                        contentWidth,      // Use actual content dimensions
                        contentHeight,
                        layerIndex + 1,
                        combinedPath
                    );

                    displays.push(display);
                    displaySettings.push({
                        id: displayId,
                        settings: this.createDisplaySettings(layer)
                    });
                }
            } else {
                // Fallback: create a simple rectangle
                const displayId = this.generateUUID();
                const display = this.createPathDisplay(
                    displayId,
                    `Layer ${layerIndex + 1}`,
                    colorHex,
                    colorInt,
                    0, 0,
                    size.width,
                    size.height,
                    layerIndex + 1
                );

                displays.push(display);
                displaySettings.push({
                    id: displayId,
                    settings: this.createDisplaySettings(layer)
                });
            }
        });

        // Build complete XCS structure
        const xcs = {
            canvasId: canvasId,
            canvas: [{
                id: canvasId,
                title: 'Generated Image',
                layerData: this.generateLayerData(layers),
                groupData: {},
                displays: displays
            }],
            extId: 'GS009-CLASS-4',
            extName: 'F2 Ultra UV',
            version: '1.3.6',
            created: now,
            modify: now,
            device: this.generateDeviceData(canvasId, displaySettings)
        };

        return JSON.stringify(xcs);
    }

    /**
     * Create a PATH display object with custom path data
     */
    createPathDisplayWithPath(id, name, colorHex, colorInt, x, y, width, height, zOrder, dPath) {
        const display = this.createPathDisplay(id, name, colorHex, colorInt, x, y, width, height, zOrder);
        display.dPath = dPath;
        display.isCompoundPath = true; // Vector output is almost always a compound path
        return display;
    }

    /**
     * Generate layer data from layers
     */
    generateLayerData(layers) {
        const layerData = {};

        layers.forEach((layer, index) => {
            const colorHex = this.colorToHex(layer.color.r, layer.color.g, layer.color.b);
            layerData[colorHex] = {
                name: layer.name,
                order: index + 1,
                visible: true
            };
        });

        return layerData;
    }

    /**
     * Create a PATH display object
     */
    createPathDisplay(id, name, colorHex, colorInt, x, y, width, height, zOrder) {
        return {
            id: id,
            name: name,
            type: 'PATH',
            x: x,
            y: y,
            angle: 0,
            scale: { x: 1, y: 1 },
            skew: { x: 0, y: 0 },
            pivot: { x: 0, y: 0 },
            localSkew: { x: 0, y: 0 },
            offsetX: x,
            offsetY: y,
            lockRatio: false,
            isClosePath: true,
            zOrder: zOrder,
            sourceId: '',
            groupTag: '',
            layerTag: colorHex,
            layerColor: colorHex,
            visible: true,
            originColor: colorHex,
            enableTransform: true,
            visibleState: true,
            lockState: false,
            resourceOrigin: '',
            customData: {},
            rootComponentId: '',
            minCanvasVersion: '0.0.0',
            fill: {
                paintType: 'color',
                visible: true,
                color: colorInt,
                alpha: 1
            },
            stroke: {
                paintType: 'color',
                visible: false,  // Disable stroke for filled engraving
                color: colorInt,
                alpha: 1,
                width: 0,
                cap: 'butt',
                join: 'miter',
                miterLimit: 4,
                alignment: 0.5
            },
            width: width,
            height: height,
            points: [],
            dPath: `M0 0 L${width} 0 L${width} ${height} L0 ${height} Z`,
            fillRule: 'evenodd',
            graphicX: x,
            graphicY: y,
            isCompoundPath: false,
            isFill: true,
            lineColor: colorInt,
            fillColor: colorHex
        };
    }

    /**
     * Create display settings for a layer
     */
    createDisplaySettings(layer) {
        const freq = Math.round(layer.frequency);
        const lpi = Math.round(layer.lpi);

        return {
            isFill: true,
            type: 'PATH',
            processingType: 'FILL_VECTOR_ENGRAVING',
            data: {
                VECTOR_CUTTING: this.createCuttingParams(),
                VECTOR_ENGRAVING: this.createEngravingParams(),
                FILL_VECTOR_ENGRAVING: this.createFillEngravingParams(freq, lpi),
                INTAGLIO: this.createIntaglioParams(),
                INNER_THREE_D: this.createInner3DParams()
            },
            processIgnore: false
        };
    }

    createCuttingParams() {
        return {
            materialType: 'customize',
            planType: 'dot_cloud',
            parameter: {
                customize: {
                    power: this.settings.power,
                    speed: this.settings.speed,
                    repeat: this.settings.passes,
                    cuttingDrop: false,
                    sinkingMethod: 'one',
                    firstCuttingDropValue: 0.01,
                    cuttingDropValue: 0.01,
                    descentIntervalDescent: 1,
                    descentPerStep: 0.01,
                    enableKerf: false,
                    kerfDistance: 0,
                    enableBreakPoint: false,
                    breakPointSize: 0.5,
                    breakPointCount: 2,
                    breakPointMode: 'count',
                    breakPointDistance: 100,
                    breakPointPower: 0,
                    frequency: 40,
                    wobbleEnable: false,
                    wobbleDiameter: 0.05,
                    wobbleSpacing: 0.015
                }
            }
        };
    }

    createEngravingParams() {
        return {
            materialType: 'customize',
            planType: 'dot_cloud',
            parameter: {
                customize: {
                    speed: this.settings.speed,
                    power: this.settings.power,
                    repeat: this.settings.passes,
                    frequency: 40,
                    enableKerf: false,
                    kerfDistance: 0
                }
            }
        };
    }

    createFillEngravingParams(frequency, lpi) {
        // Convert LPI to DPI (they're equivalent for this purpose)
        const dpi = lpi;

        return {
            materialType: 'customize',
            planType: 'dot_cloud',
            parameter: {
                customize: {
                    bitmapEngraveMode: 'normal',
                    speed: this.settings.speed,
                    density: lpi,
                    dotDuration: 150,
                    dpi: dpi,
                    power: this.settings.power,
                    repeat: this.settings.passes,
                    bitmapScanMode: this.settings.crossHatch ? 'crossMode' : 'zMode',
                    frequency: frequency,
                    scanAngle: 0,
                    angleType: 2,
                    crossAngle: this.settings.crossHatch,
                    enableDelayPerLine: false,
                    delayPerLine: 0.3,
                    outlineTrace: false,
                    needGapNumDensity: true,
                    enableKerf: false,
                    kerfDistance: 0
                }
            }
        };
    }

    createIntaglioParams() {
        return {
            materialType: 'customize',
            planType: 'dot_cloud',
            parameter: {
                customize: {
                    bitmapEngraveMode: 'normal',
                    speed: 80,
                    density: 300,
                    power: 1,
                    repeat: 1,
                    bitmapScanMode: 'zMode',
                    sliceNumber: 100,
                    processAngle: 15,
                    zAxisMove: false,
                    zLayers: 1,
                    zDecline: 0.01,
                    frequency: 40
                }
            }
        };
    }

    createInner3DParams() {
        return {
            materialType: 'customize',
            planType: 'dot_cloud',
            parameter: {
                customize: {
                    subdivide: 0.1,
                    speed: 80,
                    dotDuration: 200,
                    layer_h: 0.1,
                    power: 1,
                    repeat: 1,
                    frequency: 40,
                    refractive_index: 1.5,
                    isPrintTexture: true,
                    innerProcessMode: 'dot_cloud',
                    strengthenEnable: false,
                    strengthDirection: 0,
                    strengthenMultiple: 2,
                    isWhiteModel: true,
                    supportWhiteModel: true,
                    xySubdivideEnable: false,
                    xySubdivide: 300
                }
            }
        };
    }

    /**
     * Generate device data structure
     */
    generateDeviceData(canvasId, displaySettings) {
        const displaysMap = displaySettings.map(ds => [ds.id, ds.settings]);

        return {
            id: 'GS009-CLASS-4',
            power: [5],
            data: {
                dataType: 'Map',
                value: [[canvasId, {
                    mode: 'LASER_PLANE',
                    data: {
                        LASER_PLANE: {
                            material: 0,
                            lightSourceMode: 'uv',
                            thickness: 117,
                            isProcessByLayer: false,
                            pathPlanning: 'auto',
                            fillPlanning: 'separate',
                            dreedyTsp: false,
                            avoidSmokeModal: false,
                            scanDirection: 'topToBottom',
                            enableOddEvenKerf: true,
                            xcsUsed: []
                        }
                    },
                    displays: {
                        dataType: 'Map',
                        value: displaysMap
                    }
                }]]
            },
            materialList: [],
            materialTypeList: [],
            customProjectData: {
                tangentialCuttingUuids: [],
                flyCutUuid2CanvasIds: {}
            }
        };
    }

    /**
     * Generate test grid XCS file
     */
    generateTestGrid(cols, rows, cellSize, gap) {
        const canvasId = this.generateUUID();
        const now = Date.now();

        const displays = [];
        const displaySettings = [];
        const layerData = {};

        // Calculate frequency and LPI steps
        const freqStep = (this.settings.freqMax - this.settings.freqMin) / (cols - 1);
        const lpiStep = (this.settings.lpiMax - this.settings.lpiMin) / (rows - 1);

        let zOrder = 1;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const displayId = this.generateUUID();

                // Calculate position
                const x = col * (cellSize + gap);
                const y = row * (cellSize + gap);

                // Calculate settings for this cell
                const frequency = Math.round(this.settings.freqMin + col * freqStep);
                const lpi = Math.round(this.settings.lpiMax - row * lpiStep);

                // Generate a color based on position (for visual reference)
                const hue = (col / cols) * 360;
                const lightness = 30 + (row / rows) * 40;
                const rgb = this.hslToRgb(hue / 360, 0.7, lightness / 100);
                const colorHex = this.colorToHex(rgb.r, rgb.g, rgb.b);
                const colorInt = this.colorToInt(rgb.r, rgb.g, rgb.b);

                // Add layer data
                if (!layerData[colorHex]) {
                    layerData[colorHex] = {
                        name: `${frequency}kHz/${lpi}LPI`,
                        order: zOrder,
                        visible: true
                    };
                }

                // Create display for this cell
                const display = this.createPathDisplay(
                    displayId,
                    `Cell ${col + 1}x${row + 1} (${frequency}kHz/${lpi}LPI)`,
                    colorHex,
                    colorInt,
                    x, y,
                    cellSize, cellSize,
                    zOrder
                );

                displays.push(display);
                displaySettings.push({
                    id: displayId,
                    settings: {
                        isFill: true,
                        type: 'PATH',
                        processingType: 'FILL_VECTOR_ENGRAVING',
                        data: {
                            VECTOR_CUTTING: this.createCuttingParams(),
                            VECTOR_ENGRAVING: this.createEngravingParams(),
                            FILL_VECTOR_ENGRAVING: this.createFillEngravingParams(frequency, lpi),
                            INTAGLIO: this.createIntaglioParams(),
                            INNER_THREE_D: this.createInner3DParams()
                        },
                        processIgnore: false
                    }
                });

                zOrder++;
            }
        }

        // Build XCS structure
        const xcs = {
            canvasId: canvasId,
            canvas: [{
                id: canvasId,
                title: `Test Grid ${cols}x${rows}`,
                layerData: layerData,
                groupData: {},
                displays: displays
            }],
            extId: 'GS009-CLASS-4',
            extName: 'F2 Ultra UV',
            version: '1.3.6',
            created: now,
            modify: now,
            device: this.generateDeviceData(canvasId, displaySettings)
        };

        return JSON.stringify(xcs);
    }

    /**
     * Convert HSL to RGB
     */
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

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }
}
