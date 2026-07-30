import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { XSGenerator } from './xs-generator.js';

// Small opaque byte blobs standing in for per-layer PNG masks. The generator
// only hashes and stores them verbatim, so exact contents are irrelevant here.
const fakePng = (seed) => new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    ...Array.from({ length: 48 }, (_, i) => (i * 7 + seed) & 0xff),
]);

const sampleLayers = () => ([
    { pngBytes: fakePng(1), pxWidth: 400, pxHeight: 200, color: { r: 255, g: 0, b: 0 }, name: 'Red', speed: 100, power: 20, passes: 1, frequency: 50, lpi: 200 },
    { pngBytes: fakePng(2), pxWidth: 400, pxHeight: 200, color: { r: 0, g: 0, b: 255 }, name: 'Blue', speed: 120, power: 30, passes: 2, frequency: 60, lpi: 3000 },
]);

async function buildColorEngrave(settings = {}, layers = sampleLayers()) {
    const gen = new XSGenerator({
        activeDevice: 'f2_ultra_uv', activeLaserType: 'uv',
        speed: 80, power: 10, passes: 1, frequency: 40, lpi: 100, dpi: 500,
        ...settings,
    });
    return gen.generateColorEngraveFiles(layers, { width: 100, height: 50 });
}

describe('XSGenerator.generateColorEngrave (per-layer)', () => {
    it('embeds one content-addressed PNG resource per layer with meta sidecars', async () => {
        const files = await buildColorEngrave();
        for (const seed of [1, 2]) {
            const hash = createHash('sha256').update(fakePng(seed)).digest('hex');
            const resPath = `resources/${hash}.png`;
            expect(files[resPath]).toBeInstanceOf(Uint8Array);
            expect(files[`${resPath}.meta.json`].metadata.kind).toBe('image');
        }
    });

    it('creates one BITMAP display per layer, each referencing its own PNG', async () => {
        const files = await buildColorEngrave();
        const canvasKey = Object.keys(files).find(k => k.endsWith('/displays-0.json'));
        const bitmaps = files[canvasKey].displays.filter(d => d.type === 'BITMAP');
        expect(bitmaps).toHaveLength(2);
        const paths = bitmaps.map(b => b.resourcePath);
        expect(new Set(paths).size).toBe(2); // distinct resources
        // All overlay at the origin in perfect registration
        for (const b of bitmaps) {
            expect(b.x).toBe(0);
            expect(b.y).toBe(0);
            expect(b.width).toBe(100);
            expect(b.height).toBe(50);
            expect(b.scale.x).toBeCloseTo(0.25, 6);
        }
        // Distinct layer colours
        expect(bitmaps[0].layerColor).not.toBe(bitmaps[1].layerColor);
    });

    it('creates one COLOR_ENGRAVE profile per layer carrying that layer settings', async () => {
        const files = await buildColorEngrave();
        const list = Object.values(files['profiles.json'].profiles);
        expect(list).toHaveLength(2);
        for (const p of list) {
            expect(p.processingType).toBe('COLOR_ENGRAVE');
            expect(p.values).not.toHaveProperty('defocus');
            expect(p.values).not.toHaveProperty('defocus_distance');
        }
        const densities = list.map(p => p.values.density).sort((a, b) => a - b);
        expect(densities).toEqual([200, 3000]); // per-layer lpc, supports up to 5000
        const speeds = list.map(p => p.values.speed).sort((a, b) => a - b);
        expect(speeds).toEqual([100, 120]);
    });

    it('binds each display to its own profile and lists them all in profileRefs', async () => {
        const files = await buildColorEngrave();
        const deviceKey = Object.keys(files).find(k => k.startsWith('devices/'));
        const mode = Object.values(files[deviceKey].processing)[0].modes.LASER_PLANE;
        expect(mode.profileRefs).toHaveLength(2);
        expect(mode.bindings).toHaveLength(2);
        const boundDisplayIds = mode.bindings.flatMap(b => b.displayIds);
        expect(new Set(boundDisplayIds).size).toBe(2);
    });

    it('lists one layerData entry per distinct colour', async () => {
        const files = await buildColorEngrave();
        const canvasHeaderKey = Object.keys(files).find(k => k.startsWith('canvases/') && k.endsWith('.json') && !k.includes('displays-'));
        const layerData = files[canvasHeaderKey].layerData;
        expect(Object.keys(layerData)).toHaveLength(2);
    });

    it('does NOT emit a vectors/ bucket', async () => {
        const files = await buildColorEngrave();
        expect(Object.keys(files).filter(k => k.startsWith('vectors/'))).toHaveLength(0);
    });

    it('adds a non-engraved focus-warning layer for UV in ignoredDisplayIds', async () => {
        const files = await buildColorEngrave();
        const canvasKey = Object.keys(files).find(k => k.endsWith('/displays-0.json'));
        const warning = files[canvasKey].displays.find(d => d.type === 'TEXT');
        expect(warning).toBeTruthy();
        const deviceKey = Object.keys(files).find(k => k.startsWith('devices/'));
        const mode = Object.values(files[deviceKey].processing)[0].modes.LASER_PLANE;
        expect(mode.ignoredDisplayIds).toContain(warning.id);
        expect(mode.bindings.flatMap(b => b.displayIds)).not.toContain(warning.id);
    });

    it('omits the focus-warning layer for lasers that do not need it (e.g. MOPA)', async () => {
        const files = await buildColorEngrave({ activeDevice: 'f2_ultra', activeLaserType: 'mopa' });
        const canvasKey = Object.keys(files).find(k => k.endsWith('/displays-0.json'));
        expect(files[canvasKey].displays.some(d => d.type === 'TEXT')).toBe(false);
    });

    it('includes frequency for lasers that have it (UV)', async () => {
        const files = await buildColorEngrave({ activeDevice: 'f2_ultra_uv', activeLaserType: 'uv' });
        for (const p of Object.values(files['profiles.json'].profiles)) {
            expect(p.values).toHaveProperty('frequency');
        }
    });

    it('omits frequency for the regular F2 (no frequency control)', async () => {
        const files = await buildColorEngrave({ activeDevice: 'f2', activeLaserType: 'ir' });
        for (const p of Object.values(files['profiles.json'].profiles)) {
            expect(p.processingType).toBe('COLOR_ENGRAVE');
            expect(p.values).not.toHaveProperty('frequency');
        }
    });

    it('produces a loadable ZIP with the v2 sentinel and round-trips PNGs', async () => {
        const gen = new XSGenerator({ activeDevice: 'f2_ultra_uv', activeLaserType: 'uv', speed: 80, power: 10, passes: 1, frequency: 40, lpi: 100 });
        const buf = await gen.generateColorEngrave(sampleLayers(), { width: 100, height: 50 });
        const nodeBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(await buf.arrayBuffer());
        expect(nodeBuf.slice(0, 4).toString('hex')).toBe('504b0304');
        const zip = await JSZip.loadAsync(nodeBuf);
        expect((await zip.file('.format').async('string')).startsWith('v2')).toBe(true);
        const hash = createHash('sha256').update(fakePng(1)).digest('hex');
        const stored = await zip.file(`resources/${hash}.png`).async('uint8array');
        expect(Buffer.from(stored)).toEqual(Buffer.from(fakePng(1)));
    });

    it('throws when no layers with image data are provided', async () => {
        const gen = new XSGenerator({ activeDevice: 'f2_ultra_uv', activeLaserType: 'uv' });
        await expect(gen.generateColorEngraveFiles([], { width: 100, height: 50 })).rejects.toThrow();
    });

    it('positions cells via xMm/yMm/widthMm/heightMm (test-grid layout)', async () => {
        const gen = new XSGenerator({ activeDevice: 'f2_ultra_uv', activeLaserType: 'uv', speed: 80, power: 10, lpi: 500 });
        const layers = [
            { pngBytes: fakePng(3), pxWidth: 100, pxHeight: 100, xMm: 12, yMm: 34, widthMm: 5, heightMm: 5, color: { r: 0, g: 0, b: 0 } },
            { pngBytes: fakePng(4), pxWidth: 100, pxHeight: 100, xMm: 20, yMm: 34, widthMm: 5, heightMm: 5, color: { r: 0, g: 0, b: 0 } },
        ];
        const files = await gen.generateColorEngraveFiles(layers, { width: 115, height: 115 });
        const canvasKey = Object.keys(files).find(k => k.endsWith('/displays-0.json'));
        const bitmaps = files[canvasKey].displays.filter(d => d.type === 'BITMAP');
        expect(bitmaps).toHaveLength(2);
        const cell = bitmaps[0];
        expect(cell.x).toBe(12);
        expect(cell.y).toBe(34);
        expect(cell.width).toBe(5);
        expect(cell.height).toBe(5);
        expect(cell.scale.x).toBeCloseTo(5 / 100, 6);
        expect(cell.transform).toEqual([5 / 100, 0, 0, 5 / 100, 12, 34]);
    });
});
