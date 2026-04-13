/**
 * Admin Settings Module
 * Loads, saves, and validates admin-configurable defaults for test grid generation
 * and material parameters.
 *
 * Settings are persisted as a JSON file. The path is configurable via DATA_DIR env var.
 * Falls back to hardcoded defaults when no settings file exists.
 */

import fs from 'fs';
import path from 'path';

// ── Hardcoded Defaults ──────────────────────────────────────────────────────────
// These are used when no admin settings file exists.

const HARDCODED_TEST_GRID_DEFAULTS = {
    uv: {
        cardWidth: 86, cardHeight: 54,
        cellSize: 5, cellGap: 1, margin: 1,
        lpiMin: 300, lpiMax: 800,
        freqMin: 40, freqMax: 90,
        power: 70, speed: 425,
        passes: 1, crossHatch: true,
        material: 'stainless_304',
        qrPower: 17.5, qrSpeed: 150,
        qrSize: 12, qrFrequency: 90, qrLpi: 2500,
    },
    mopa: {
        cardWidth: 86, cardHeight: 54,
        cellSize: 5, cellGap: 1, margin: 1,
        gridMode: 'power', lpi: 5000,
        freqMin: 200, freqMax: 1200,
        power: 14,
        speedMin: 200, speedMax: 1200,
        pulseWidth: 80, passes: 1,
        material: 'stainless_304',
        qrPower: 17.5, qrSpeed: 150,
        qrFrequency: 90, qrLpi: 2500,
    },
    mopa_single: {
        cardWidth: 86, cardHeight: 54,
        cellSize: 5, cellGap: 1, margin: 1,
        gridMode: 'power', lpi: 5000,
        freqMin: 200, freqMax: 1200,
        power: 60,
        speedMin: 200, speedMax: 1200,
        pulseWidth: 80, passes: 1,
        material: 'stainless_304',
        qrPower: 17.5, qrSpeed: 150,
        qrFrequency: 90, qrLpi: 2500,
    },
    blue_ultra: {
        cardWidth: 86, cardHeight: 54,
        cellSize: 5, cellGap: 1, margin: 1,
        gridMode: 'power', lpi: 200,
        freqMin: 20, freqMax: 100,
        power: 40,
        speedMin: 10, speedMax: 500,
        pulseWidth: 200, passes: 1,
        material: 'stainless_304',
        qrPower: 17.5, qrSpeed: 150,
        qrFrequency: 90, qrLpi: 2500,
    },
    ir: {
        cardWidth: 86, cardHeight: 54,
        cellSize: 5, cellGap: 1, margin: 1,
        lpiMin: 200, lpiMax: 1000,
        freqMin: 20, freqMax: 100,
        power: 50, speed: 200,
        passes: 1, crossHatch: true,
        material: 'stainless_304',
        qrPower: 17.5, qrSpeed: 150,
        qrSize: 12, qrFrequency: 90, qrLpi: 2500,
    },
    blue_f2: {
        cardWidth: 86, cardHeight: 54,
        cellSize: 5, cellGap: 1, margin: 1,
        lpiMin: 200, lpiMax: 1000,
        freqMin: 20, freqMax: 100,
        power: 50, speed: 200,
        passes: 1, crossHatch: true,
        material: 'stainless_304',
        qrPower: 17.5, qrSpeed: 150,
        qrSize: 12, qrFrequency: 90, qrLpi: 2500,
    },
};

const VALID_LASER_TYPES = Object.keys(HARDCODED_TEST_GRID_DEFAULTS);
const VALID_GRID_MODES = ['frequency', 'power', 'speed'];

// ── Validation ──────────────────────────────────────────────────────────────────

function isPositiveNumber(v) { return typeof v === 'number' && isFinite(v) && v > 0; }
function isNonNegativeNumber(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }

/**
 * Validate a single laser type's test grid settings.
 * Returns { valid: true } or { valid: false, errors: [...] }
 */
