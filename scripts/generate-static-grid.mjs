import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestGridGenerator } from '../src/lib/test-grid-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const outputFile = path.join(publicDir, 'default_test_grid.xcs');

// Ensure public dir exists
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating Default Test Grid XCS...');

// Create generator with default optimization settings (matching index.html defaults)
const generator = new TestGridGenerator({
    lpiMin: 300,
    lpiMax: 800,
    freqMin: 40,
    freqMax: 90,
    power: 70,
    speed: 425,
    cellSize: 5,
    cellGap: 1,
    highLpiMode: false
});

const { xcs, gridInfo } = generator.generateBusinessCardGrid();

fs.writeFileSync(outputFile, xcs);

console.log(`Success! Generated default_test_grid.xcs at ${outputFile}`);
console.log(`Grid Info: ${gridInfo.numCols}x${gridInfo.numRows}, ${gridInfo.totalCells} cells.`);
