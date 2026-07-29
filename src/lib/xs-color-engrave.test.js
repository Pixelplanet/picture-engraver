import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { XSGenerator } from './xs-generator.js';

// A small opaque byte blob standing in for PNG image data. The generator only
// hashes and stores it verbatim, so its exact contents are irrelevant here.
const fakePng = () => new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    ...Array.from({ length: 64 }, (_, i) => (i * 7) & 0xff),
]);

async function buildColorEngrave(settings = {}, image = {}) {
    const gen = new XSGenerator({
        activeDevice: 'f2_ultra_uv', activeLaserType: 'uv',
        speed: 80, power: 10, passes: 1, frequency: 40, lpi: 100, dpi: 500,
        ...settings,
    });
    const img = {
        pngBytes: fakePng(),
        pxWidth: 400,
        pxHeight: 200,
        ...image,
    };
    return gen.generateColorEngraveFiles(img, { width: 100, height: 50 });
}

describe('XSGenerator.generateColorEngrave', () => {
    it('embeds the image as a content-addressed PNG resource with a meta sidecar', async () => {
        const files = await buildColorEngrave();
        const png = fakePng();
        const hash = createHash('sha256').update(png).digest('hex');
        const resPath = `resources/${hash}.png`;

        expect(files[resPath]).toBeInstanceOf(Uint8Array);
        expect(Buffer.from(files[resPath])).toEqual(Buffer.from(png));

        const meta = files[`${resPath}.meta.json`];
        expect(meta.metadata.kind).toBe('image');
        expect(meta.metadata.source.value).toBe(`${hash}.png`);
    });

    it('creates a single BITMAP display referencing the PNG with correct placement', async () => {
        const files = await buildColorEngrave();
        const canvasKey = Object.keys(files).find(k => k.endsWith('/displays-0.json'));
        const { displays } = files[canvasKey];
        const bitmap = displays.find(d => d.type === 'BITMAP');

        expect(bitmap).toBeTruthy();
        expect(bitmap.resourcePath).toMatch(/^resources\/[0-9a-f]{64}\.png$/);
        expect(bitmap.originWidth).toBe(400);
        expect(bitmap.originHeight).toBe(200);
        // scale = widthMm / pxWidth = 100 / 400 = 0.25
        expect(bitmap.scale.x).toBeCloseTo(0.25, 6);
        expect(bitmap.scale.y).toBeCloseTo(0.25, 6);
        expect(bitmap.width).toBe(100);
        expect(bitmap.height).toBe(50);
        // dpi = 25.4 / scale
        expect(bitmap.dpi.dpiX).toBeCloseTo(25.4 / 0.25, 4);
    });

    it('uses the COLOR_ENGRAVE processing type with no defocus fields', async () => {
        const files = await buildColorEngrave({ speed: 120, power: 7, lpi: 3000, frequency: 55 });
        const profiles = files['profiles.json'].profiles;
        const ids = Object.keys(profiles);
        expect(ids).toHaveLength(1);
        const prof = profiles[ids[0]];

        expect(prof.processingType).toBe('COLOR_ENGRAVE');
        expect(prof.values.speed).toBe(120);
        expect(prof.values.power).toBe(7);
        expect(prof.values.density).toBe(3000); // lpc carried in density, supports up to 5000
        expect(prof.values.frequency).toBe(55);
        expect(prof.values.bitmapScanMode).toBe('zMode');
        expect(prof.values.bitmapEngraveMode).toBe('normal');
        expect(prof.values).not.toHaveProperty('defocus');
        expect(prof.values).not.toHaveProperty('defocus_distance');
    });

    it('does NOT emit a vectors/ bucket', async () => {
        const files = await buildColorEngrave();
        const vectorKeys = Object.keys(files).filter(k => k.startsWith('vectors/'));
        expect(vectorKeys).toHaveLength(0);
    });

    it('adds a non-engraved focus-warning layer for UV and lists it in ignoredDisplayIds', async () => {
        const files = await buildColorEngrave();
        const canvasKey = Object.keys(files).find(k => k.endsWith('/displays-0.json'));
        const { displays } = files[canvasKey];
        const warning = displays.find(d => d.type === 'TEXT');
        expect(warning).toBeTruthy();
        expect(warning.text).toContain('raise');
        expect(warning.text).toContain('4mm');

        const deviceKey = Object.keys(files).find(k => k.startsWith('devices/'));
        const mode = Object.values(files[deviceKey].processing)[0].modes.LASER_PLANE;
        expect(mode.ignoredDisplayIds).toContain(warning.id);
        // The warning is not bound to any engraving profile
        const boundIds = mode.bindings.flatMap(b => b.displayIds);
        expect(boundIds).not.toContain(warning.id);
    });

    it('omits the focus-warning layer for lasers that do not need it (e.g. MOPA)', async () => {
        const files = await buildColorEngrave({ activeDevice: 'f2_ultra', activeLaserType: 'mopa' });
        const canvasKey = Object.keys(files).find(k => k.endsWith('/displays-0.json'));
        const { displays } = files[canvasKey];
        expect(displays.some(d => d.type === 'TEXT')).toBe(false);
    });

    it('produces a loadable ZIP with the v2 sentinel', async () => {
        const gen = new XSGenerator({
            activeDevice: 'f2_ultra_uv', activeLaserType: 'uv',
            speed: 80, power: 10, passes: 1, frequency: 40, lpi: 100,
        });
        const buf = await gen.generateColorEngrave(
            { pngBytes: fakePng(), pxWidth: 400, pxHeight: 200 },
            { width: 100, height: 50 },
        );
        const nodeBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(await buf.arrayBuffer());
        expect(nodeBuf.slice(0, 4).toString('hex')).toBe('504b0304');
        const zip = await JSZip.loadAsync(nodeBuf);
        expect((await zip.file('.format').async('string')).startsWith('v2')).toBe(true);
        // PNG round-trips through the ZIP as binary
        const png = fakePng();
        const hash = createHash('sha256').update(png).digest('hex');
        const stored = await zip.file(`resources/${hash}.png`).async('uint8array');
        expect(Buffer.from(stored)).toEqual(Buffer.from(png));
    });
});
