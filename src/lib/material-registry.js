/**
 * Material Registry
 * Central source of truth for all supported materials.
 * Each material defines xTool Studio material IDs and per-laser defaults.
 *
 * To add a new material: add an entry to MATERIALS below — no other file changes needed
 * until the material is wired into UI/QR/color-maps.
 */

export const MATERIALS = {
    stainless_304: {
        id: 'stainless_304',
        name: '304 Stainless Steel',
        shortName: 'Stainless',
        xtoolMaterialId: 1323,
        lasers: ['uv', 'mopa', 'mopa_single', 'blue_ultra', 'ir', 'blue_f2'],
        defaults: {
            mopa: {
                power: 14,
                speed: 400,
                frequency: 200,
                lpi: 5000,
                pulseWidth: 80,
                passes: 1,
                powerRange: [12, 16],
                speedRange: [200, 1200],
                freqRange: [200, 1200],
            },
            // mopa_single shares mopa defaults (resolver falls back)
            uv: {
                power: 70,
                speed: 425,
                frequency: 40,
                lpi: 1000,
                passes: 1,
                freqRange: [40, 90],
                lpiRange: [300, 800],
                powerRange: [60, 80],
                speedRange: [300, 600],
            },
            // Blue / IR defaults are TBD — no calibrated grids yet
            blue_ultra: {
                power: 40,
                speed: 80,
                frequency: 65,
                lpi: 200,
                pulseWidth: 200,
                passes: 1,
                powerRange: [1, 60],
                speedRange: [10, 500],
                freqRange: [20, 100],
            },
            ir: {
                power: 50,
                speed: 200,
                frequency: 50,
                lpi: 500,
                passes: 1,
                powerRange: [1, 100],
                speedRange: [50, 500],
                freqRange: [20, 100],
            },
            blue_f2: {
                power: 50,
                speed: 200,
                frequency: 50,
                lpi: 500,
                passes: 1,
                powerRange: [1, 100],
                speedRange: [50, 500],
                freqRange: [20, 100],
            },
        },
    },
    titanium: {
        id: 'titanium',
        name: 'Titanium',
        shortName: 'Titanium',
        xtoolMaterialId: 458,
        lasers: ['uv', 'mopa', 'mopa_single', 'blue_ultra', 'ir', 'blue_f2'],
        defaults: {
            // TBD — needs test grids on actual titanium to determine optimal ranges.
            // For now mirroring stainless as a starting point; override once tested.
            mopa: {
                power: 14,
                speed: 400,
                frequency: 200,
                lpi: 5000,
                pulseWidth: 80,
                passes: 1,
                powerRange: [12, 16],
                speedRange: [200, 1200],
                freqRange: [200, 1200],
            },
            uv: {
                power: 70,
                speed: 425,
                frequency: 40,
                lpi: 1000,
                passes: 1,
                freqRange: [40, 90],
                lpiRange: [300, 800],
                powerRange: [60, 80],
                speedRange: [300, 600],
            },
            blue_ultra: {
                power: 40,
                speed: 80,
                frequency: 65,
                lpi: 200,
                pulseWidth: 200,
                passes: 1,
                powerRange: [1, 60],
                speedRange: [10, 500],
                freqRange: [20, 100],
            },
            ir: {
                power: 50,
                speed: 200,
                frequency: 50,
                lpi: 500,
                passes: 1,
                powerRange: [1, 100],
                speedRange: [50, 500],
                freqRange: [20, 100],
            },
            blue_f2: {
                power: 50,
                speed: 200,
                frequency: 50,
                lpi: 500,
                passes: 1,
                powerRange: [1, 100],
                speedRange: [50, 500],
                freqRange: [20, 100],
            },
        },
    },
};

/**
 * Default material used when no explicit selection is present (legacy / fallback).
 */
export const DEFAULT_MATERIAL_ID = 'stainless_304';

/**
 * Returns all materials compatible with the given laser settings key.
 * Falls back: mopa_single → mopa (they share calibration data).
 * @param {string} laserType - settingsKey from device-registry (e.g. 'mopa', 'uv', 'blue_ultra')
 * @returns {Array<{id:string, name:string, shortName:string, xtoolMaterialId:number}>}
 */
export function getMaterialsForLaser(laserType) {
    return Object.values(MATERIALS).filter(m => {
        if (m.lasers.includes(laserType)) return true;
        // mopa_single shares mopa calibration
        if (laserType === 'mopa_single' && m.lasers.includes('mopa')) return true;
        return false;
    });
}

/**
 * Looks up a material by its string ID.
 * Falls back to stainless_304 if not found.
 * @param {string} id
 * @returns {object}
 */
export function getMaterialById(id) {
    return MATERIALS[id] || MATERIALS[DEFAULT_MATERIAL_ID];
}

/**
 * Returns the xTool Studio numeric material ID for use in LASER_PLANE.
 * @param {string} materialId
 * @returns {number}
 */
export function getXtoolMaterialId(materialId) {
    return getMaterialById(materialId).xtoolMaterialId;
}

/**
 * Returns the default laser parameters for a given material + laser combo.
 * Falls back through: exact key → mopa (for mopa_single) → first available.
 * @param {string} materialId
 * @param {string} laserType - settingsKey from device-registry
 * @returns {object}
 */
export function getMaterialDefaults(materialId, laserType) {
    const material = getMaterialById(materialId);
    if (material.defaults[laserType]) return material.defaults[laserType];
    // mopa_single shares mopa defaults
    if (laserType === 'mopa_single' && material.defaults.mopa) return material.defaults.mopa;
    // Final fallback: first available default set
    const keys = Object.keys(material.defaults);
    return keys.length > 0 ? material.defaults[keys[0]] : {};
}
