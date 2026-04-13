import { describe, it, expect } from 'vitest';
import { TestGridGenerator } from './test-grid-generator.js';

describe('TestGridGenerator', () => {
    const generator = new TestGridGenerator();

    describe('generateQRPath', () => {
        it('should generate a complex path for a valid string', () => {
            const path = generator.generateQRPath('test-string', 10, 10, 10);

            // A QR code path should have many 'M' (move to) commands for the bits
            // If it's the 1x1 fallback, it only has one M.
            const moveCount = (path.match(/M/g) || []).length;

            // Version 1 (smallest) has 21x21 modules = 441. 
            // Even if many are white, black modules should be > 100.
            expect(moveCount).toBeGreaterThan(50);
            expect(path).toContain('M10');
        });

        it('should handle special characters in strings', () => {
            const json = JSON.stringify({ v: 1, l: [2000, 500, 14], f: [40, 90, 8], p: 70, s: 425, t: 'uv' });
            const path = generator.generateQRPath(json, 0, 0, 20);

            const moveCount = (path.match(/M/g) || []).length;
            expect(moveCount).toBeGreaterThan(100);
        });
    });

    describe('linspace', () => {
        it('should generate evenly spaced values', () => {
            const vals = generator.linspace(0, 100, 5);
            expect(vals).toEqual([0, 25, 50, 75, 100]);
        });

        it('should return single value for steps=1', () => {
            expect(generator.linspace(42, 100, 1)).toEqual([42]);
        });
    });

    describe('encodeSettings', () => {
        it('should encode UV settings as v2', () => {
            const gen = new TestGridGenerator({
                activeDevice: 'f2_ultra_uv',
                lpiMax: 2000, lpiMin: 500,
                freqMin: 40, freqMax: 90,
                power: 70, speed: 425
            });
            const json = gen.encodeSettings(14, 9);
            const data = JSON.parse(json);

            expect(data.v).toBe(2);
            expect(data.t).toBe('uv');
            expect(data.l).toEqual([2000, 500, 14]);
            expect(data.f).toEqual([40, 90, 9]);
            expect(data.p).toBe(70);
            expect(data.s).toBe(425);
            expect(data.m).toBe('stainless_304');
        });

        it('should encode MOPA settings as v4', () => {
            const gen = new TestGridGenerator({
                activeDevice: 'f2_ultra_mopa',
                gridMode: 'power',
                power: 50,
                speedMin: 500, speedMax: 1500,
                freqMin: 30, freqMax: 70
            });
            const json = gen.encodeSettings(14, 9);
            const data = JSON.parse(json);

            expect(data.v).toBe(4);
            expect(data.t).toBe('mopa');
            expect(data.ax).toBe('p');
            expect(data.m).toBe('stainless_304');
        });

        it('should encode mopa_single as mopa type', () => {
            const gen = new TestGridGenerator({
                activeDevice: 'f2_ultra_single',
                gridMode: 'frequency',
                freq: 200,
                speedMin: 200, speedMax: 1200,
                powerMin: 14, powerMax: 14
            });
            const json = gen.encodeSettings(14, 9);
            const data = JSON.parse(json);

            expect(data.v).toBe(4);
            expect(data.t).toBe('mopa');
        });

        it('should encode IR device as UV type (non-MOPA)', () => {
            const gen = new TestGridGenerator({
                activeDevice: 'f2',
                lpiMax: 1000, lpiMin: 200,
                freqMin: 20, freqMax: 100,
                power: 50, speed: 200
            });
            const json = gen.encodeSettings(10, 8);
            const data = JSON.parse(json);

            expect(data.v).toBe(2);
            expect(data.t).toBe('uv');
        });
    });

    describe('createDisplaySettings', () => {
        it('should create UV-like settings without mopaFrequency', () => {
            const settings = generator.createDisplaySettings(50, 1000, 70, 425, 1);
            expect(settings.processingType).toBe('FILL_VECTOR_ENGRAVING');
            expect(settings.data.COLOR_FILL_ENGRAVE).toBeUndefined();
        });

        it('should create MOPA-like settings with mopaFrequency', () => {
            const settings = generator.createDisplaySettings(200, 5000, 14, 400, 1, {
                mopaFrequency: 200,
                pulseWidth: 80,
                processingLightSource: 'red',
                _planType: 'red'
            });
            expect(settings.processingType).toBe('COLOR_FILL_ENGRAVE');
            expect(settings.data.COLOR_FILL_ENGRAVE).toBeDefined();
            expect(settings.data.COLOR_FILL_ENGRAVE.planType).toBe('red');
        });

        it('should strip _planType from XCS output', () => {
            const settings = generator.createDisplaySettings(200, 5000, 14, 400, 1, {
                mopaFrequency: 200,
                _planType: 'red'
            });
            const customize = settings.data.FILL_VECTOR_ENGRAVING.parameter.customize;
            expect(customize._planType).toBeUndefined();
        });
    });

    describe('generateBusinessCardGrid', () => {
        it('should generate a UV grid with valid XCS structure', () => {
            const gen = new TestGridGenerator({
                activeDevice: 'f2_ultra_uv',
                cardWidth: 86, cardHeight: 54,
                cellSize: 5, cellGap: 1, margin: 1
            });
            const result = gen.generateBusinessCardGrid();

            expect(result.xcs).toBeTruthy();
            expect(result.gridInfo).toBeDefined();
            expect(result.gridInfo.numCols).toBeGreaterThan(0);
            expect(result.gridInfo.numRows).toBeGreaterThan(0);
            expect(result.gridInfo.totalCells).toBeGreaterThan(0);

            const xcs = JSON.parse(result.xcs);
            expect(xcs.extName).toBe('F2 Ultra UV');
            expect(xcs.extId).toBe('GS009-CLASS-4');
        });

        it('should redirect to generateMopaGrid for MOPA device', () => {
            const gen = new TestGridGenerator({
                activeDevice: 'f2_ultra_mopa',
                cardWidth: 86, cardHeight: 54,
                cellSize: 5, cellGap: 1, margin: 1,
                gridMode: 'power',
                power: 14,
                speedMin: 200, speedMax: 1200,
                freqMin: 200, freqMax: 1200
            });
            const result = gen.generateBusinessCardGrid();

            expect(result.xcs).toBeTruthy();
            expect(result.gridInfo.gridMode).toBe('power');

            const xcs = JSON.parse(result.xcs);
            expect(xcs.extName).toBe('F2 Ultra (MOPA)');
            expect(xcs.extId).toBe('GS009-CLASS-1');
        });

        it('should generate correct grid for F2 Ultra Single', () => {
            const gen = new TestGridGenerator({
                activeDevice: 'f2_ultra_single',
                cardWidth: 86, cardHeight: 54,
                cellSize: 5, cellGap: 1, margin: 1,
                gridMode: 'frequency',
                freq: 200,
                speedMin: 200, speedMax: 1200,
                powerMin: 50, powerMax: 70
            });
            const result = gen.generateBusinessCardGrid();

            const xcs = JSON.parse(result.xcs);
            expect(xcs.extName).toBe('F2 Ultra (Single)');
            expect(xcs.extId).toBe('GS007-CLASS-4');
        });

        it('should generate grid for F2 IR device', () => {
            const gen = new TestGridGenerator({
                activeDevice: 'f2',
                cardWidth: 86, cardHeight: 54,
                cellSize: 5, cellGap: 1, margin: 1
            });
            const result = gen.generateBusinessCardGrid();

            const xcs = JSON.parse(result.xcs);
            expect(xcs.extName).toBe('F2');
            expect(xcs.extId).toBe('GS006');
        });

        it('should include QR code in grid output', () => {
            const gen = new TestGridGenerator({ activeDevice: 'f2_ultra_uv' });
            const result = gen.generateBusinessCardGrid();

            expect(result.gridInfo.qrData).toBeTruthy();
            expect(result.gridInfo.qrSize).toBe(17);

            // Parse to ensure QR display is present
            const xcs = JSON.parse(result.xcs);
            const displays = xcs.canvas[0].displays;
            const qrDisplay = displays.find(d => d.name === 'Settings QR Code');
            expect(qrDisplay).toBeDefined();
        });
    });

    describe('generateMopaGrid', () => {
        it('should return grid info with correct axis labels per mode', () => {
            const modes = [
                { mode: 'frequency', xLabel: 'Speed', yLabel: 'Power' },
                { mode: 'power', xLabel: 'Speed', yLabel: 'Freq' },
                { mode: 'speed', xLabel: 'Power', yLabel: 'Freq' }
            ];

            for (const { mode, xLabel, yLabel } of modes) {
                const gen = new TestGridGenerator({
                    activeDevice: 'f2_ultra_mopa',
                    gridMode: mode,
                    freq: 200, power: 14, speed: 400,
                    speedMin: 200, speedMax: 1200,
                    freqMin: 200, freqMax: 1200,
                    powerMin: 10, powerMax: 90,
                    cardWidth: 86, cardHeight: 54,
                    cellSize: 5, cellGap: 1, margin: 1
                });

                const result = gen.generateMopaGrid('test-canvas', Date.now());
                expect(result.gridInfo.xAxisLabel).toContain(xLabel);
                expect(result.gridInfo.yAxisLabel).toContain(yLabel);
            }
        });

        it('should use blue_ultra laser config when specified', () => {
            const gen = new TestGridGenerator({
                activeDevice: 'f2_ultra_mopa',
                activeLaserType: 'blue_ultra',
                gridMode: 'power',
                power: 40,
                speedMin: 10, speedMax: 500,
                freqMin: 20, freqMax: 100,
                cardWidth: 86, cardHeight: 54,
                cellSize: 5, cellGap: 1, margin: 1
            });
            const result = gen.generateMopaGrid('test-canvas', Date.now());
            const xcs = JSON.parse(result.xcs);
            expect(xcs.extName).toBe('F2 Ultra');
            expect(xcs.extId).toBe('GS004-CLASS-4');
        });
    });
});
