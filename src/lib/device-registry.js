/**
 * Device Registry
 * Central source of truth for all supported xTool devices and their laser types.
 *
 * Each device can have one or more laser types. Each laser type defines
 * the XCS output properties needed to generate valid .xcs files for xTool Studio.
 *
 * For dual-laser devices the user picks one active laser type at a time.
 * (Future: allow both simultaneously on different layers.)
 */

// ── Laser Type Definitions ─────────────────────────────────────────────────────
// Each laser type key maps to XCS-level properties that control how files are
// generated. The `settingsKey` links to material-registry defaults.

export const LASER_TYPES = {
    uv: {
        id: 'uv',
        name: 'UV',
        extId: 'GS009-CLASS-4',
        extName: 'F2 Ultra UV',
        lightSource: 'uv',
        processingType: 'FILL_VECTOR_ENGRAVING',
        hasPulseWidth: false,
        hasMopaFrequency: false,
        powerLevels: [5],
        planType: 'dot_cloud',
        settingsKey: 'uv',            // Key used in material-registry defaults
        hasDefaultMap: true,
        addFocusWarning: true,         // UV needs focus warning layer
    },
    mopa: {
        id: 'mopa',
        name: 'MOPA',
        extId: 'GS009-CLASS-1',
        extName: 'F2 Ultra (MOPA)',
        lightSource: 'red',
        processingType: 'COLOR_FILL_ENGRAVE',
        hasPulseWidth: true,
        hasMopaFrequency: true,
        powerLevels: [20],
        planType: 'red',
        settingsKey: 'mopa',
        hasDefaultMap: true,
        addFocusWarning: false,
    },
    mopa_single: {
        id: 'mopa_single',
        name: 'MOPA',
        extId: 'GS007-CLASS-4',
        extName: 'F2 Ultra (Single)',
        lightSource: 'red',
        processingType: 'COLOR_FILL_ENGRAVE',
        hasPulseWidth: true,
        hasMopaFrequency: true,
        powerLevels: [60],
        planType: 'red',
        settingsKey: 'mopa',           // Shares MOPA settings/defaults
        hasDefaultMap: true,            // Reuses MOPA color maps
        addFocusWarning: false,
    },
    blue_ultra: {
        id: 'blue_ultra',
        name: 'Blue Diode',
        extId: 'GS004-CLASS-4',
        extName: 'F2 Ultra',
        lightSource: 'blue',
        processingType: 'COLOR_FILL_ENGRAVE',
        hasPulseWidth: true,
        hasMopaFrequency: true,
        powerLevels: [60, 40],
        planType: 'blue',
        settingsKey: 'blue_ultra',
        hasDefaultMap: false,           // No calibrated color maps yet
        addFocusWarning: false,
    },
    ir: {
        id: 'ir',
        name: 'Infrared',
        extId: 'GS006',
        extName: 'F2',
        lightSource: 'red',
        processingType: 'COLOR_FILL_ENGRAVE',
        hasPulseWidth: false,
        hasMopaFrequency: false,
        powerLevels: [5, 15],
        planType: 'red',
        settingsKey: 'ir',
        hasDefaultMap: false,
        addFocusWarning: false,
    },
    blue_f2: {
        id: 'blue_f2',
        name: 'Blue Diode',
        extId: 'GS006',
        extName: 'F2',
        lightSource: 'blue',
        processingType: 'COLOR_FILL_ENGRAVE',
        hasPulseWidth: false,
        hasMopaFrequency: false,
        powerLevels: [5, 15],
        planType: 'blue',
        settingsKey: 'blue_f2',
        hasDefaultMap: false,
        addFocusWarning: false,
    },
};

// ── Device Families ────────────────────────────────────────────────────────────
// Families group related devices for the landing-page picker UI.

export const DEVICE_FAMILIES = {
    f2: {
        id: 'f2',
        name: 'xTool F2 Family',
        order: 1,          // Display order on landing page
    },
    virtual: {
        id: 'virtual',
        name: 'Export',
        order: 99,
    },
};

