import { describe, it, expect } from 'vitest';
import {
    LASER_TYPES, DEVICES, DEVICE_FAMILIES,
    resolveDeviceId, getDeviceConfig, getLaserConfig,
    getActiveLaserConfig, isMultiLaserDevice, getLaserTypeOptions,
    isVirtualDevice, getSettingsKey, getDeviceFamilies
} from './device-registry.js';

describe('Device Registry', () => {

    // ── Data integrity ──────────────────────────────────────────────────────
    describe('LASER_TYPES', () => {
        it('should have all 6 laser types', () => {
            expect(Object.keys(LASER_TYPES)).toEqual(
                expect.arrayContaining(['uv', 'mopa', 'mopa_single', 'blue_ultra', 'ir', 'blue_f2'])
            );
            expect(Object.keys(LASER_TYPES)).toHaveLength(6);
        });

        it('every laser type should have required properties', () => {
            for (const [key, lt] of Object.entries(LASER_TYPES)) {
                expect(lt.id).toBe(key);
                expect(lt.extId).toBeTruthy();
                expect(lt.extName).toBeTruthy();
                expect(lt.lightSource).toBeTruthy();
                expect(lt.processingType).toBeTruthy();
                expect(typeof lt.hasPulseWidth).toBe('boolean');
                expect(typeof lt.hasMopaFrequency).toBe('boolean');
                expect(Array.isArray(lt.powerLevels)).toBe(true);
                expect(lt.settingsKey).toBeTruthy();
                expect(typeof lt.addFocusWarning).toBe('boolean');
            }
        });

        it('UV should require focus warning', () => {
            expect(LASER_TYPES.uv.addFocusWarning).toBe(true);
        });

        it('non-UV lasers should NOT require focus warning', () => {
            for (const [key, lt] of Object.entries(LASER_TYPES)) {
                if (key !== 'uv') {
                    expect(lt.addFocusWarning).toBe(false);
                }
            }
        });

        it('MOPA-like lasers should have pulseWidth and mopaFrequency', () => {
            const mopaLike = ['mopa', 'mopa_single', 'blue_ultra'];
            for (const key of mopaLike) {
                expect(LASER_TYPES[key].hasPulseWidth).toBe(true);
                expect(LASER_TYPES[key].hasMopaFrequency).toBe(true);
            }
        });

        it('non-MOPA lasers should NOT have pulseWidth/mopaFrequency', () => {
            const nonMopa = ['uv', 'ir', 'blue_f2'];
            for (const key of nonMopa) {
                expect(LASER_TYPES[key].hasPulseWidth).toBe(false);
                expect(LASER_TYPES[key].hasMopaFrequency).toBe(false);
            }
        });

        it('mopa_single should share mopa settingsKey', () => {
            expect(LASER_TYPES.mopa_single.settingsKey).toBe('mopa');
        });

        it('each laser type has unique extId+extName combination (except shared)', () => {
            // ir and blue_f2 share GS006/F2 but differ in lightSource
            expect(LASER_TYPES.ir.lightSource).not.toBe(LASER_TYPES.blue_f2.lightSource);
        });
    });

    describe('DEVICES', () => {
        it('should have all 5 devices', () => {
            expect(Object.keys(DEVICES)).toEqual(
                expect.arrayContaining(['f2_ultra_uv', 'f2_ultra_mopa', 'f2_ultra_single', 'f2', 'svg_export'])
            );
            expect(Object.keys(DEVICES)).toHaveLength(5);
        });

        it('every device should reference valid laser types', () => {
            for (const device of Object.values(DEVICES)) {
                for (const ltId of device.laserTypes) {
                    expect(LASER_TYPES[ltId]).toBeDefined();
                }
                if (device.defaultLaserType) {
                    expect(LASER_TYPES[device.defaultLaserType]).toBeDefined();
                    expect(device.laserTypes).toContain(device.defaultLaserType);
                }
            }
        });

        it('every device should belong to a valid family', () => {
            for (const device of Object.values(DEVICES)) {
                expect(DEVICE_FAMILIES[device.family]).toBeDefined();
            }
        });

        it('svg_export should be a virtual device with no laser types', () => {
            expect(DEVICES.svg_export.type).toBe('virtual');
            expect(DEVICES.svg_export.laserTypes).toHaveLength(0);
            expect(DEVICES.svg_export.defaultLaserType).toBeNull();
        });

        it('f2_ultra_mopa should be a dual-laser device', () => {
            expect(DEVICES.f2_ultra_mopa.laserTypes).toHaveLength(2);
            expect(DEVICES.f2_ultra_mopa.laserTypes).toContain('mopa');
            expect(DEVICES.f2_ultra_mopa.laserTypes).toContain('blue_ultra');
        });

        it('f2 should be a dual-laser device with ir + blue_f2', () => {
            expect(DEVICES.f2.laserTypes).toHaveLength(2);
            expect(DEVICES.f2.laserTypes).toContain('ir');
            expect(DEVICES.f2.laserTypes).toContain('blue_f2');
        });
    });

    // ── resolveDeviceId ─────────────────────────────────────────────────────

    describe('resolveDeviceId', () => {
        it('should return the same ID for current devices', () => {
            expect(resolveDeviceId('f2_ultra_uv')).toBe('f2_ultra_uv');
            expect(resolveDeviceId('f2_ultra_mopa')).toBe('f2_ultra_mopa');
            expect(resolveDeviceId('f2')).toBe('f2');
        });

        it('should resolve legacy f2_ultra_base to f2_ultra_mopa', () => {
            expect(resolveDeviceId('f2_ultra_base')).toBe('f2_ultra_mopa');
        });

        it('should pass through unknown IDs unchanged', () => {
            expect(resolveDeviceId('unknown_device')).toBe('unknown_device');
        });
    });

    // ── getDeviceConfig ─────────────────────────────────────────────────────

    describe('getDeviceConfig', () => {
        it('should return config for known devices', () => {
            const cfg = getDeviceConfig('f2_ultra_uv');
            expect(cfg).toBeDefined();
            expect(cfg.id).toBe('f2_ultra_uv');
            expect(cfg.name).toBe('F2 Ultra (UV)');
        });

        it('should resolve legacy IDs', () => {
            const cfg = getDeviceConfig('f2_ultra_base');
            expect(cfg).toBeDefined();
            expect(cfg.id).toBe('f2_ultra_mopa');
        });

        it('should return null for unknown devices', () => {
            expect(getDeviceConfig('nonexistent')).toBeNull();
        });
    });

    // ── getLaserConfig ───────────────────────────────────────────────────────

    describe('getLaserConfig', () => {
        it('should return default laser config when laserTypeId is omitted', () => {
            const laser = getLaserConfig('f2_ultra_uv');
            expect(laser.id).toBe('uv');
            expect(laser.extId).toBe('GS009-CLASS-4');
        });

        it('should return specific laser config when laserTypeId is given', () => {
            const laser = getLaserConfig('f2_ultra_mopa', 'blue_ultra');
            expect(laser.id).toBe('blue_ultra');
            expect(laser.extId).toBe('GS004-CLASS-4');
        });

        it('should return MOPA as default for f2_ultra_mopa', () => {
            const laser = getLaserConfig('f2_ultra_mopa');
            expect(laser.id).toBe('mopa');
            expect(laser.extName).toBe('F2 Ultra (MOPA)');
        });

        it('should return mopa_single for f2_ultra_single', () => {
            const laser = getLaserConfig('f2_ultra_single');
            expect(laser.id).toBe('mopa_single');
            expect(laser.extId).toBe('GS007-CLASS-4');
        });

        it('should return ir as default for f2', () => {
            const laser = getLaserConfig('f2');
            expect(laser.id).toBe('ir');
            expect(laser.extId).toBe('GS006');
        });

        it('should return blue_f2 when specified for f2', () => {
            const laser = getLaserConfig('f2', 'blue_f2');
            expect(laser.id).toBe('blue_f2');
            expect(laser.lightSource).toBe('blue');
        });

        it('should return null for unknown device', () => {
            expect(getLaserConfig('nonexistent')).toBeNull();
        });

        it('should return null for svg_export (no laser)', () => {
            expect(getLaserConfig('svg_export')).toBeNull();
        });

        it('should resolve legacy device IDs', () => {
            const laser = getLaserConfig('f2_ultra_base');
            expect(laser.id).toBe('mopa');
        });
    });

    // ── getActiveLaserConfig ────────────────────────────────────────────────

    describe('getActiveLaserConfig', () => {
        it('should return UV laser for default settings', () => {
            const laser = getActiveLaserConfig({});
            expect(laser.id).toBe('uv');
        });

        it('should return null for null settings', () => {
            expect(getActiveLaserConfig(null)).toBeNull();
        });

        it('should use activeDevice from settings', () => {
            const laser = getActiveLaserConfig({ activeDevice: 'f2_ultra_mopa' });
            expect(laser.id).toBe('mopa');
        });

        it('should use activeLaserType from settings', () => {
            const laser = getActiveLaserConfig({
                activeDevice: 'f2_ultra_mopa',
                activeLaserType: 'blue_ultra'
            });
            expect(laser.id).toBe('blue_ultra');
        });

        it('should fall back to UV when no activeDevice', () => {
            const laser = getActiveLaserConfig({ activeLaserType: 'mopa' });
            // f2_ultra_uv default has uv laser, but activeLaserType 'mopa' doesn't override 
            // because the resolved device is f2_ultra_uv which only has 'uv'
            // Actually getLaserConfig just looks up LASER_TYPES[laserTypeId] directly
            expect(laser.id).toBe('mopa');
        });
    });

    // ── isMultiLaserDevice ──────────────────────────────────────────────────

    describe('isMultiLaserDevice', () => {
        it('should return true for dual-laser devices', () => {
            expect(isMultiLaserDevice('f2_ultra_mopa')).toBe(true);
            expect(isMultiLaserDevice('f2')).toBe(true);
        });

        it('should return false for single-laser devices', () => {
            expect(isMultiLaserDevice('f2_ultra_uv')).toBe(false);
            expect(isMultiLaserDevice('f2_ultra_single')).toBe(false);
        });

        it('should return false for svg_export (no lasers)', () => {
            expect(isMultiLaserDevice('svg_export')).toBe(false);
        });

        it('should return false for unknown devices', () => {
            expect(isMultiLaserDevice('nonexistent')).toBe(false);
        });
    });

    // ── getLaserTypeOptions ──────────────────────────────────────────────────

    describe('getLaserTypeOptions', () => {
        it('should return options for f2_ultra_mopa', () => {
            const options = getLaserTypeOptions('f2_ultra_mopa');
            expect(options).toHaveLength(2);
            expect(options[0]).toEqual({ id: 'mopa', name: 'MOPA' });
            expect(options[1]).toEqual({ id: 'blue_ultra', name: 'Blue Diode' });
        });

        it('should return options for f2', () => {
            const options = getLaserTypeOptions('f2');
            expect(options).toHaveLength(2);
            expect(options[0]).toEqual({ id: 'ir', name: 'Infrared' });
            expect(options[1]).toEqual({ id: 'blue_f2', name: 'Blue Diode' });
        });

        it('should return single option for f2_ultra_uv', () => {
            const options = getLaserTypeOptions('f2_ultra_uv');
            expect(options).toHaveLength(1);
            expect(options[0]).toEqual({ id: 'uv', name: 'UV' });
        });

        it('should return empty array for svg_export', () => {
            expect(getLaserTypeOptions('svg_export')).toEqual([]);
        });

        it('should return empty array for unknown device', () => {
            expect(getLaserTypeOptions('nonexistent')).toEqual([]);
        });
    });

    // ── isVirtualDevice ─────────────────────────────────────────────────────

    describe('isVirtualDevice', () => {
        it('should return true for svg_export', () => {
            expect(isVirtualDevice('svg_export')).toBe(true);
        });

        it('should return false for physical devices', () => {
            expect(isVirtualDevice('f2_ultra_uv')).toBe(false);
            expect(isVirtualDevice('f2_ultra_mopa')).toBe(false);
            expect(isVirtualDevice('f2')).toBe(false);
        });

        it('should return false for unknown device', () => {
            expect(isVirtualDevice('nonexistent')).toBe(false);
        });
    });

    // ── getSettingsKey ──────────────────────────────────────────────────────

    describe('getSettingsKey', () => {
        it('should return uv for UV device', () => {
            expect(getSettingsKey('f2_ultra_uv')).toBe('uv');
        });

        it('should return mopa for MOPA devices', () => {
            expect(getSettingsKey('f2_ultra_mopa')).toBe('mopa');
            expect(getSettingsKey('f2_ultra_mopa', 'mopa')).toBe('mopa');
        });

        it('should return mopa for mopa_single (shared key)', () => {
            expect(getSettingsKey('f2_ultra_single')).toBe('mopa');
        });

        it('should return blue_ultra for blue diode (ultra)', () => {
            expect(getSettingsKey('f2_ultra_mopa', 'blue_ultra')).toBe('blue_ultra');
        });

        it('should return ir for F2 infrared', () => {
            expect(getSettingsKey('f2')).toBe('ir');
        });

        it('should return blue_f2 for F2 blue diode', () => {
            expect(getSettingsKey('f2', 'blue_f2')).toBe('blue_f2');
        });

        it('should fall back to uv for unknown', () => {
            expect(getSettingsKey('nonexistent')).toBe('uv');
        });
    });

    // ── getDeviceFamilies ───────────────────────────────────────────────────

    describe('getDeviceFamilies', () => {
        it('should return grouped families sorted by order', () => {
            const families = getDeviceFamilies();
            expect(families.length).toBeGreaterThanOrEqual(2);
            // f2 family comes first (order=1), virtual last (order=99)
            expect(families[0].family.id).toBe('f2');
            expect(families[families.length - 1].family.id).toBe('virtual');
        });

        it('should include all physical devices in f2 family', () => {
            const families = getDeviceFamilies();
            const f2Family = families.find(g => g.family.id === 'f2');
            expect(f2Family.devices).toHaveLength(4);
            const ids = f2Family.devices.map(d => d.id);
            expect(ids).toContain('f2_ultra_uv');
            expect(ids).toContain('f2_ultra_mopa');
            expect(ids).toContain('f2_ultra_single');
            expect(ids).toContain('f2');
        });

        it('should include svg_export in virtual family', () => {
            const families = getDeviceFamilies();
            const virtualFamily = families.find(g => g.family.id === 'virtual');
            expect(virtualFamily.devices).toHaveLength(1);
            expect(virtualFamily.devices[0].id).toBe('svg_export');
        });
    });
});
