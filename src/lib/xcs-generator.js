/**
 * XCS File Generator
 * Generates .xcs files for xTool Creative Space
 */

export class XCSGenerator {
    constructor(settings) {
        this.settings = settings || {};
        this.pxPerMm = 10; // 10 pixels per mm (constant)
    }

    /**
     * Generate UUID v4
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Generate XCS file content from vectorized layers
     * @param {ImageData} imageData - Original or processed image data
     * @param {Array} layers - Vectorized layers
     * @param {Object} size - Output size { width, height } in mm
     * @returns {string} - JSON string of the .xcs file
     */
    generate(imageData, layers, size) {
        const canvasId = this.generateUUID();
        const timestamp = Date.now();

        // Displays collection
        const displays = [];

        layers.forEach((layer, layerIndex) => {
            if (!layer.visible) return;

            // Filter valid paths and join them
            if (layer.paths && layer.paths.length > 0) {
                const combinedPath = layer.paths.filter(p => p && p.length > 0).join(' ');

                if (combinedPath.length > 0) {
                    // Create path display with auto-tightening
                    const display = this.createPathDisplayWithPath(
                        this.generateUUID(),
                        layerIndex,
                        layer.name || `Layer ${layerIndex + 1}`,
                        combinedPath,
                        layer.color
                    );

                    if (display) {
                        displays.push(display);
                    }
                }
            }
        });

        // Top-level Structure matching Documentation
        const fileContent = {
            "canvasId": canvasId,
            "canvas": [{
                "id": canvasId,
                "title": "Engraved Image",
                "layerData": this.generateLayerData(layers),
                "groupData": {},
                "displays": displays
            }],
            "extId": "GS009-CLASS-4", // F2 Ultra ID
            "extName": "F2 Ultra UV",
            "version": "1.3.6",
            "created": timestamp,
            "modify": timestamp,
            "device": this.generateDeviceData(canvasId, displays)
        };

        // Return minified JSON as per spec
        return JSON.stringify(fileContent);
    }

    generateLayerData(layers) {
        const data = {};
        layers.forEach((layer, index) => {
            const colorHex = this.rgbToHex(layer.color);
            data[colorHex] = {
                "name": layer.name || `Layer ${index + 1}`,
                "order": index + 1,
                "visible": true
            };
        });
        return data;
    }

    generateDeviceData(canvasId, displays) {
        // Build map of display settings
        const displayEntries = displays.map(display => {
            return [
                display.id,
                {
                    "isFill": true,
                    "type": "PATH",
                    "processingType": "FILL_VECTOR_ENGRAVING",
                    "data": {
                        "FILL_VECTOR_ENGRAVING": {
                            "materialType": "customize",
                            "planType": "dot_cloud",
                            "parameter": {
                                "customize": {
                                    "speed": parseInt(this.settings.speed) || 100,
                                    "power": parseInt(this.settings.power) || 10,
                                    "repeat": parseInt(this.settings.passes) || 1,
                                    "frequency": 60,
                                    "enableKerf": false,
                                    "kerfDistance": 0
                                }
                            }
                        }
                    },
                    "processIgnore": false
                }
            ];
        });

        // Build canvas settings map
        const canvasEntry = [
            canvasId,
            {
                "mode": "LASER_PLANE",
                "data": {
                    "LASER_PLANE": {
                        "material": 0,
                        "lightSourceMode": "uv",
                        "thickness": 0,
                        "isProcessByLayer": false,
                        "pathPlanning": "auto",
                        "fillPlanning": "separate",
                        "dreedyTsp": false,
                        "avoidSmokeModal": false,
                        "scanDirection": "topToBottom",
                        "enableOddEvenKerf": true,
                        "xcsUsed": []
                    }
                },
                "displays": {
                    "dataType": "Map",
                    "value": displayEntries
                }
            }
        ];

        return {
            "id": "GS009-CLASS-4",
            "power": [20],
            "data": {
                "dataType": "Map",
                "value": [canvasEntry]
            },
            "materialList": [],
            "materialTypeList": [],
            "customProjectData": {
                "tangentialCuttingUuids": [],
                "flyCutUuid2CanvasIds": {}
            }
        };
    }

