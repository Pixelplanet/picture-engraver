/**
 * XS File Generator (v2 workspace format)
 *
 * Produces the new directory-layout ZIP container described in
 * docs/XS_FORMAT.md. Key differences vs. the legacy .xcs writer:
 *
 *   - Output is a ZIP archive (magic `PK\x03\x04`) instead of a single
 *     monolithic JSON document.
 *   - Path strings (`dPath`) are externalized into a content-addressed
 *     SHA-256 bucket (`vectors/svg/`) and referenced from displays via
 *     `vectorRef`.
 *   - Per-display engraving parameters are hoisted into `profiles.json`
 *     and devices reference them by id.
 *   - When defocus is enabled it is carried on the profile (`defocus` +
 *     `defocus_distance`). When it is off (e.g. UV, where xTool removed the
 *     defocus feature), a non-engraved "raise the focus by N mm" TEXT layer is
 *     emitted instead and listed in the mode's `ignoredDisplayIds`.
 *   - `generateColorEngrave()` produces the new bitmap COLOR_ENGRAVE workspace:
 *     the source image is embedded as a real PNG under `resources/` and placed
 *     as a BITMAP display, so no SVG vectorization is required.
 *
 * The generator reuses the path-tightening / bounds logic from
 * XCSGenerator to keep the two outputs visually identical.
 */

import JSZip from 'jszip';
import { XCSGenerator } from './xcs-generator.js';
import { getXtoolMaterialId, DEFAULT_MATERIAL_ID } from './material-registry.js';
import { getLaserConfig, resolveDeviceId, getDefaultDefocus, normalizeDefocus } from './device-registry.js';

const SCHEMA_VERSION = '2.0.0';
const PROTOCOL = 'xcs-workspace-v2';
const APP_VERSION = '2.0.0';
// xTool Studio writes a literal "v2" (2 bytes, no trailing newline)
const FORMAT_SENTINEL = 'v2';

// Studio uses nanoid-style IDs: `profile:<12>` / `binding:<12>` / `patch:<12>`,
// 12-char alphanumeric (case-sensitive). Match that shape.
const NANOID_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function nanoid12() {
    let s = '';
    for (let i = 0; i < 12; i++) s += NANOID_ALPHA[Math.floor(Math.random() * NANOID_ALPHA.length)];
    return s;
}

// ── SHA-256 (works in browser via Web Crypto and in Node via node:crypto) ─────
async function sha256Hex(str) {
    // Browser / modern runtime path
    if (typeof globalThis !== 'undefined'
        && globalThis.crypto
        && globalThis.crypto.subtle
        && typeof TextEncoder !== 'undefined') {
        const buf = new TextEncoder().encode(str);
        const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
        const bytes = new Uint8Array(digest);
        let out = '';
        for (let i = 0; i < bytes.length; i++) {
            out += bytes[i].toString(16).padStart(2, '0');
        }
        return out;
    }
    // Node fallback
    const mod = await import('node:crypto');
    return mod.createHash('sha256').update(str, 'utf-8').digest('hex');
}

// ── SHA-256 of raw bytes (for content-addressing binary resources like PNGs) ──
async function sha256HexBytes(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (typeof globalThis !== 'undefined'
        && globalThis.crypto
        && globalThis.crypto.subtle) {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', u8);
        const out = new Uint8Array(digest);
        let hex = '';
        for (let i = 0; i < out.length; i++) hex += out[i].toString(16).padStart(2, '0');
        return hex;
    }
    const mod = await import('node:crypto');
    return mod.createHash('sha256').update(u8).digest('hex');
}

export class XSGenerator {
    constructor(settings) {
        this.settings = settings || {};
        this._xcs = new XCSGenerator(this.settings);
    }

    generateUUID() { return this._xcs.generateUUID(); }
    rgbToHex(c) { return this._xcs.rgbToHex(c); }
    calculateBoundsAndTighten(p) { return this._xcs.calculateBoundsAndTighten(p); }

    /**
     * Build the v2 workspace and return a Promise resolving to a Blob (browser)
     * or Node Buffer.
     */
    async generate(imageData, layers, size) {
        const built = await this._build(imageData, layers, size);
        return this._zip(built);
    }

