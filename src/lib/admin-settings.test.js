import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AdminSettings, validateTestGridSettings, VALID_LASER_TYPES, HARDCODED_TEST_GRID_DEFAULTS, validateColorMap } from './admin-settings.js';

describe('AdminSettings', () => {
    let tmpDir;
    let settings;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-test-'));
        settings = new AdminSettings(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // ── Load ────────────────────────────────────────────────────────────

    describe('load', () => {
        it('should return defaults when no settings file exists', () => {
            const loaded = settings.load();
            expect(loaded._version).toBe(1);
            expect(loaded.testGridDefaults).toBeDefined();
            expect(loaded.visibility).toEqual({ hiddenDevices: [], hiddenLaserTypes: [] });
            expect(loaded.testGridDefaults.uv).toBeDefined();
            expect(loaded.testGridDefaults.mopa).toBeDefined();
        });

        it('should return all 6 laser types in defaults', () => {
            const loaded = settings.load();
            for (const lt of VALID_LASER_TYPES) {
                expect(loaded.testGridDefaults[lt]).toBeDefined();
            }
        });

        it('should return cached result on second call', () => {
            const a = settings.load();
            const b = settings.load();
            expect(a).toBe(b); // Same reference
        });

        it('should load saved settings from file', () => {
            // Write a custom settings file
            const custom = {
                _version: 1,
                testGridDefaults: {
                    uv: { ...HARDCODED_TEST_GRID_DEFAULTS.uv, power: 99 },
                },
            };
            fs.writeFileSync(path.join(tmpDir, 'admin-settings.json'), JSON.stringify(custom));

            const loaded = settings.load();
            expect(loaded.testGridDefaults.uv.power).toBe(99);
        });

        it('should merge saved file with defaults for missing laser types', () => {
            const partial = {
                _version: 1,
                testGridDefaults: {
                    uv: { power: 55 },
                    // mopa, mopa_single, etc. are missing
                },
                visibility: {
                    hiddenDevices: ['f2'],
                    hiddenLaserTypes: ['blue_f2'],
                },
            };
            fs.writeFileSync(path.join(tmpDir, 'admin-settings.json'), JSON.stringify(partial));

            const loaded = settings.load();
            // UV should have the custom power
            expect(loaded.testGridDefaults.uv.power).toBe(55);
            // UV should still have defaults for missing fields
            expect(loaded.testGridDefaults.uv.cardWidth).toBe(86);
            // MOPA should fall back to full defaults
            expect(loaded.testGridDefaults.mopa.power).toBe(14);
            expect(loaded.testGridDefaults.mopa.speedMin).toBe(200);
            expect(loaded.visibility).toEqual({ hiddenDevices: ['f2'], hiddenLaserTypes: ['blue_f2'] });
        });

        it('should gracefully handle corrupted JSON', () => {
            fs.writeFileSync(path.join(tmpDir, 'admin-settings.json'), 'NOT JSON{{{');
            const loaded = settings.load();
            // Should fall back to defaults
            expect(loaded.testGridDefaults.uv.power).toBe(HARDCODED_TEST_GRID_DEFAULTS.uv.power);
        });
    });

    // ── Save ────────────────────────────────────────────────────────────

    describe('save', () => {
        it('should persist settings to file', () => {
            const defaults = settings.load();
            defaults.testGridDefaults.uv.power = 88;
            settings.save(defaults);

            // Clear cache and reload
            settings.invalidateCache();
            const reloaded = settings.load();
            expect(reloaded.testGridDefaults.uv.power).toBe(88);
        });

        it('should create data directory if it does not exist', () => {
            const nestedDir = path.join(tmpDir, 'nested', 'deep');
            const s = new AdminSettings(nestedDir);
            const defaults = s.load();
            s.save(defaults);
            expect(fs.existsSync(path.join(nestedDir, 'admin-settings.json'))).toBe(true);
        });

        it('should create backup before overwriting', () => {
            // Save initial
            const defaults = settings.load();
            settings.save(defaults);

            // Save again — should create backup
            defaults.testGridDefaults.uv.power = 42;
            settings.save(defaults);

            const files = fs.readdirSync(tmpDir);
            const backups = files.filter(f => f.includes('-backup-'));
            expect(backups.length).toBe(1);
        });

        it('should invalidate cache after save', () => {
            const a = settings.load();
            a.testGridDefaults.uv.power = 77;
            settings.save(a);

            const b = settings.load();
            expect(b.testGridDefaults.uv.power).toBe(77);
            expect(a).not.toBe(b); // Different reference due to cache invalidation
        });

        it('should reject unknown laser types', () => {
            expect(() => {
                settings.save({
                    testGridDefaults: { plasma: { power: 50 } }
                });
            }).toThrow('Unknown laser type: plasma');
        });

        it('should reject invalid settings', () => {
            expect(() => {
                settings.save({
                    testGridDefaults: { uv: { power: 999 } }
                });
            }).toThrow();
        });

        it('should add _version and _modified on save', () => {
            settings.save(settings.load());
            settings.invalidateCache();
            const loaded = settings.load();
            expect(loaded._version).toBe(1);
            expect(loaded._modified).toBeTruthy();
        });
    });

    // ── updateTestGridDefaults ──────────────────────────────────────────

    describe('updateTestGridDefaults', () => {
        it('should update a single laser type', () => {
            settings.updateTestGridDefaults('uv', { power: 65 });

            settings.invalidateCache();
            const loaded = settings.load();
            expect(loaded.testGridDefaults.uv.power).toBe(65);
            // Other fields should remain
            expect(loaded.testGridDefaults.uv.cardWidth).toBe(86);
        });

        it('should not affect other laser types', () => {
            settings.updateTestGridDefaults('uv', { power: 65 });

            settings.invalidateCache();
            const loaded = settings.load();
            expect(loaded.testGridDefaults.mopa.power).toBe(14);
        });

        it('should reject unknown laser type', () => {
            expect(() => {
                settings.updateTestGridDefaults('plasma', { power: 50 });
            }).toThrow('Unknown laser type: plasma');
        });

        it('should reject invalid settings', () => {
            expect(() => {
                settings.updateTestGridDefaults('uv', { cardWidth: -5 });
            }).toThrow();
        });
    });

    describe('updateVisibilitySettings', () => {
        it('should save hidden devices and laser types', () => {
            settings.updateVisibilitySettings({
                hiddenDevices: ['f2_ultra_mopa'],
                hiddenLaserTypes: ['blue_ultra'],
            });

            settings.invalidateCache();
            const loaded = settings.load();
            expect(loaded.visibility.hiddenDevices).toEqual(['f2_ultra_mopa']);
            expect(loaded.visibility.hiddenLaserTypes).toEqual(['blue_ultra']);
        });

        it('should ignore unknown device and laser IDs', () => {
            settings.updateVisibilitySettings({
                hiddenDevices: ['nope', 'f2'],
                hiddenLaserTypes: ['bad_laser', 'ir'],
            });

            const visibility = settings.getVisibilitySettings();
            expect(visibility.hiddenDevices).toEqual(['f2']);
            expect(visibility.hiddenLaserTypes).toEqual(['ir']);
        });
    });

    // ── getTestGridDefaults ─────────────────────────────────────────────

    describe('getTestGridDefaults', () => {
        it('should return defaults for known laser type', () => {
            const defs = settings.getTestGridDefaults('uv');
            expect(defs.power).toBe(70);
            expect(defs.cardWidth).toBe(86);
        });

        it('should return customized values after update', () => {
            settings.updateTestGridDefaults('mopa', { power: 20 });
            const defs = settings.getTestGridDefaults('mopa');
            expect(defs.power).toBe(20);
        });

        it('should return null for unknown laser type', () => {
            expect(settings.getTestGridDefaults('plasma')).toBeNull();
        });

        it('should return correct defaults for all laser types', () => {
            for (const lt of VALID_LASER_TYPES) {
                const defs = settings.getTestGridDefaults(lt);
                expect(defs).toBeDefined();
                expect(defs.cardWidth).toBe(86);
                expect(defs.cardHeight).toBe(54);
            }
        });
    });

    // ── reset ───────────────────────────────────────────────────────────

    describe('reset', () => {
        it('should restore hardcoded defaults', () => {
            settings.updateTestGridDefaults('uv', { power: 1 });
            settings.reset();

            const defs = settings.getTestGridDefaults('uv');
            expect(defs.power).toBe(HARDCODED_TEST_GRID_DEFAULTS.uv.power);
        });
    });
});

// ── Validation ────────────────────────────────────────────────────────────

describe('validateTestGridSettings', () => {
    it('should accept valid UV settings', () => {
        const result = validateTestGridSettings({
            cardWidth: 86, cardHeight: 54,
            cellSize: 5, cellGap: 1, margin: 1,
            power: 70, speed: 425, passes: 1,
        }, 'uv');
        expect(result.valid).toBe(true);
    });

    it('should accept valid MOPA settings', () => {
        const result = validateTestGridSettings({
            cardWidth: 86, cardHeight: 54,
            gridMode: 'power', power: 14,
        }, 'mopa');
        expect(result.valid).toBe(true);
    });

    it('should reject negative cardWidth', () => {
        const result = validateTestGridSettings({ cardWidth: -5 }, 'uv');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('cardWidth must be a positive number');
    });

    it('should reject power > 100', () => {
        const result = validateTestGridSettings({ power: 150 }, 'uv');
        expect(result.valid).toBe(false);
    });

    it('should reject invalid gridMode', () => {
        const result = validateTestGridSettings({ gridMode: 'turbo' }, 'mopa');
        expect(result.valid).toBe(false);
    });

    it('should reject min > max for ranges', () => {
        const result = validateTestGridSettings({
            freqMin: 100, freqMax: 50,
        }, 'uv');
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('freqMin'))).toBe(true);
    });

    it('should reject non-integer passes', () => {
        const result = validateTestGridSettings({ passes: 1.5 }, 'uv');
        expect(result.valid).toBe(false);
    });

    it('should accept zero cellGap', () => {
        const result = validateTestGridSettings({ cellGap: 0 }, 'uv');
        expect(result.valid).toBe(true);
    });

    it('should reject non-object settings', () => {
        const result = validateTestGridSettings(null, 'uv');
        expect(result.valid).toBe(false);
    });

    it('should accept empty object (all optional)', () => {
        const result = validateTestGridSettings({}, 'uv');
        expect(result.valid).toBe(true);
    });
});

