import { describe, it, expect } from 'vitest';
import {
    MATERIALS, DEFAULT_MATERIAL_ID,
    getMaterialsForLaser, getMaterialById, getXtoolMaterialId, getMaterialDefaults
} from './material-registry.js';

describe('Material Registry', () => {

    describe('MATERIALS', () => {
        it('should have stainless_304 and titanium', () => {
            expect(MATERIALS.stainless_304).toBeDefined();
            expect(MATERIALS.titanium).toBeDefined();
        });

        it('every material should have required fields', () => {
            for (const [key, mat] of Object.entries(MATERIALS)) {
                expect(mat.id).toBe(key);
                expect(mat.name).toBeTruthy();
                expect(mat.shortName).toBeTruthy();
                expect(typeof mat.xtoolMaterialId).toBe('number');
                expect(Array.isArray(mat.lasers)).toBe(true);
                expect(mat.defaults).toBeDefined();
            }
        });

        it('stainless_304 should support all 6 laser types', () => {
            const mat = MATERIALS.stainless_304;
            expect(mat.lasers).toEqual(
                expect.arrayContaining(['uv', 'mopa', 'mopa_single', 'blue_ultra', 'ir', 'blue_f2'])
            );
        });

        it('each default set should have required engraving params', () => {
            for (const mat of Object.values(MATERIALS)) {
                for (const [laserKey, defaults] of Object.entries(mat.defaults)) {
                    expect(typeof defaults.power).toBe('number');
                    expect(typeof defaults.speed).toBe('number');
                    expect(typeof defaults.frequency).toBe('number');
                    expect(typeof defaults.lpi).toBe('number');
                    expect(typeof defaults.passes).toBe('number');
                }
            }
        });
    });

    describe('DEFAULT_MATERIAL_ID', () => {
        it('should be stainless_304', () => {
            expect(DEFAULT_MATERIAL_ID).toBe('stainless_304');
        });
    });

    describe('getMaterialsForLaser', () => {
        it('should return materials for UV laser', () => {
            const mats = getMaterialsForLaser('uv');
            expect(mats.length).toBeGreaterThan(0);
            expect(mats.every(m => m.lasers.includes('uv'))).toBe(true);
        });

        it('should return materials for MOPA laser', () => {
            const mats = getMaterialsForLaser('mopa');
            expect(mats.length).toBeGreaterThan(0);
        });

        it('should return materials for mopa_single via fallback', () => {
            const mats = getMaterialsForLaser('mopa_single');
            expect(mats.length).toBeGreaterThan(0);
            // mopa_single either listed directly or falls back to mopa
        });

        it('should return materials for blue_ultra', () => {
            const mats = getMaterialsForLaser('blue_ultra');
            expect(mats.length).toBeGreaterThan(0);
        });

        it('should return materials for ir', () => {
            const mats = getMaterialsForLaser('ir');
            expect(mats.length).toBeGreaterThan(0);
        });

        it('should return materials for blue_f2', () => {
            const mats = getMaterialsForLaser('blue_f2');
            expect(mats.length).toBeGreaterThan(0);
        });

        it('should return empty for unknown laser type', () => {
            const mats = getMaterialsForLaser('plasma');
            expect(mats).toHaveLength(0);
        });
    });

    describe('getMaterialById', () => {
        it('should return the material by ID', () => {
            const mat = getMaterialById('stainless_304');
            expect(mat.id).toBe('stainless_304');
            expect(mat.xtoolMaterialId).toBe(1323);
        });

        it('should fall back to stainless_304 for unknown ID', () => {
            const mat = getMaterialById('unobtanium');
            expect(mat.id).toBe('stainless_304');
        });
    });

    describe('getXtoolMaterialId', () => {
        it('should return xtool material ID for stainless', () => {
            expect(getXtoolMaterialId('stainless_304')).toBe(1323);
        });

        it('should return xtool material ID for titanium', () => {
            expect(getXtoolMaterialId('titanium')).toBe(458);
        });

        it('should fall back to stainless for unknown', () => {
            expect(getXtoolMaterialId('unobtanium')).toBe(1323);
        });
    });

    describe('getMaterialDefaults', () => {
        it('should return mopa defaults for stainless', () => {
            const defs = getMaterialDefaults('stainless_304', 'mopa');
            expect(defs.power).toBe(14);
            expect(defs.speed).toBe(400);
            expect(defs.pulseWidth).toBe(80);
        });

        it('should return UV defaults for stainless', () => {
            const defs = getMaterialDefaults('stainless_304', 'uv');
            expect(defs.power).toBe(70);
            expect(defs.speed).toBe(425);
        });

        it('should fall back mopa_single to mopa defaults', () => {
            const defs = getMaterialDefaults('stainless_304', 'mopa_single');
            // mopa_single shares mopa defaults
            expect(defs.power).toBe(14);
            expect(defs.speed).toBe(400);
            expect(defs.pulseWidth).toBe(80);
        });

        it('should return blue_ultra defaults', () => {
            const defs = getMaterialDefaults('stainless_304', 'blue_ultra');
            expect(defs.power).toBe(40);
            expect(defs.speed).toBe(80);
        });

        it('should return ir defaults', () => {
            const defs = getMaterialDefaults('stainless_304', 'ir');
            expect(defs.power).toBe(50);
            expect(defs.speed).toBe(200);
        });

        it('should return blue_f2 defaults', () => {
            const defs = getMaterialDefaults('stainless_304', 'blue_f2');
            expect(defs.power).toBe(50);
            expect(defs.speed).toBe(200);
        });

        it('should fall back to first available if laser type not found', () => {
            const defs = getMaterialDefaults('stainless_304', 'plasma');
            // first available default key is 'mopa'
            expect(defs).toBeDefined();
            expect(typeof defs.power).toBe('number');
        });

        it('should fall back to stainless defaults for unknown material', () => {
            const defs = getMaterialDefaults('unobtanium', 'uv');
            expect(defs.power).toBe(70);
        });
    });
});