    /**
     * Return the raw file map (path → string|object) for testing.
     */
    async generateFiles(imageData, layers, size) {
        return this._build(imageData, layers, size);
    }

    async _build(imageData, layers, size) {
        const now = Date.now();
        const projectId = this.generateUUID();
        const canvasId = this.generateUUID();

        // Resolve device / laser config
        const deviceId = resolveDeviceId(this.settings.activeDevice || 'f2_ultra_uv');
        const laserTypeId = this.settings.activeLaserType || null;
        const laser = getLaserConfig(deviceId, laserTypeId);
        const extId = laser ? (laser.xsExtId || laser.extId) : 'GS009-CLASS-4';
        const extName = laser ? (laser.xsExtName || laser.extName) : 'F2 Ultra UV';
        const lightSource = laser ? laser.lightSource : 'uv';
        const planType = laser ? laser.planType : 'dot_cloud';
        // v2 (.xs) only recognizes 'FILL_VECTOR_ENGRAVING' — using v1's
        // 'COLOR_FILL_ENGRAVE' makes Studio render the layer as outlines only,
        // ignoring the engraving parameters. Always force the v2 value here.
        const processingType = 'FILL_VECTOR_ENGRAVING';
        const hasPulseWidth = laser ? laser.hasPulseWidth : false;
        const hasMopaFreq = laser ? laser.hasMopaFrequency : false;

        // Defocus — settings.defocus may be {enabled,distance} or boolean or number
        const defocus = this._resolveDefocus(deviceId, laserTypeId);

        // Build displays + per-display profile (one profile per display)
        const layerData = this._xcs.generateLayerData(layers);
        const displays = [];
        const vectorBucket = new Map(); // hash → dPath
        const profiles = {};
        const profileRefsByDisplay = new Map(); // displayId → profileId
        // Displays present on the canvas but excluded from processing (e.g. the
        // manual focus-warning reminder). Mirrors the v1 `processIgnore` flag.
        const ignoredDisplayIds = [];

        let zOrder = 0;
        for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
            const layer = layers[layerIndex];
            if (!layer.visible) continue;
            if (!layer.paths || layer.paths.length === 0) continue;

            const combinedPath = layer.paths.filter(p => p && p.length > 0).join(' ');
            if (combinedPath.length === 0) continue;

            const displayId = this.generateUUID();
            const baseDisplay = this._xcs.createPathDisplayWithPath(
                displayId,
                layerIndex,
                layer.name || `Layer ${layerIndex + 1}`,
                combinedPath,
                layer.color,
            );
            if (!baseDisplay) continue;

            // Externalize dPath only when large enough to benefit from the
            // content-addressed vector bucket. Studio inlines short paths.
            const dPath = baseDisplay.dPath;
            const VECTOR_BUCKET_THRESHOLD = 1024;
            if (dPath && dPath.length >= VECTOR_BUCKET_THRESHOLD) {
                const hash = await sha256Hex(dPath);
                if (!vectorBucket.has(hash)) vectorBucket.set(hash, dPath);
                delete baseDisplay.dPath;
                baseDisplay.vectorRef = {
                    vectorHash: hash,
                    bucketType: 'svg',
                    originalField: 'dPath',
                };
            }

            // v2 union fields observed in real Studio-saved files
            if (baseDisplay.groupTags === undefined) baseDisplay.groupTags = [];
            if (baseDisplay.alpha === undefined) baseDisplay.alpha = 1;
            if (baseDisplay.effects === undefined) baseDisplay.effects = [];
            if (baseDisplay.customData === undefined || Object.keys(baseDisplay.customData).length === 0) {
                baseDisplay.customData = { tabBreaks: {}, startPoint: {} };
            }

            displays.push(baseDisplay);
            zOrder = Math.max(zOrder, baseDisplay.zOrder || 0);

            // Build a profile for this display
            const speed = layer.speed !== undefined ? layer.speed : (parseInt(this.settings.speed) || 100);
            const power = layer.power !== undefined ? layer.power : (parseInt(this.settings.power) || 10);
            const repeat = layer.passes !== undefined ? layer.passes : (parseInt(this.settings.passes) || 1);
            const frequency = layer.frequency !== undefined ? layer.frequency : 60;
            const lpi = layer.lpi !== undefined ? layer.lpi : 300;
            const crossHatch = layer.crossHatch !== undefined ? layer.crossHatch : !!this.settings.crossHatch;
            const pulseWidth = layer.pulseWidth !== undefined ? layer.pulseWidth : (parseInt(this.settings.pulseWidth) || 80);

            // F2 family (GS006) uses dwellTime-prefixed fields; F2 Ultra family
            // uses delayPerLine. Detected by extId prefix.
            const isF2Family = extId === 'GS006';

            const profileId = `profile:${nanoid12()}`;
            const values = {
                bitmapEngraveMode: 'normal',
                speed: parseInt(speed),
                density: parseInt(lpi),
                dotDuration: 100,
                dpi: parseInt(lpi),
                power: parseInt(power),
                repeat: parseInt(repeat),
                defocus: !!defocus.enabled,
                defocus_distance: defocus.enabled ? defocus.distance : 1,
                bitmapScanMode: crossHatch ? 'crossMode' : 'lineMode',
                frequency: parseInt(frequency),
                scanAngle: 0,
                angleType: 2,
                crossAngle: !!crossHatch,
                outlineTrace: false,
                needGapNumDensity: true,
                enableKerf: false,
                kerfDistance: 0,
                processingLightSource: lightSource === 'uv' ? 'red' : lightSource,
                processingType: processingType,
            };
            if (isF2Family) {
                values.enableDwellTime = false;
                values.dwellTime = 0.3;
            } else {
                values.enableDelayPerLine = false;
                values.delayPerLine = 0.3;
            }
            if (hasPulseWidth) values.pulseWidth = parseInt(pulseWidth) || 80;
            if (hasMopaFreq) values.mopaFrequency = parseInt(frequency);

            profiles[profileId] = {
                id: profileId,
                processingType: processingType,
                values,
            };
            profileRefsByDisplay.set(displayId, profileId);
        }

