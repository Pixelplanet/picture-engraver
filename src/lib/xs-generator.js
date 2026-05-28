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
 *   - Profiles carry `defocus` + `defocus_distance`, so the legacy
 *     "raise focus by 4 mm" TEXT display is no longer emitted.
 *
 * The generator reuses the path-tightening / bounds logic from
 * XCSGenerator to keep the two outputs visually identical.
 */

import JSZip from 'jszip';
import { XCSGenerator } from './xcs-generator.js';
import { getXtoolMaterialId, DEFAULT_MATERIAL_ID } from './material-registry.js';
import { getLaserConfig, resolveDeviceId, getDefaultDefocus } from './device-registry.js';

const SCHEMA_VERSION = '2.0.0';
const PROTOCOL = 'xcs-workspace-v2';
const APP_VERSION = '2.0.0';
const FORMAT_SENTINEL = 'v2\n';

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
        const projectTraceID = this.generateUUID();
        const canvasId = this.generateUUID();

        // Resolve device / laser config
        const deviceId = resolveDeviceId(this.settings.activeDevice || 'f2_ultra_uv');
        const laserTypeId = this.settings.activeLaserType || null;
        const laser = getLaserConfig(deviceId, laserTypeId);
        const extId = laser ? laser.extId : 'GS009-CLASS-4';
        const extName = laser ? laser.extName : 'F2 Ultra UV';
        const lightSource = laser ? laser.lightSource : 'uv';
        const planType = laser ? laser.planType : 'dot_cloud';
        const processingType = laser ? laser.processingType : 'FILL_VECTOR_ENGRAVING';
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

            // Externalize dPath into the vector bucket
            const dPath = baseDisplay.dPath;
            const hash = await sha256Hex(dPath);
            if (!vectorBucket.has(hash)) vectorBucket.set(hash, dPath);

            // Replace dPath with vectorRef
            delete baseDisplay.dPath;
            baseDisplay.vectorRef = {
                vectorHash: hash,
                bucketType: 'svg',
                originalField: 'dPath',
            };

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

            const profileId = `profile_${displayId.slice(0, 8)}`;
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
                enableDelayPerLine: false,
                delayPerLine: 0.3,
                outlineTrace: false,
                needGapNumDensity: true,
                enableKerf: false,
                kerfDistance: 0,
                processingLightSource: lightSource === 'uv' ? 'red' : lightSource,
                processingType: processingType,
            };
            if (hasPulseWidth) values.pulseWidth = parseInt(pulseWidth) || 80;
            if (hasMopaFreq) values.mopaFrequency = parseInt(frequency);

            profiles[profileId] = {
                id: profileId,
                processingType: processingType,
                values,
            };
            profileRefsByDisplay.set(displayId, profileId);
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

        files['project.json'] = {
            __v2__: true,
            version: SCHEMA_VERSION,
            schemaMeta: {
                schemaVersion: SCHEMA_VERSION,
                format: 'directory',
            },
            projectId,
            projectTraceID,
            projectName: 'Engraved Image',
            activeCanvasId: canvasId,
            activeDeviceId: extId,
            versionInfo: {
                source: 'picture-engraver',
                appVersion: APP_VERSION,
                savedAt: now,
                ua: typeof navigator !== 'undefined' ? (navigator.userAgent || '') : 'node',
                minRequiredVersion: SCHEMA_VERSION,
                appMinRequiredVersion: APP_VERSION,
                webMinRequiredVersion: APP_VERSION,
            },
            created: now,
            modify: now,
            modules: {
                canvases: [canvasId],
                devices: [extId],
            },
            customProjectData: {
                tangentialCuttingUuids: [],
                flyCutUuid2CanvasIds: {},
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
                rulerPluginData: {},
                type: '2d',
            },
            chunkLayout,
        };

        files[`canvases/${canvasId}/displays-0.json`] = {
            canvasId,
            chunkIndex: 0,
            displays,
        };

        // Device file — maps each display to its profile id
        const ignoredDisplayIds = [];
        const displayProfileMap = {};
        for (const d of displays) {
            const pid = profileRefsByDisplay.get(d.id);
            if (pid) displayProfileMap[d.id] = pid;
        }

        files[`devices/device-${extId}.json`] = {
            id: extId,
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
                            material: getXtoolMaterialId(this.settings.material || DEFAULT_MATERIAL_ID),
                            lightSourceMode: lightSource,
                            thickness: 0,
                            isProcessByLayer: false,
                            pathPlanning: 'auto',
                            fillPlanning: 'separate',
                            ignoredDisplayIds,
                            displayProfiles: displayProfileMap,
                            planType,
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
            return def
                ? { enabled: true, distance: getDefaultDefocus(deviceId, laserTypeId) || 1 }
                : { enabled: false, distance: 1 };
        }
        // Number: explicit distance (mm). 0 disables.
        if (typeof def === 'number' && isFinite(def)) {
            return def > 0
                ? { enabled: true, distance: def }
                : { enabled: false, distance: 1 };
        }
        // Object: { enabled, distance }
        if (def && typeof def === 'object') {
            const enabled = !!def.enabled || (typeof def.distance === 'number' && def.distance > 0);
            const distance = typeof def.distance === 'number' && def.distance > 0 ? def.distance : 1;
            return { enabled, distance };
        }
        // Fallback to laser-default
        const fallback = getDefaultDefocus(deviceId, laserTypeId);
        return fallback > 0
            ? { enabled: true, distance: fallback }
            : { enabled: false, distance: 1 };
    }

    async _zip(files) {
        const zip = new JSZip();
        for (const [path, content] of Object.entries(files)) {
            if (typeof content === 'string') {
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