describe('VALID_LASER_TYPES', () => {
    it('should include all 6 types', () => {
        expect(VALID_LASER_TYPES).toEqual(
            expect.arrayContaining(['uv', 'mopa', 'mopa_single', 'blue_ultra', 'ir', 'blue_f2'])
        );
        expect(VALID_LASER_TYPES).toHaveLength(6);
    });
});

describe('HARDCODED_TEST_GRID_DEFAULTS', () => {
    it('should have defaults for all laser types', () => {
        for (const lt of VALID_LASER_TYPES) {
            expect(HARDCODED_TEST_GRID_DEFAULTS[lt]).toBeDefined();
            expect(HARDCODED_TEST_GRID_DEFAULTS[lt].cardWidth).toBe(86);
        }
    });

    it('MOPA-like defaults should have gridMode', () => {
        for (const lt of ['mopa', 'mopa_single', 'blue_ultra']) {
            expect(HARDCODED_TEST_GRID_DEFAULTS[lt].gridMode).toBe('power');
        }
    });

    it('UV-like defaults should have crossHatch', () => {
        for (const lt of ['uv', 'ir', 'blue_f2']) {
            expect(HARDCODED_TEST_GRID_DEFAULTS[lt].crossHatch).toBe(true);
        }
    });
});

// ── Color Map Validation ────────────────────────────────────────────────────