        // Manual focus-warning reminder. Defocus was removed for the UV engrave
        // type, so lasers flagged `addFocusWarning` get a non-engraved TEXT layer
        // telling the operator to raise the focus manually (unless defocus is
        // explicitly enabled, in which case the offset is baked into the profile).
        if (laser && laser.addFocusWarning && !defocus.enabled) {
            const warn = this._focusWarningDisplayV2(size, zOrder + 100, laser.focusWarningDistanceMm);
            displays.push(warn.display);
            ignoredDisplayIds.push(warn.id);
        }

        const chunkLayout = {
            displayCount: displays.length,
            chunkCount: displays.length > 0 ? 1 : 0,
            chunkIndexes: displays.length > 0 ? [0] : [],
        };

        // ── File assembly ────────────────────────────────────────────────
        const files = {};

        files['.format'] = FORMAT_SENTINEL;

        files['meta/persistence-meta.json'] = {
            schemaVersion: SCHEMA_VERSION,
            protocol: PROTOCOL,
        };

        // activeDeviceId always uses the "<extId>-1" suffix that Studio writes
        // when binding a device to a project.
        const deviceInstanceId = `${extId}-1`;

        files['project.json'] = {
            __v2__: true,
            version: SCHEMA_VERSION,
            schemaMeta: {
                schemaVersion: '2',
                format: 'directory',
                migratedFrom: 'v1',
                migratedAt: now,
            },
            projectId,
            // Studio uses the same UUID for both projectId and projectTraceID
            projectTraceID: projectId,
            projectName: 'Engraved Image',
            activeCanvasId: canvasId,
            activeDeviceId: deviceInstanceId,
            versionInfo: {
                source: 'picture-engraver',
                appVersion: APP_VERSION,
                savedAt: now,
                ua: typeof navigator !== 'undefined' ? (navigator.userAgent || '') : 'node',
                minRequiredVersion: '2.6.0',
                appMinRequiredVersion: '',
                webMinRequiredVersion: '',
            },
            created: now,
            modify: now,
            modules: {
                canvases: [canvasId],
                devices: [deviceInstanceId],
            },
            customProjectData: {
                projectTraceID: projectId,
            },
        };

        files['profiles.json'] = { profiles };

