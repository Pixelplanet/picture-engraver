import { describe, it, expect } from 'vitest';
import { XCSGenerator } from './xcs-generator.js';

describe('XCSGenerator', () => {
    const generator = new XCSGenerator({
        speed: 100,
        power: 20,
        passes: 1
    });

    describe('calculateBoundsAndTighten', () => {
        it('should shift path to 0,0 and calculate bounds', () => {
            // Rect from (10, 10) to (20, 20)
            const path = "M10 10 L20 10 L20 20 L10 20 Z";
            const result = generator.calculateBoundsAndTighten(path);

            expect(result.bounds).toEqual({
                x: 10,
                y: 10,
                width: 10,
                height: 10
            });

            // Shifted path should start at 0,0
            expect(result.dPath).toBe("M0.000 0.000 L10.000 0.000 L10.000 10.000 L0.000 10.000 Z");
        });
    });

    describe('generate', () => {
        it('should generate a valid XCS structure', () => {
            const layers = [{
                id: 'layer-1',
                name: 'Red Layer',
                visible: true,
                color: { r: 255, g: 0, b: 0 },
                paths: ["M0 0 L10 0 L10 10 L0 10 Z"],
                frequency: 50,
                lpi: 200
            }];

            const output = generator.generate({}, layers, { width: 100, height: 100 });
            const json = JSON.parse(output);

            expect(json).toHaveProperty('canvasId');
            expect(json.canvas).toHaveLength(1);
            expect(json.extName).toBe('F2 Ultra UV');

            // Check display settings
            const deviceData = json.device; // This is a map in object form or something? 
            // check generateDeviceData implementation: returns object { id, power, data: { value: [ [canvasId, {...}] ] } }
            expect(deviceData.id).toBe('GS009-CLASS-4');
        });

        it('should generate valid MOPA XCS structure', () => {
            const mopaGenerator = new XCSGenerator({
                speed: 1000,
                power: 14,
                activeDevice: 'f2_ultra_mopa',
                pulseWidth: 80
            });

            const layers = [{
                id: 'layer-1',
                name: 'Black Layer',
                visible: true,
                color: { r: 0, g: 0, b: 0 },
                paths: ["M0 0 L10 0 L10 10 L0 10 Z"],
                frequency: 400,
                lpi: 500
            }];

            const output = mopaGenerator.generate({}, layers, { width: 100, height: 100 });
            const json = JSON.parse(output);

            expect(json.extName).toBe('F2 Ultra (MOPA)');

            // Check MOPA device ID
            const deviceData = json.device;
            expect(deviceData.id).toBe('GS009-CLASS-1');

            // Extract the deep nested customize object to verify MOPA parameters
            const canvasId = json.canvasId;
            const deviceMapValue = deviceData.data.value;
            const canvasSettings = deviceMapValue.find(item => item[0] === canvasId);
            const laserPlaneData = canvasSettings[1].data.LASER_PLANE;

            expect(laserPlaneData.lightSourceMode).toBe('red');

            // Check if pulseWidth is injected into the display settings
            const displaysMap = canvasSettings[1].displays.value;
            // displaysMap is [[displayId, settingsString], ...]
            // We need to parse the settings string of the first display
            const firstDisplaySettingsStr = displaysMap[0][1];
            // The settings string is actually a JSON string inside the string? or just an object?
            // createDisplaySettings returns an OBJECT associated with the display ID in the map.
            // Wait, createDisplaySettings returns an object.
            // generateDeviceData: displaySettingsMap.set(display.id, displaySettings);

            // In the displaySettingsMap (which becomes value in JSON), it's [id, object]
            const firstDisplaySettings = firstDisplaySettingsStr;

            // The structure is deep: FILL_VECTOR_ENGRAVING.parameter.customize
            const customize = firstDisplaySettings.data.FILL_VECTOR_ENGRAVING.parameter.customize;

            expect(customize.pulseWidth).toBe(80);
            expect(customize.processingLightSource).toBe('red');
        });
    });
});