export function validateTestGridSettings(settings, laserType) {
    const errors = [];
    if (!settings || typeof settings !== 'object') {
        return { valid: false, errors: ['Settings must be an object'] };
    }

    // Required numeric fields
    const requiredPositive = ['cardWidth', 'cardHeight', 'cellSize', 'margin'];
    for (const key of requiredPositive) {
        if (settings[key] !== undefined && !isPositiveNumber(settings[key])) {
            errors.push(`${key} must be a positive number`);
        }
    }

    if (settings.cellGap !== undefined && !isNonNegativeNumber(settings.cellGap)) {
        errors.push('cellGap must be a non-negative number');
    }

    if (settings.passes !== undefined && (!Number.isInteger(settings.passes) || settings.passes < 1)) {
        errors.push('passes must be a positive integer');
    }

    // Range validation
    if (settings.power !== undefined && (settings.power < 0 || settings.power > 100)) {
        errors.push('power must be between 0 and 100');
    }
    if (settings.speed !== undefined && !isPositiveNumber(settings.speed)) {
        errors.push('speed must be a positive number');
    }

    // Grid mode validation for MOPA-like types
    if (settings.gridMode !== undefined && !VALID_GRID_MODES.includes(settings.gridMode)) {
        errors.push(`gridMode must be one of: ${VALID_GRID_MODES.join(', ')}`);
    }

    // Min/max range sanity
    const rangePairs = [
        ['lpiMin', 'lpiMax'], ['freqMin', 'freqMax'],
        ['speedMin', 'speedMax'], ['powerMin', 'powerMax'],
    ];
    for (const [minKey, maxKey] of rangePairs) {
        if (settings[minKey] !== undefined && settings[maxKey] !== undefined) {
            if (settings[minKey] > settings[maxKey]) {
                errors.push(`${minKey} must not exceed ${maxKey}`);
            }
        }
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

// ── Settings Manager ────────────────────────────────────────────────────────────

export class AdminSettings {
    constructor(dataDir) {
        this.dataDir = dataDir || process.env.DATA_DIR || '/app/data';
        this.settingsPath = path.join(this.dataDir, 'admin-settings.json');
        this._cache = null;
    }

    /**
     * Load settings from file, falling back to hardcoded defaults.
     */
    load() {
        if (this._cache) return this._cache;

        try {
            if (fs.existsSync(this.settingsPath)) {
                const raw = fs.readFileSync(this.settingsPath, 'utf-8');
                const parsed = JSON.parse(raw);
                this._cache = this._mergeWithDefaults(parsed);
                return this._cache;
            }
        } catch (err) {
            console.error(`[AdminSettings] Failed to load settings: ${err.message}`);
        }

        // Return defaults
        this._cache = this._getDefaults();
        return this._cache;
    }

    /**
     * Save settings to file. Creates data dir if needed.
     */
    save(settings) {
        // Validate all laser types present in testGridDefaults
        if (settings.testGridDefaults) {
            for (const [lt, cfg] of Object.entries(settings.testGridDefaults)) {
                if (!VALID_LASER_TYPES.includes(lt)) {
                    throw new Error(`Unknown laser type: ${lt}`);
                }
                const result = validateTestGridSettings(cfg, lt);
                if (!result.valid) {
                    throw new Error(`Invalid settings for ${lt}: ${result.errors.join(', ')}`);
                }
            }
        }

        const toSave = {
            _version: 1,
            _modified: new Date().toISOString(),
            ...settings,
        };

        // Ensure directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // Backup existing file
        if (fs.existsSync(this.settingsPath)) {
            const backupPath = this.settingsPath.replace('.json', `-backup-${Date.now()}.json`);
            fs.copyFileSync(this.settingsPath, backupPath);
        }

        fs.writeFileSync(this.settingsPath, JSON.stringify(toSave, null, 2), 'utf-8');
        this._cache = null; // Invalidate cache
        return this.load();
    }

    /**
     * Update test grid defaults for a single laser type.
     */
    updateTestGridDefaults(laserType, settings) {
        if (!VALID_LASER_TYPES.includes(laserType)) {
            throw new Error(`Unknown laser type: ${laserType}`);
        }
        const result = validateTestGridSettings(settings, laserType);
        if (!result.valid) {
            throw new Error(`Invalid settings: ${result.errors.join(', ')}`);
        }

        const current = this.load();
        current.testGridDefaults[laserType] = {
            ...current.testGridDefaults[laserType],
            ...settings,
        };
        return this.save(current);
    }

    /**
     * Get test grid defaults for a specific laser type.
     */
    getTestGridDefaults(laserType) {
        const settings = this.load();
        return settings.testGridDefaults[laserType] || HARDCODED_TEST_GRID_DEFAULTS[laserType] || null;
    }

    /**
     * Reset to hardcoded defaults.
     */
    reset() {
        const defaults = this._getDefaults();
        return this.save(defaults);
    }

    /**
     * Invalidate in-memory cache (for testing or after external file changes).
     */
    invalidateCache() {
        this._cache = null;
    }

    _getDefaults() {
        return {
            _version: 1,
            _modified: new Date().toISOString(),
            testGridDefaults: JSON.parse(JSON.stringify(HARDCODED_TEST_GRID_DEFAULTS)),
        };
    }

    _mergeWithDefaults(saved) {
        const defaults = this._getDefaults();
        const merged = { ...defaults, ...saved };

        // Ensure every laser type has defaults even if the saved file is incomplete
        merged.testGridDefaults = merged.testGridDefaults || {};
        for (const lt of VALID_LASER_TYPES) {
            merged.testGridDefaults[lt] = {
                ...HARDCODED_TEST_GRID_DEFAULTS[lt],
                ...(merged.testGridDefaults[lt] || {}),
            };
        }
        return merged;
    }

    // ── Color Map Management ────────────────────────────────────────────

    /**
     * Get path to the color maps directory.
     */
    _colorMapsDir() {
        return path.join(this.dataDir, 'color-maps');
    }

    /**
     * List all admin-managed color maps (metadata only, no full data).
     * @param {string} [deviceType] - Optional filter by device type
     * @returns {Array} Array of { id, name, deviceType, description, entryCount, createdAt, updatedAt }
     */
    listColorMaps(deviceType) {
        const dir = this._colorMapsDir();
        if (!fs.existsSync(dir)) return [];

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        const maps = [];

        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
                const map = JSON.parse(raw);
                if (deviceType && map.deviceType !== deviceType) continue;
                maps.push({
                    id: map.id,
                    name: map.name,
                    deviceType: map.deviceType,
                    description: map.description || '',
                    entryCount: map.data?.entries?.length || 0,
                    createdAt: map.createdAt,
                    updatedAt: map.updatedAt,
                    isDefault: !!map.isDefault,
                });
            } catch {
                // Skip corrupted files
            }
        }

        return maps.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }

    /**
     * Get a single color map by ID (full data including entries).
     * @param {string} id
     * @returns {Object|null}
     */
    getColorMap(id) {
        const filePath = path.join(this._colorMapsDir(), `${id}.json`);
        if (!fs.existsSync(filePath)) return null;
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {
            return null;
        }
    }

    /**
     * Save a color map (create or update).
     * @param {Object} mapData - Full color map object
     * @returns {Object} The saved map metadata
     */
    saveColorMap(mapData) {
        const validation = validateColorMap(mapData);
        if (!validation.valid) {
            throw new Error(`Invalid color map: ${validation.errors.join(', ')}`);
        }

        const dir = this._colorMapsDir();
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Generate ID if new
        if (!mapData.id) {
            mapData.id = 'admin_cm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        const now = new Date().toISOString();
        if (!mapData.createdAt) mapData.createdAt = now;
        mapData.updatedAt = now;

        const filePath = path.join(dir, `${mapData.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(mapData, null, 2), 'utf-8');

        return {
            id: mapData.id,
            name: mapData.name,
            deviceType: mapData.deviceType,
            description: mapData.description || '',
            entryCount: mapData.data?.entries?.length || 0,
            createdAt: mapData.createdAt,
            updatedAt: mapData.updatedAt,
            isDefault: !!mapData.isDefault,
        };
    }

    /**
     * Delete a color map by ID.
     * @param {string} id
     * @returns {boolean}
     */
    deleteColorMap(id) {
        const filePath = path.join(this._colorMapsDir(), `${id}.json`);
        if (!fs.existsSync(filePath)) return false;
        fs.unlinkSync(filePath);
        return true;
    }

    /**
     * Set a color map as the default for its device type.
     * Clears the default flag on all other maps for that device.
     * @param {string} id
     * @returns {Object} Updated map metadata
     */
    setDefaultColorMap(id) {
        const map = this.getColorMap(id);
        if (!map) throw new Error('Color map not found');

        // Clear default flag on all maps for this device type
        const dir = this._colorMapsDir();
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const filePath = path.join(dir, file);
                    const other = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    if (other.deviceType === map.deviceType && other.isDefault) {
                        other.isDefault = false;
                        fs.writeFileSync(filePath, JSON.stringify(other, null, 2), 'utf-8');
                    }
                } catch {
                    // Skip
                }
            }
        }

        // Set this map as default
        map.isDefault = true;
        map.updatedAt = new Date().toISOString();
        fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(map, null, 2), 'utf-8');

        return {
            id: map.id,
            name: map.name,
            deviceType: map.deviceType,
            isDefault: true,
        };
    }

    /**
     * Get all color maps for a device type that should be served as "system defaults" to clients.
     * Returns full data (entries + gridImage) for client consumption.
     * @param {string} deviceType
     * @returns {Array}
     */
    getColorMapsForDevice(deviceType) {
        const dir = this._colorMapsDir();
        if (!fs.existsSync(dir)) return [];

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        const maps = [];

        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
                const map = JSON.parse(raw);
                if (map.deviceType === deviceType) {
                    maps.push({
                        id: map.id,
                        name: map.name,
                        deviceType: map.deviceType,
                        description: map.description || '',
                        isDefault: !!map.isDefault,
                        data: map.data,
                    });
                }
            } catch {
                // Skip corrupted files
            }
        }

        // Sort: defaults first, then by name
        return maps.sort((a, b) => {
            if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
            return (a.name || '').localeCompare(b.name || '');
        });
    }
}

// ── Color Map Validation ────────────────────────────────────────────────────────

/**
 * Validate a color map object.
 * @param {Object} map
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateColorMap(map) {
    const errors = [];
    if (!map || typeof map !== 'object') {
        return { valid: false, errors: ['Color map must be an object'] };
    }

    if (!map.name || typeof map.name !== 'string' || map.name.trim().length === 0) {
        errors.push('name is required');
    }

    if (!map.deviceType || typeof map.deviceType !== 'string') {
        errors.push('deviceType is required');
    }

    if (!map.data || typeof map.data !== 'object') {
        errors.push('data is required');
    } else {
        if (!Array.isArray(map.data.entries) || map.data.entries.length === 0) {
            errors.push('data.entries must be a non-empty array');
        } else {
            // Spot-check first entry
            const first = map.data.entries[0];
            if (!first.color || typeof first.color.r !== 'number') {
                errors.push('entries must have color with r,g,b values');
            }
            if (typeof first.frequency !== 'number' && typeof first.lpi !== 'number') {
                errors.push('entries must have frequency or lpi');
            }
        }
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

export { HARDCODED_TEST_GRID_DEFAULTS, VALID_LASER_TYPES };