        files[`canvases/${canvasId}.json`] = {
            id: canvasId,
            title: 'Engraved Image',
            hidden: false,
            layerData,
            groupData: {},
            extendInfo: {
                version: SCHEMA_VERSION,
                minCanvasVersion: '0.0.0',
                displayProcessConfigMap: {},
                rulerPluginData: { rulerGuide: [] },
                type: '2d',
            },
            chunkLayout,
        };

        files[`canvases/${canvasId}/displays-0.json`] = {
            canvasId,
            chunkIndex: 0,
            displays,
        };

        // Device file — real Studio v2 layout uses profileRefs + bindings + patches
        // (NOT a displayProfiles map). Bindings are consolidated by profile id:
        // displays sharing the same profile share one binding with displayIds[].
        const profileRefs = [];
        const patches = {};
        // profileId → binding (so we can append displayIds + patchIds)
        const bindingByProfile = new Map();
        for (const d of displays) {
            const pid = profileRefsByDisplay.get(d.id);
            if (!pid) continue;
            if (!profileRefs.includes(pid)) profileRefs.push(pid);

            const patchId = `patch:${nanoid12()}`;
            const baseValues = profiles[pid].values;
            // The patch.overrides block omits Studio's "meta" defaults that live
            // on the base profile (dotDuration, kerf flags, delayPerLine, …).
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
            power: laser ? laser.powerLevels : [20],
            processing: {
                [canvasId]: {
                    id: canvasId,
                    activeMode: 'LASER_PLANE',
                    modes: {
                        LASER_PLANE: {
                            ignoredDisplayIds,
                            data: {
                                material: getXtoolMaterialId(this.settings.material || DEFAULT_MATERIAL_ID),
                                lightSourceMode: lightSource,
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
            customProjectData: {
                tangentialCuttingUuids: [],
                flyCutUuid2CanvasIds: {},
            },
        };

        // Vector bucket
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

        return files;
    }

    _resolveDefocus(deviceId, laserTypeId) {
        const def = this.settings.defocus;
        // Boolean: just enable/disable using laser default distance
        if (typeof def === 'boolean') {
            if (!def) return { enabled: false, distance: 1 };
            const d = normalizeDefocus(getDefaultDefocus(deviceId, laserTypeId));
            return d > 0 ? { enabled: true, distance: d } : { enabled: false, distance: 1 };
        }
        // Number: explicit distance (mm). Normalised to 1–12mm / 0.1 steps;
        // anything below the 1mm floor disables defocus (treated as off).
        if (typeof def === 'number' && isFinite(def)) {
            const d = normalizeDefocus(def);
            return d > 0
                ? { enabled: true, distance: d }
                : { enabled: false, distance: 1 };
        }
        // Object: { enabled, distance }
        if (def && typeof def === 'object') {
            const d = normalizeDefocus(def.distance);
            const enabled = (!!def.enabled || d > 0) && d > 0;
            return enabled
                ? { enabled: true, distance: d }
                : { enabled: false, distance: 1 };
        }
        // Fallback to laser-default
        const fallback = normalizeDefocus(getDefaultDefocus(deviceId, laserTypeId));
        return fallback > 0
            ? { enabled: true, distance: fallback }
            : { enabled: false, distance: 1 };
    }

    /**
     * Build a non-engraved "raise the focus" reminder as a v2 TEXT display.
     * The display is added to the canvas but listed in the mode's
     * `ignoredDisplayIds` so it is never processed by the laser.
     * @param {{width:number,height:number}} size
     * @param {number} zOrder
     * @param {number} [distanceMm]
     * @returns {{ id:string, display:object }}
     */
    _focusWarningDisplayV2(size, zOrder, distanceMm) {
        const id = this.generateUUID();
        const display = this._xcs.createFocusWarning(id, size, zOrder);
        const mm = typeof distanceMm === 'number' && distanceMm > 0 ? distanceMm : 4;
        display.text = `Remember to raise \nthe focus by ${mm}mm\n`;
        // v2 union fields observed on Studio-saved displays
        if (display.groupTags === undefined) display.groupTags = [];
        if (display.alpha === undefined) display.alpha = 1;
        if (display.effects === undefined) display.effects = [];
        return { id, display };
    }

    /**
     * Build a v2 BITMAP display referencing a PNG resource, sized to the given
     * physical dimensions. The image is placed at the canvas origin so multiple
     * per-colour layers overlay in perfect registration.
     */
    _bitmapDisplayV2({ id, resourcePath, pxWidth, pxHeight, widthMm, heightMm, zOrder, layerColor, groupTag }) {
        const scaleX = widthMm / pxWidth;
        const scaleY = heightMm / pxHeight;
        return {
            id,
            name: null,
            type: 'BITMAP',
            x: 0,
            y: 0,
            angle: 0,
            scale: { x: scaleX, y: scaleY },
            skew: { x: 0, y: 0 },
            pivot: { x: 0, y: 0 },
            localSkew: { x: 0, y: 0 },
            offsetX: 0,
            offsetY: 0,
            lockRatio: true,
            isClosePath: false,
            zOrder,
            groupTags: [],
            groupTag,
            layerTag: layerColor,
            layerColor,
            visible: true,
            originColor: '#000000',
            enableTransform: true,
            visibleState: true,
            lockState: false,
            resourceOrigin: '',
            customData: { tabBreaks: {}, startPoint: {} },
            rootComponentId: '',
            minCanvasVersion: '0.0.0',
            alpha: 1,
            fill: { paintType: 'color', visible: false, color: 0, alpha: 1 },
            stroke: {
                paintType: 'color', visible: false, color: 0, alpha: 1,
                width: 1, cap: 'butt', join: 'miter', miterLimit: 4, alignment: 0.5,
            },
            effects: [],
            transform: [scaleX, 0, 0, scaleY, 0, 0],
            width: widthMm,
            height: heightMm,
            isFill: true,
            warpLocalOffset: null,
            filterList: [],
            grayValue: [0, 255],
            sharpness: 50,
            brightness: 0,
            contrast: 0,
            saturation: 0,
            temperature: 0,
            tone: 0,
            colorInverted: false,
            colorInvertedFillTransparent: false,
            colorInvertedTransparentColor: 'black',
            filterAttrsMap: {
                emboss: { strength: 5 },
                halftone: { radius: 4, angle: 45 },
                binary: { threshold: 128 },
                sketch: { strength: 2 },
                dot: { angle: 45, scale: 14 },
            },
            mask: null,
            originWidth: pxWidth,
            originHeight: pxHeight,
            modifyData: {},
            currentUrl: '',
            dpi: { dpiX: 25.4 / scaleX, dpiY: 25.4 / scaleY },
            isGray: false,
            originAutoAdjust: null,
            autoStrength: 0,
            resourcePath,
            opacity: 1,
            filterList_V2: [],
        };
    }

    /**
     * Generate a bitmap COLOR_ENGRAVE (.xs) workspace and return a Promise
     * resolving to a Blob (browser) or Node Buffer.
     *
     * Mirrors the per-layer logic of the vector exporter: each colour-separated
     * layer becomes its own BITMAP (a PNG of just that layer's section) bound to
     * its own COLOR_ENGRAVE profile carrying that layer's engraving settings.
     *
     * @param {Array<{ pngBytes:Uint8Array, pxWidth:number, pxHeight:number,
     *   color?:{r:number,g:number,b:number}, name?:string, speed?:number,
     *   power?:number, passes?:number, frequency?:number, lpi?:number,
     *   dpi?:number }>} layers
     * @param {{ width:number, height:number }} size - Physical output size (mm).
     * @param {{ coverPngBytes?:Uint8Array }} [opts]
     */
    async generateColorEngrave(layers, size, opts = {}) {
        const built = await this._buildColorEngrave(layers, size, opts);
        return this._zip(built);
    }

    /** Return the raw file map for a color-engrave workspace (for testing). */
    async generateColorEngraveFiles(layers, size, opts = {}) {
        return this._buildColorEngrave(layers, size, opts);
    }

    async _buildColorEngrave(layers, size, opts = {}) {
        const layerList = Array.isArray(layers) ? layers : [layers];
        const validLayers = layerList.filter(L => L && L.pngBytes && (L.pngBytes.length > 0));
        if (validLayers.length === 0) {
            throw new Error('generateColorEngrave requires at least one layer with pngBytes');
        }

        const now = Date.now();
        const projectId = this.generateUUID();
        const canvasId = this.generateUUID();

        // Resolve device / laser config
        const deviceId = resolveDeviceId(this.settings.activeDevice || 'f2_ultra_uv');
        const laserTypeId = this.settings.activeLaserType || null;
        const laser = getLaserConfig(deviceId, laserTypeId);
        const extId = laser ? (laser.xsExtId || laser.extId) : 'GS009-CLASS-4';
        const extName = laser ? (laser.xsExtName || laser.extName) : 'F2 Ultra UV';
        const lightSource = laser ? laser.lightSource : 'uv';
        const deviceInstanceId = `${extId}-1`;
        // The regular F2 (GS006) has no frequency control — omit it from output.
        const hasFreq = laser ? laser.hasFrequency !== false : true;

        const widthMm = size && size.width ? size.width : 1;
        const heightMm = size && size.height ? size.height : 1;

        const displays = [];
        const ignoredDisplayIds = [];
        const profiles = {};
        const profileRefs = [];
        const bindings = [];
        const layerData = {};
        const resourceFiles = {}; // path → bytes (deduped)

        // ── Per-layer BITMAP + COLOR_ENGRAVE profile ──────────────────────
        for (let i = 0; i < validLayers.length; i++) {
            const L = validLayers[i];
            const pngBytes = L.pngBytes instanceof Uint8Array ? L.pngBytes : new Uint8Array(L.pngBytes);
            const pxWidth = L.pxWidth || 1;
            const pxHeight = L.pxHeight || 1;

            const resourceHash = await sha256HexBytes(pngBytes);
            const resourcePath = `resources/${resourceHash}.png`;
            resourceFiles[resourcePath] = pngBytes;

            const color = L.color || { r: 0, g: 0, b: 0 };
            const hex = this.rgbToHex(color);
            if (!layerData[hex]) {
                layerData[hex] = { name: L.name || hex.toUpperCase(), order: i + 1, visible: true };
            }

            const displayId = this.generateUUID();
            displays.push(this._bitmapDisplayV2({
                id: displayId,
                resourcePath,
                pxWidth,
                pxHeight,
                widthMm,
                heightMm,
                zOrder: i + 1,
                layerColor: hex,
                groupTag: this.generateUUID(),
            }));

            const speed = parseInt(L.speed != null ? L.speed : this.settings.speed) || 80;
            const power = parseInt(L.power != null ? L.power : this.settings.power) || 10;
            const repeat = parseInt(L.passes != null ? L.passes : this.settings.passes) || 1;
            const frequency = parseInt(L.frequency != null ? L.frequency : this.settings.frequency) || 40;
            const lpc = parseInt(L.lpi != null ? L.lpi : this.settings.lpi) || 100;
            const dpi = parseInt(L.dpi != null ? L.dpi : this.settings.dpi) || 500;

            const profileId = `profile:${nanoid12()}`;
            profiles[profileId] = {
                id: profileId,
                processingType: 'COLOR_ENGRAVE',
                values: {
                    bitmapEngraveMode: 'normal',
                    speed,
                    density: lpc,
                    dotDuration: 100,
                    dpi,
                    power,
                    repeat,
                    bitmapScanMode: 'zMode',
                    ...(hasFreq ? { frequency } : {}),
                    notResize: true,
                    scanAngle: 0,
                    angleType: 2,
                    crossAngle: false,
                },
            };
            profileRefs.push(profileId);
            bindings.push({
                bindingId: `binding:${nanoid12()}`,
                canvasId,
                mode: 'LASER_PLANE',
                baseProfileId: profileId,
                displayIds: [displayId],
            });
        }

        // ── Manual focus-warning reminder (defocus is gone for these lasers) ─
        if (laser && laser.addFocusWarning) {
            const warn = this._focusWarningDisplayV2(size, validLayers.length + 100, laser.focusWarningDistanceMm);
            displays.push(warn.display);
            ignoredDisplayIds.push(warn.id);
        }

        // ── File assembly ─────────────────────────────────────────────────
        const files = {};
        files['.format'] = FORMAT_SENTINEL;
        files['meta/persistence-meta.json'] = { schemaVersion: SCHEMA_VERSION, protocol: PROTOCOL };

        const coverPngBytes = opts.coverPngBytes;
        const hasCover = coverPngBytes && coverPngBytes.length > 0;
        files['project.json'] = {
            __v2__: true,
            version: SCHEMA_VERSION,
            schemaMeta: { schemaVersion: '2', format: 'directory', migratedFrom: 'v1', migratedAt: now },
            projectId,
            projectTraceID: projectId,
            projectName: 'Engraved Image',
            activeCanvasId: canvasId,
            activeDeviceId: deviceInstanceId,
            versionInfo: {
                source: 'picture-engraver',
                appVersion: APP_VERSION,
                savedAt: now,
                ua: typeof navigator !== 'undefined' ? (navigator.userAgent || '') : 'node',
                minRequiredVersion: '2.6.0',
                appMinRequiredVersion: '',
                webMinRequiredVersion: '',
            },
            created: now,
            modify: now,
            modules: { canvases: [canvasId], devices: [deviceInstanceId] },
            ...(hasCover ? { cover: 'resources/project-cover.png' } : {}),
            customProjectData: { projectTraceID: projectId },
        };

        files['profiles.json'] = { profiles };

        files[`canvases/${canvasId}.json`] = {
            id: canvasId,
            title: 'Engraved Image',
            hidden: false,
            layerData,
            groupData: {},
            extendInfo: {
                version: SCHEMA_VERSION,
                minCanvasVersion: '0.0.0',
                displayProcessConfigMap: {},
                rulerPluginData: { rulerGuide: [] },
                type: '2d',
            },
            chunkLayout: { displayCount: displays.length, chunkCount: 1, chunkIndexes: [0] },
        };

        files[`canvases/${canvasId}/displays-0.json`] = { canvasId, chunkIndex: 0, displays };

        files[`devices/device-${deviceInstanceId}.json`] = {
            id: deviceInstanceId,
            deviceCode: extId,
            extId,
            extName,
            power: laser ? laser.powerLevels : [5],
            processing: {
                [canvasId]: {
                    id: canvasId,
                    activeMode: 'LASER_PLANE',
                    modes: {
                        LASER_PLANE: {
                            ignoredDisplayIds,
                            data: {
                                material: getXtoolMaterialId(this.settings.material || DEFAULT_MATERIAL_ID),
                                lightSourceMode: lightSource,
                                thickness: 0,
                                isProcessByLayer: false,
                                pathPlanning: 'auto',
                                fillPlanning: 'separate',
                                scanDirection: 'topToBottom',
                                enableOddEvenKerf: true,
                            },
                            profileRefs,
                            patches: {},
                            bindings,
                        },
                    },
                },
            },
            customProjectData: { tangentialCuttingUuids: [], flyCutUuid2CanvasIds: {} },
        };

        // ── Image resources (content-addressed PNG + meta sidecar) ─────────
        for (const [resourcePath, bytes] of Object.entries(resourceFiles)) {
            const hash = resourcePath.slice('resources/'.length, -'.png'.length);
            files[resourcePath] = bytes;
            files[`${resourcePath}.meta.json`] = {
                ref: resourcePath,
                metadata: {
                    kind: 'image',
                    source: { type: 'workspace', value: `${hash}.png` },
                    mimeType: 'image/png',
                },
            };
        }
        if (hasCover) {
            const coverBytes = coverPngBytes instanceof Uint8Array ? coverPngBytes : new Uint8Array(coverPngBytes);
            files['resources/project-cover.png'] = coverBytes;
            files['resources/project-cover.png.meta.json'] = {
                ref: 'resources/project-cover.png',
                metadata: {
                    kind: 'image',
                    source: { type: 'workspace', value: 'project-cover.png' },
                    mimeType: 'image/png',
                },
            };
        }

        return files;
    }

    async _zip(files) {
        const zip = new JSZip();
        for (const [path, content] of Object.entries(files)) {
            if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
                // Binary resource (e.g. PNG). JSZip stores typed arrays directly.
                zip.file(path, content);
            } else if (typeof content === 'string') {
                zip.file(path, content);
            } else {
                zip.file(path, JSON.stringify(content));
            }
        }
        const isBrowser = typeof window !== 'undefined' && typeof Blob !== 'undefined';
        return zip.generateAsync({
            type: isBrowser ? 'blob' : 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
            mimeType: 'application/zip',
        });
    }
}
