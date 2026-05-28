import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { XSGenerator } from './xs-generator.js';

const sampleLayers = () => ([
    {
        id: 'layer-1',
        name: 'Red Layer',
        visible: true,
        color: { r: 255, g: 0, b: 0 },
        paths: ['M0 0 L10 0 L10 10 L0 10 Z'],
        frequency: 50,
        lpi: 200,
    },
    {
        id: 'layer-2',
        name: 'Blue Layer',
        visible: true,
        color: { r: 0, g: 0, b: 255 },
        paths: ['M20 20 L30 20 L30 30 L20 30 Z'],
        frequency: 60,
        lpi: 300,
    },
]);

async function buildBuffer(settings = {}) {
    const gen = new XSGenerator({
        speed: 100, power: 20, passes: 1,
        ...settings,
    });
    const buf = await gen.generate({}, sampleLayers(), { width: 100, height: 100 });
    // Node path returns a Buffer
    return Buffer.isBuffer(buf) ? buf : Buffer.from(await buf.arrayBuffer());
}

async function buildFiles(settings = {}) {
    const gen = new XSGenerator({
        speed: 100, power: 20, passes: 1,
        ...settings,
    });
    return gen.generateFiles({}, sampleLayers(), { width: 100, height: 100 });
}

describe('XSGenerator', () => {
    it('produces a ZIP archive with the v2 magic and .format sentinel', async () => {
        const buf = await buildBuffer();
        expect(buf.slice(0, 4).toString('hex')).toBe('504b0304');

        const zip = await JSZip.loadAsync(buf);
        const fmt = await zip.file('.format').async('string');
        expect(fmt.startsWith('v2')).toBe(true);
    });

    it('writes meta + project.json with the expected schema', async () => {
        const buf = await buildBuffer();
        const zip = await JSZip.loadAsync(buf);

        const meta = JSON.parse(await zip.file('meta/persistence-meta.json').async('string'));
        expect(meta.schemaVersion).toBe('2.0.0');
        expect(meta.protocol).toBe('xcs-workspace-v2');

        const project = JSON.parse(await zip.file('project.json').async('string'));
        expect(project.__v2__).toBe(true);
        expect(project.schemaMeta.format).toBe('directory');
        expect(project.modules.canvases).toHaveLength(1);
        expect(project.modules.devices).toHaveLength(1);
    });

    it('externalizes dPaths into the SHA-256 vector bucket', async () => {
        const files = await buildFiles();
        const bucketKey = Object.keys(files).find(k => k.startsWith('canvases/') && k.endsWith('/displays-0.json'));
        expect(bucketKey).toBeDefined();

        const displays = files[bucketKey].displays;
        expect(displays.length).toBe(2);
        for (const d of displays) {
            expect(d.dPath).toBeUndefined();
            expect(d.vectorRef).toBeDefined();
            expect(d.vectorRef.bucketType).toBe('svg');
            expect(d.vectorRef.originalField).toBe('dPath');
            expect(/^[0-9a-f]{64}$/.test(d.vectorRef.vectorHash)).toBe(true);
        }

        const bucket = files['vectors/svg/data-0.json'].entries;
        for (const d of displays) {
            const stored = bucket[d.vectorRef.vectorHash];
            expect(typeof stored).toBe('string');
            // Round-trip: stored value must hash back to the referenced hash
            const recomputed = createHash('sha256').update(stored, 'utf-8').digest('hex');
            expect(recomputed).toBe(d.vectorRef.vectorHash);
        }

        const index = files['vectors/svg/index.json'];
        expect(index.bucketType).toBe('svg');
        expect(index.entryCount).toBe(Object.keys(bucket).length);
    });

    it('embeds defocus + defocus_distance in every profile', async () => {
        const files = await buildFiles({ defocus: 4 });
        const profiles = files['profiles.json'].profiles;
        const list = Object.values(profiles);
        expect(list.length).toBe(2);
        for (const p of list) {
            expect(p.values.defocus).toBe(true);
            expect(p.values.defocus_distance).toBe(4);
        }
    });

    it('disables defocus when explicitly set to 0', async () => {
        const files = await buildFiles({
            activeDevice: 'f2_ultra_mopa',
            activeLaserType: 'mopa',
            defocus: 0,
        });
        const profiles = Object.values(files['profiles.json'].profiles);
        for (const p of profiles) {
            expect(p.values.defocus).toBe(false);
        }
    });

    it('uses laser-type default defocus when nothing is configured (UV → 4mm)', async () => {
        const files = await buildFiles();
        const p = Object.values(files['profiles.json'].profiles)[0];
        expect(p.values.defocus).toBe(true);
        expect(p.values.defocus_distance).toBe(4);
    });

    it('does NOT include the legacy "raise focus" TEXT display', async () => {
        const files = await buildFiles();
        const bucketKey = Object.keys(files).find(k => k.startsWith('canvases/') && k.endsWith('/displays-0.json'));
        const displays = files[bucketKey].displays;
        const hasText = displays.some(d => d.type === 'TEXT');
        expect(hasText).toBe(false);
    });

    it('builds correct chunkLayout for a single chunk', async () => {
        const files = await buildFiles();
        const headerKey = Object.keys(files).find(k => k.startsWith('canvases/') && k.endsWith('.json') && !k.includes('displays-'));
        const header = files[headerKey];
        expect(header.chunkLayout.displayCount).toBe(2);
        expect(header.chunkLayout.chunkCount).toBe(1);
        expect(header.chunkLayout.chunkIndexes).toEqual([0]);
    });
});
