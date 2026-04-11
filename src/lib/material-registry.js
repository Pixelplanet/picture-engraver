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
        lasers: ['uv', 'mopa'],
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
        },
    },
    titanium: {
        id: 'titanium',
        name: 'Titanium',
        shortName: 'Titanium',
        xtoolMaterialId: 458,
        lasers: ['uv', 'mopa'],
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
        },
    },
};

/**
 * Default material used when no explicit selection is present (legacy / fallback).
 */
export const DEFAULT_MATERIAL_ID = 'stainless_304';

/**
 * Returns all materials compatible with the given laser type.
 * @param {'uv'|'mopa'} laserType
 * @returns {Array<{id:string, name:string, shortName:string, xtoolMaterialId:number}>}
 */
export function getMaterialsForLaser(laserType) {
    return Object.values(MATERIALS).filter(m => m.lasers.includes(laserType));
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
 * @param {string} materialId
 * @param {'uv'|'mopa'} laserType
 * @returns {object}
 */
export function getMaterialDefaults(materialId, laserType) {
    const material = getMaterialById(materialId);
    return material.defaults[laserType] || material.defaults.mopa;
}