describe('validateColorMap', () => {
    const validMap = {
        name: 'Test Map',
        deviceType: 'f2_ultra_uv',
        data: {
            entries: [
                { color: { r: 100, g: 100, b: 100 }, frequency: 40, lpi: 500, gridPos: { col: 0, row: 0 } },
            ],
        },
    };

    it('should accept a valid color map', () => {
        expect(validateColorMap(validMap).valid).toBe(true);
    });

    it('should reject null', () => {
        expect(validateColorMap(null).valid).toBe(false);
    });

    it('should reject missing name', () => {
        const result = validateColorMap({ ...validMap, name: '' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('name is required');
    });

    it('should reject missing deviceType', () => {
        const result = validateColorMap({ ...validMap, deviceType: undefined });
        expect(result.valid).toBe(false);
    });

    it('should reject missing data', () => {
        const result = validateColorMap({ ...validMap, data: undefined });
        expect(result.valid).toBe(false);
    });

    it('should reject empty entries array', () => {
        const result = validateColorMap({ ...validMap, data: { entries: [] } });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('non-empty'))).toBe(true);
    });

    it('should reject entries without color', () => {
        const result = validateColorMap({
            ...validMap,
            data: { entries: [{ frequency: 40 }] },
        });
        expect(result.valid).toBe(false);
    });

    it('should reject entries without frequency or lpi', () => {
        const result = validateColorMap({
            ...validMap,
            data: { entries: [{ color: { r: 0, g: 0, b: 0 } }] },
        });
        expect(result.valid).toBe(false);
    });
});

