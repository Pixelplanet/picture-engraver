// Generate one .xs test grid per laser type for manual verification in Studio.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { TestGridGenerator } from '../src/lib/test-grid-generator.js';

const COMBOS = [
    { device: 'f2_ultra_uv',     laser: 'uv',          label: 'F2_Ultra_UV' },
    { device: 'f2_ultra_mopa',   laser: 'mopa',        label: 'F2_Ultra_MOPA' },
    { device: 'f2_ultra_mopa',   laser: 'blue_ultra',  label: 'F2_Ultra_Blue' },
    { device: 'f2_ultra_single', laser: 'mopa_single', label: 'F2_Ultra_MOPA_Single' },
    { device: 'f2',              laser: 'ir',          label: 'F2_IR' },
    { device: 'f2',              laser: 'blue_f2',     label: 'F2_Blue' },
];

const outDir = resolve('sample-xs-output');
mkdirSync(outDir, { recursive: true });

for (const c of COMBOS) {
    const gen = new TestGridGenerator({
        activeDevice: c.device,
        activeLaserType: c.laser,
        exportFormat: 'xs',
    });
    const { xs } = await gen.generateBusinessCardGridXS();
    const buf = Buffer.isBuffer(xs) ? xs : Buffer.from(await xs.arrayBuffer());
    const path = resolve(outDir, `TestGrid_${c.label}.xs`);
    writeFileSync(path, buf);
    console.log(`wrote ${path}  (${buf.length} bytes)`);
}
