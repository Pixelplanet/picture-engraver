
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Main Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            // Define a dummy map for localStorage, as the app might expect it
            const dummyMap = {
                id: 'default-map',
                name: 'Default Map',
                settings: {
                    // Minimal settings to ensure the app doesn't break if it expects certain keys
                    threshold: 128,
                    invert: false,
                    dithering: 'none',
                    outputSize: { width: 100, height: 100 },
                    laserPower: 100,
                    laserSpeed: 1000,
                    passes: 1,
                    lineDirection: 'horizontal',
                    lineDistance: 0.1,
                    overscan: 0,
                    burnWhite: false,
                    gamma: 1.0,
                    contrast: 1.0,
                    brightness: 0,
                    sharpen: 0,
                    blur: 0,
                    edgeDetection: false,
                    edgeDetectionThreshold: 50,
                    edgeDetectionStrength: 1.0,
                    colorMode: 'grayscale',
                    colorMap: [],
                    colorTolerance: 0,
                    colorDithering: 'none',
                    colorDitheringThreshold: 128,
                    colorDitheringStrength: 1.0,
                    colorDitheringPattern: 'none',
                    colorDitheringPatternSize: 1,
                    colorDitheringPatternStrength: 1.0,
                    colorDitheringPatternThreshold: 128,
                    colorDitheringPatternInvert: false,
                    colorDitheringPatternInvertThreshold: 128,
                    colorDitheringPatternInvertStrength: 1.0,
                    colorDitheringPatternInvertPattern: 'none',
                    colorDitheringPatternInvertPatternSize: 1,
                    colorDitheringPatternInvertPatternStrength: 1.0,
                    colorDitheringPatternInvertPatternThreshold: 128,
                }
            };
            // The storage expects an array of maps
            localStorage.setItem('pictureEngraverSettings_maps', JSON.stringify([dummyMap]));

            // Bypass Onboarding Welcome Modal
            localStorage.setItem('pictureEngraver_onboarding', 'completed');
        });
        await page.goto('/');

        // Wait for any loading overlays to disappear
        // Assuming there might be a .loading or similar? 
        // If not, waiting for a key element to be enabled/visible is good practice.
        await expect(page.locator('#fileInput')).toBeAttached();
    });

    test('should show correct title and version', async ({ page }) => {
        await expect(page).toHaveTitle(/Picture Engraver/);
        await expect(page.locator('.header .title')).toHaveText('Picture Engraver');
        // Version is present in the UI
        await expect(page.locator('text=v1.7.3')).toBeAttached();
    });

    test('should upload image, process, and handle validation', async ({ page }) => {
        // 1. Upload
        // We need a dummy image. We can create a simple data URI or use a real file if available.
        // Playwright file chooser is easier with a real file.
        // Let's create a temporary dummy image file using node fs in a separate setup script or just drag-drop logic?
        // Actually, we can use the input[type=file] directly.

        // Create a dummy file in memory or assume one exists? 
        // We'll trust the repo has something or generate one fast.
        // Let's assume we can trigger the input with a buffer.

        await page.setInputFiles('#fileInput', {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
        });

        // 2. Wait for preview
        await expect(page.locator('#originalPreviewContainer')).toBeVisible();

        // 3. Process
        await page.click('#btnProcess');

        // 4. Verify Layers visible
        await expect(page.locator('.layers-list .layer-item')).toHaveCount(1); // 1x1 pixel = 1 color usually

        // 5. Verify Settings Pending state
        const downloadBtn = page.locator('#btnDownloadXCS');
        await expect(downloadBtn).toBeDisabled();
        await expect(page.locator('.layer-settings.pending')).toBeVisible();

        // 6. Auto Assign (Commented out until init script is active)
        // await page.click('#btnAutoAssign');

        // 7. Click Confirm if a modal/confirm appears? (It doesn't currently, just toast)
        // Wait for changes
        // await expect(page.locator('.layer-settings.pending')).not.toBeVisible({ timeout: 5000 });

        // 8. Download should be enabled
        // await expect(downloadBtn).toBeEnabled();
    });
});