// ── Device Definitions ─────────────────────────────────────────────────────────

export const DEVICES = {
    f2_ultra_uv: {
        id: 'f2_ultra_uv',
        family: 'f2',
        name: 'F2 Ultra (UV)',
        description: 'UV Laser Module',
        laserTypes: ['uv'],
        defaultLaserType: 'uv',
    },
    f2_ultra_mopa: {
        // Internal ID stays for backward compatibility with stored settings
        id: 'f2_ultra_mopa',
        family: 'f2',
        name: 'F2 Ultra Dual',
        description: 'MOPA + Blue Diode Laser',
        laserTypes: ['mopa', 'blue_ultra'],
        defaultLaserType: 'mopa',
    },
    f2_ultra_single: {
        id: 'f2_ultra_single',
        family: 'f2',
        name: 'F2 Ultra Single',
        description: 'MOPA Laser Only',
        laserTypes: ['mopa_single'],
        defaultLaserType: 'mopa_single',
    },
    f2: {
        id: 'f2',
        family: 'f2',
        name: 'F2',
        description: 'Infrared + Blue Diode Laser',
        laserTypes: ['ir', 'blue_f2'],
        defaultLaserType: 'ir',
    },
    svg_export: {
        id: 'svg_export',
        family: 'virtual',
        name: 'SVG Vector Export',
        description: 'Export clean SVG vectors without laser settings',
        type: 'virtual',
        laserTypes: [],
        defaultLaserType: null,
    },
};

