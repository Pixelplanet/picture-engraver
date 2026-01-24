import { XCSGenerator } from '../src/lib/xcs-generator.js';
import fs from 'fs';

console.log('Creating test XCS with simple rectangle...');

const generator = new XCSGenerator({
    power: 70,
    speed: 425,
    passes: 1,
    crossHatch: true
});

// Create a simple rectangle path
const simplePath = 'M0.000 0.000 L50.000 0.000 L50.000 30.000 L0.000 30.000 Z';

// Create a fake layer with our simple path
const testLayer = {
    name: 'Test Rectangle',
    color: { r: 200, g: 200, b: 200 },
    visible: true,
    frequency: 60,
    lpi: 250,
    outline: false,
    paths: [simplePath]
};

// Create fake image data
const fakeImageData = {
    width: 500, // 50mm * 10px/mm
    height: 300  // 30mm * 10px/mm
};

const size = { width: 100, height: 100 };

try {
    const xcsContent = generator.generate(fakeImageData, [testLayer], size);

    // Save to file
    fs.writeFileSync('testfile/TEST_SIMPLE_RECT.xcs', xcsContent);

    console.log('✓ Created TEST_SIMPLE_RECT.xcs');
    console.log('  - Contains a simple 50mm x 30mm rectangle');
    console.log('  - Path: ' + simplePath);
    console.log('  - If this renders as WIREFRAME, the problem is in XCS generation');
    console.log('  - If this renders as FILLED, the problem is in vectorization');

} catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error.stack);
}
