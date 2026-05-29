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
                            ignoredDisplayIds: [],
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