// Legacy device ID → current device ID mapping
const LEGACY_DEVICE_MAP = {
    'f2_ultra_base': 'f2_ultra_mopa',
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Resolve a device ID, handling legacy aliases.
 * @param {string} deviceId
 * @returns {string} The canonical device ID
 */
export function resolveDeviceId(deviceId) {
    return LEGACY_DEVICE_MAP[deviceId] || deviceId;
}

/**
 * Get the device configuration for a given device ID.
 * Returns null for unknown devices.
 * @param {string} deviceId
 * @returns {object|null}
 */
export function getDeviceConfig(deviceId) {
    const resolved = resolveDeviceId(deviceId);
    return DEVICES[resolved] || null;
}

/**
 * Get the laser type configuration for a device + laser type combination.
 * @param {string} deviceId
 * @param {string} [laserTypeId] - If omitted, uses device's defaultLaserType
 * @returns {object|null}
 */
export function getLaserConfig(deviceId, laserTypeId) {
    const device = getDeviceConfig(deviceId);
    if (!device) return null;
    const ltId = laserTypeId || device.defaultLaserType;
    if (!ltId) return null;
    return LASER_TYPES[ltId] || null;
}

/**
 * Get the active laser config from settings object.
 * Uses settings.activeDevice and settings.activeLaserType.
 * Falls back gracefully if missing.
 * @param {object} settings - Settings with activeDevice and optional activeLaserType
 * @returns {object|null}
 */
export function getActiveLaserConfig(settings) {
    if (!settings) return null;
    const deviceId = settings.activeDevice || 'f2_ultra_uv';
    const laserTypeId = settings.activeLaserType || null;
    return getLaserConfig(deviceId, laserTypeId);
}

/**
 * Check if a device has multiple laser types (i.e., needs a laser type selector).
 * @param {string} deviceId
 * @returns {boolean}
 */
export function isMultiLaserDevice(deviceId, visibilitySettings) {
    const device = getDeviceConfig(deviceId);
    if (!device) return false;
    const visibleLaserTypes = filterVisibleLaserTypes(device, visibilitySettings);
    return visibleLaserTypes.length > 1;
}

/**
 * Get available laser type options for a device (for UI dropdowns).
 * @param {string} deviceId
 * @returns {Array<{id: string, name: string}>}
 */
export function getLaserTypeOptions(deviceId, visibilitySettings) {
    const device = getDeviceConfig(deviceId);
    if (!device) return [];
    const visibleLaserTypes = filterVisibleLaserTypes(device, visibilitySettings);
    return visibleLaserTypes.map(ltId => {
        const lt = LASER_TYPES[ltId];
        return { id: ltId, name: lt ? lt.name : ltId };
    });
}

/**
 * Check if a given device is a virtual (non-laser) device.
 * @param {string} deviceId
 * @returns {boolean}
 */
export function isVirtualDevice(deviceId) {
    const device = getDeviceConfig(deviceId);
    return device?.type === 'virtual';
}

/**
 * Get devices grouped by family for landing page display.
 * @returns {Array<{family: object, devices: Array<object>}>}
 */
export function getDeviceFamilies() {
    return getDeviceFamiliesWithVisibility(undefined);
}

/**
 * Normalize visibility settings payload.
 * @param {{hiddenDevices?: string[], hiddenLaserTypes?: string[]}|undefined} visibilitySettings
 * @returns {{hiddenDevices: Set<string>, hiddenLaserTypes: Set<string>}}
 */
export function normalizeVisibilitySettings(visibilitySettings) {
    const hiddenDevices = new Set(Array.isArray(visibilitySettings?.hiddenDevices) ? visibilitySettings.hiddenDevices : []);
    const hiddenLaserTypes = new Set(Array.isArray(visibilitySettings?.hiddenLaserTypes) ? visibilitySettings.hiddenLaserTypes : []);
    return { hiddenDevices, hiddenLaserTypes };
}

/**
 * Check whether a device is visible under the given visibility settings.
 */
export function isDeviceVisible(deviceId, visibilitySettings) {
    const { hiddenDevices } = normalizeVisibilitySettings(visibilitySettings);
    return !hiddenDevices.has(deviceId);
}

/**
 * Check whether a laser type is visible under the given visibility settings.
 */
export function isLaserTypeVisible(laserTypeId, visibilitySettings) {
    const { hiddenLaserTypes } = normalizeVisibilitySettings(visibilitySettings);
    return !hiddenLaserTypes.has(laserTypeId);
}

/**
 * Return laser types that are visible for a device.
 */
export function filterVisibleLaserTypes(device, visibilitySettings) {
    if (!device) return [];
    return (device.laserTypes || []).filter(ltId => isLaserTypeVisible(ltId, visibilitySettings));
}

/**
 * Get devices grouped by family, with optional visibility filtering.
 */
export function getDeviceFamiliesWithVisibility(visibilitySettings) {
    const grouped = {};
    for (const device of Object.values(DEVICES)) {
        if (!isDeviceVisible(device.id, visibilitySettings)) continue;
        const visibleLaserTypes = filterVisibleLaserTypes(device, visibilitySettings);
        if (!isVirtualDevice(device.id) && device.laserTypes.length > 0 && visibleLaserTypes.length === 0) {
            continue;
        }
        const famId = device.family || 'virtual';
        if (!grouped[famId]) grouped[famId] = [];
        grouped[famId].push({
            ...device,
            laserTypes: visibleLaserTypes,
            defaultLaserType: visibleLaserTypes.includes(device.defaultLaserType)
                ? device.defaultLaserType
                : (visibleLaserTypes[0] || null),
        });
    }
    return Object.values(DEVICE_FAMILIES)
        .sort((a, b) => a.order - b.order)
        .map(fam => ({
            family: fam,
            devices: grouped[fam.id] || [],
        }))
        .filter(g => g.devices.length > 0);
}

/**
 * Get the settingsKey for the active laser (used for material-registry lookups).
 * MOPA-type lasers share the 'mopa' key; UV uses 'uv'; others use their own.
 * @param {string} deviceId
 * @param {string} [laserTypeId]
 * @returns {string}
 */
export function getSettingsKey(deviceId, laserTypeId) {
    const laser = getLaserConfig(deviceId, laserTypeId);
    return laser?.settingsKey || 'uv';
}
