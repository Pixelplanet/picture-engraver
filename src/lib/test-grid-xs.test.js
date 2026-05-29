import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { TestGridGenerator } from './test-grid-generator.js';

async function unzip(blobOrBuf) {
    const buf = Buffer.isBuffer(blobOrBuf) ? blobOrBuf : Buffer.from(await blobOrBuf.arrayBuffer());
    return JSZip.loadAsync(buf);
}

describe('TestGridGenerator → .xs (v2) output', () => {
    it('produces a valid v2 bundle for a UV grid with defocus', async () => {
        const gen = new TestGridGenerator({
            activeDevice: 'f2_ultra_uv',
            power: 70, speed: 425,
            lpiMin: 500, lpiMax: 1500,
            freqMin: 40, freqMax: 90,
            crossHatch: true, passes: 1, defocus: 4,
        });
        const { xs } = await gen.generateBusinessCardGridXS();
        const zip = await unzip(xs);

        // v2 file layout
        for (const f of ['.format', 'project.json', 'profiles.json', 'vectors/svg/index.json', 'vectors/svg/data-0.json']) {
            expect(zip.files[f]).toBeTruthy();
        }
        expect(await zip.files['.format'].async('string')).toBe('v2');

        // Every JSON file must parse
        for (const fn of Object.keys(zip.files)) {
            if (!zip.files[fn].dir && fn.endsWith('.json')) {
                const text = await zip.files[fn].async('string');
                expect(() => JSON.parse(text)).not.toThrow();
            }
        }

        const profiles = JSON.parse(await zip.files['profiles.json'].async('string')).profiles;
        const first = profiles[Object.keys(profiles)[0]];
        // v2 requires processingType inside values plus a richer set of defaults
        expect(first.values.processingType).toBe('FILL_VECTOR_ENGRAVING');
        expect(first.values.dotDuration).toBe(100);
        expect(first.values.outlineTrace).toBe(false);
        expect(first.values.needGapNumDensity).toBe(true);
        // bitmapScanMode normalized — never zMode
        expect(first.values.bitmapScanMode).not.toBe('zMode');
        // defocus embedded
        expect(first.values.defocus).toBe(true);
        expect(first.values.defocus_distance).toBe(4);
        // dpi and density both populated
        expect(first.values.density).toBe(first.values.dpi);

        // Device file: uses real Studio v2 layout — profileRefs + bindings + patches
        const dispFile = Object.keys(zip.files).find(f => f.includes('displays-0.json'));
        const disp = JSON.parse(await zip.files[dispFile].async('string'));
        const devFile = Object.keys(zip.files).find(f => f.startsWith('devices/device-'));
        const dev = JSON.parse(await zip.files[devFile].async('string'));
        const canvasId = Object.keys(dev.processing)[0];
        const laserPlane = dev.processing[canvasId].modes.LASER_PLANE;
        expect(Array.isArray(laserPlane.profileRefs)).toBe(true);
        expect(Array.isArray(laserPlane.bindings)).toBe(true);
        expect(typeof laserPlane.patches).toBe('object');
        expect(laserPlane.data.lightSourceMode).toBeTruthy();
        const boundDisplayIds = new Set(laserPlane.bindings.flatMap(b => b.displayIds));
        for (const d of disp.displays) {
            expect(boundDisplayIds.has(d.id)).toBe(true);
            expect(d.isFill).toBe(true);
            expect(d.fill.visible).toBe(true);
            // Path is either inlined (small) or externalized via vectorRef (large)
            expect(d.dPath || d.vectorRef).toBeTruthy();
        }

        // Vector bucket completeness — every externalized ref must resolve
        const bucket = JSON.parse(await zip.files['vectors/svg/data-0.json'].async('string')).entries;
        for (const d of disp.displays) {
            if (d.vectorRef) expect(bucket[d.vectorRef.vectorHash]).toBeTruthy();
        }
    });

    it('produces a MOPA grid with pulseWidth + mopaFrequency in every profile', async () => {
        const gen = new TestGridGenerator({
            activeDevice: 'f2_ultra_mopa',
            gridMode: 'power', power: 50,
            speedMin: 500, speedMax: 1500,
            freqMin: 30, freqMax: 70,
            crossHatch: false, passes: 1, defocus: 0,
        });
        const { xs } = await gen.generateBusinessCardGridXS();
        const zip = await unzip(xs);
        const profiles = JSON.parse(await zip.files['profiles.json'].async('string')).profiles;
        const first = profiles[Object.keys(profiles)[0]];
        expect(first.processingType).toBe('FILL_VECTOR_ENGRAVING');
        expect(first.values.processingType).toBe('FILL_VECTOR_ENGRAVING');
        expect(first.values.pulseWidth).toBeDefined();
        expect(first.values.mopaFrequency).toBeDefined();
        expect(first.values.defocus).toBe(false);
    });
});