    /**
     * Create a PATH display element
     */
    createPathDisplayWithPath(id, index, name, dPath, color) {
        // Tighten bounds
        const tightened = this.calculateBoundsAndTighten(dPath);

        let x = tightened.bounds ? tightened.bounds.x : 0;
        let y = tightened.bounds ? tightened.bounds.y : 0;
        let width = tightened.bounds ? tightened.bounds.width : 50;
        let height = tightened.bounds ? tightened.bounds.height : 50;

        // Safety checks
        if (!isFinite(x)) x = 0;
        if (!isFinite(y)) y = 0;
        if (!isFinite(width) || width < 0.001) width = 0.001;
        if (!isFinite(height) || height < 0.001) height = 0.001;

        const finalPath = tightened.dPath || "";
        if (finalPath.length === 0) return null;

        const colorHex = this.rgbToHex(color);
        const colorInt = parseInt(colorHex.substring(1), 16);

        return {
            "id": id,
            "name": name,
            "type": "PATH",
            "x": x,
            "y": y,
            "angle": 0,
            "scale": { "x": 1, "y": 1 },
            "skew": { "x": 0, "y": 0 },
            "pivot": { "x": 0, "y": 0 },
            "localSkew": { "x": 0, "y": 0 },
            "offsetX": x,
            "offsetY": y,
            "lockRatio": true,
            "isClosePath": true,
            "zOrder": index + 1,
            "sourceId": "",
            "groupTag": "",
            "layerTag": colorHex,
            "layerColor": colorHex,
            "visible": true,
            "originColor": colorHex,
            "enableTransform": true,
            "visibleState": true,
            "lockState": false,
            "resourceOrigin": "",
            "customData": {},
            "rootComponentId": "",
            "minCanvasVersion": "0.0.0",
            "fill": {
                "paintType": "color",
                "visible": true,
                "color": colorInt,
                "alpha": 1
            },
            "stroke": {
                "paintType": "color",
                "visible": false,
                "color": colorInt,
                "alpha": 1,
                "width": 0.05,
                "cap": "round",
                "join": "round",
                "miterLimit": 4,
                "alignment": 0.5
            },
            "width": width,
            "height": height,
            "isFill": true,
            "lineColor": colorInt,
            "fillColor": colorHex,
            "graphicX": x,
            "graphicY": y,
            "isCompoundPath": true,
            "fillRule": "nonzero",
            "points": [],
            "dPath": finalPath
        };
    }

    calculateBoundsAndTighten(dPath) {
        const tokens = dPath.match(/[a-df-z]+|[-+]?\d*\.?\d+/gi);
        if (!tokens) return { dPath, bounds: null };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let isX = true; // Track coordinate type (x or y)

        // Pass 1: Bounds
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (/[a-z]/i.test(token)) {
                continue;
            }
            const val = parseFloat(token);
            if (!isNaN(val)) {
                if (isX) {
                    if (val < minX) minX = val;
                    if (val > maxX) maxX = val;
                } else {
                    if (val < minY) minY = val;
                    if (val > maxY) maxY = val;
                }
                isX = !isX;
            }
        }

        if (minX === Infinity) return { dPath, bounds: null };

        // Pass 2: Shift and Compact Format (No extra spaces)
        let shiftedPath = "";
        isX = true; // Reset tracker
        let lastWasCommand = false;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (/[a-z]/i.test(token)) {
                // Command
                shiftedPath += (shiftedPath.length > 0 ? " " : "") + token;
                lastWasCommand = true;
                continue;
            }
            const val = parseFloat(token);
            if (!isNaN(val)) {
                const shifted = isX ? (val - minX) : (val - minY);

                // If previous was command, NO SPACE (M0.000). 
                // If previous was number, SPACE (0.000 0.000).
                const prefix = lastWasCommand ? "" : " ";
                shiftedPath += prefix + shifted.toFixed(3);

                isX = !isX;
                lastWasCommand = false;
            } else {
                shiftedPath += token;
            }
        }

        return {
            dPath: shiftedPath.trim(),
            bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
        };
    }

    rgbToHex(color) {
        const toHex = (c) => {
            const hex = Math.round(c).toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };
        return "#" + toHex(color.r) + toHex(color.g) + toHex(color.b);
    }
}
