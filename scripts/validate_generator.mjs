import { XCSGenerator } from '../src/lib/xcs-generator.js';

const gen = new XCSGenerator({});
// Create a sample display used for vector layers
const display = gen.createPathDisplayWithPath('id', 'name', '#000000', 0, 0, 0, 100, 100, 1, 'M0 0 Z');

console.log('--- CURRENT GENERATOR CONFIG ---');
console.log(`Stroke Visible: ${display.stroke.visible} (Expected: false)`);
console.log(`Fill Rule:      ${display.fillRule} (Expected: nonzero)`);
console.log(`Is Compound:    ${display.isCompoundPath} (Expected: true)`);
console.log(`Stroke Width:   ${display.stroke.width} (Expected: 0.1)`);
console.log('------------------------------');