// ── Color Map Storage ───────────────────────────────────────────────────────

describe('AdminSettings Color Maps', () => {
    let tmpDir;
    let settings;

    const makeMap = (overrides = {}) => ({
        name: 'Test UV Map',
        deviceType: 'f2_ultra_uv',
        data: {
            entries: [
                { color: { r: 100, g: 150, b: 200 }, frequency: 40, lpi: 500, gridPos: { col: 0, row: 0 } },
                { color: { r: 50, g: 80, b: 120 }, frequency: 46, lpi: 600, gridPos: { col: 1, row: 0 } },
            ],
            numCols: 2,
            numRows: 1,
            freqRange: [40, 46],
            lpiRange: [500, 600],
        },
        ...overrides,
    });

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-cm-test-'));
        settings = new AdminSettings(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('saveColorMap', () => {
        it('should save a map and return metadata', () => {
            const result = settings.saveColorMap(makeMap());
            expect(result.id).toMatch(/^admin_cm_/);
            expect(result.name).toBe('Test UV Map');
            expect(result.deviceType).toBe('f2_ultra_uv');
            expect(result.entryCount).toBe(2);
        });

        it('should create the color-maps directory', () => {
            settings.saveColorMap(makeMap());
            expect(fs.existsSync(path.join(tmpDir, 'color-maps'))).toBe(true);
        });

        it('should preserve existing id on update', () => {
            const result = settings.saveColorMap(makeMap({ id: 'custom_id_123' }));
            expect(result.id).toBe('custom_id_123');
        });

        it('should reject invalid color map', () => {
            expect(() => settings.saveColorMap({ name: '' })).toThrow('Invalid color map');
        });
    });

    describe('listColorMaps', () => {
        it('should return empty array when no maps exist', () => {
            expect(settings.listColorMaps()).toEqual([]);
        });

        it('should list saved maps', () => {
            settings.saveColorMap(makeMap());
            settings.saveColorMap(makeMap({ name: 'Second Map' }));
            const list = settings.listColorMaps();
            expect(list).toHaveLength(2);
        });

        it('should filter by deviceType', () => {
            settings.saveColorMap(makeMap({ deviceType: 'f2_ultra_uv' }));
            settings.saveColorMap(makeMap({ name: 'MOPA Map', deviceType: 'f2_ultra_mopa' }));
            expect(settings.listColorMaps('f2_ultra_uv')).toHaveLength(1);
            expect(settings.listColorMaps('f2_ultra_mopa')).toHaveLength(1);
            expect(settings.listColorMaps()).toHaveLength(2);
        });

        it('should return metadata without full data', () => {
            settings.saveColorMap(makeMap());
            const [meta] = settings.listColorMaps();
            expect(meta.entryCount).toBe(2);
            expect(meta.data).toBeUndefined(); // No full data in listing
        });
    });

    describe('getColorMap', () => {
        it('should return full map data by id', () => {
            const saved = settings.saveColorMap(makeMap());
            const full = settings.getColorMap(saved.id);
            expect(full.data.entries).toHaveLength(2);
            expect(full.name).toBe('Test UV Map');
        });

        it('should return null for unknown id', () => {
            expect(settings.getColorMap('nonexistent')).toBeNull();
        });
    });

    describe('deleteColorMap', () => {
        it('should delete a map', () => {
            const saved = settings.saveColorMap(makeMap());
            expect(settings.deleteColorMap(saved.id)).toBe(true);
            expect(settings.listColorMaps()).toHaveLength(0);
        });

        it('should return false for unknown id', () => {
            expect(settings.deleteColorMap('nonexistent')).toBe(false);
        });
    });

    describe('setDefaultColorMap', () => {
        it('should set a map as default', () => {
            const saved = settings.saveColorMap(makeMap());
            const result = settings.setDefaultColorMap(saved.id);
            expect(result.isDefault).toBe(true);

            // Verify persisted
            const full = settings.getColorMap(saved.id);
            expect(full.isDefault).toBe(true);
        });

        it('should clear default from other maps of same device', () => {
            const first = settings.saveColorMap(makeMap({ name: 'First' }));
            const second = settings.saveColorMap(makeMap({ name: 'Second' }));

            settings.setDefaultColorMap(first.id);
            settings.setDefaultColorMap(second.id);

            const firstFull = settings.getColorMap(first.id);
            const secondFull = settings.getColorMap(second.id);
            expect(firstFull.isDefault).toBe(false);
            expect(secondFull.isDefault).toBe(true);
        });

        it('should not affect maps of different device type', () => {
            const uv = settings.saveColorMap(makeMap({ name: 'UV', deviceType: 'f2_ultra_uv' }));
            const mopa = settings.saveColorMap(makeMap({ name: 'MOPA', deviceType: 'f2_ultra_mopa' }));

            settings.setDefaultColorMap(uv.id);
            settings.setDefaultColorMap(mopa.id);

            expect(settings.getColorMap(uv.id).isDefault).toBe(true); // UV still default
            expect(settings.getColorMap(mopa.id).isDefault).toBe(true); // MOPA also default
        });

        it('should throw for unknown id', () => {
            expect(() => settings.setDefaultColorMap('nonexistent')).toThrow('not found');
        });
    });

    describe('getColorMapsForDevice', () => {
        it('should return maps for a specific device', () => {
            settings.saveColorMap(makeMap({ deviceType: 'f2_ultra_uv' }));
            settings.saveColorMap(makeMap({ name: 'MOPA', deviceType: 'f2_ultra_mopa' }));

            const uvMaps = settings.getColorMapsForDevice('f2_ultra_uv');
            expect(uvMaps).toHaveLength(1);
            expect(uvMaps[0].data.entries).toBeDefined(); // Full data
        });

        it('should sort defaults first', () => {
            const a = settings.saveColorMap(makeMap({ name: 'Beta' }));
            const b = settings.saveColorMap(makeMap({ name: 'Alpha' }));
            settings.setDefaultColorMap(b.id);

            const maps = settings.getColorMapsForDevice('f2_ultra_uv');
            expect(maps[0].name).toBe('Alpha'); // Default comes first
        });

        it('should return empty array for device with no maps', () => {
            expect(settings.getColorMapsForDevice('f2')).toEqual([]);
        });
    });
});
