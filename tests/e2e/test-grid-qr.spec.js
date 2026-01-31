
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Test Grid QR Code Verification', () => {
    test.beforeEach(async ({ page }) => {
        // Bypass onboarding and set default device to avoid landing page selection
        await page.addInitScript(() => {
            localStorage.setItem('pictureEngraver_onboarding', 'completed');
            localStorage.setItem('pictureEngraver_onboarding_testgrid', 'completed');
            localStorage.setItem('pictureEngraverSettings', JSON.stringify({
                activeDevice: 'f2_ultra_uv',
                power: 70,
                speed: 425,
                passes: 1,
                freqMin: 40,
                freqMax: 80,
                lpiMin: 300,
                lpiMax: 2000
            }));
        });

        await page.goto('/');

        // Wait for page to be ready
        await expect(page.locator('#btnTestGrid')).toBeVisible();

        // Inject jsQR for decoding tests (Absolute path for reliability)
        const jsQRPath = path.resolve('node_modules/jsqr/dist/jsQR.js');
        await page.addScriptTag({ path: jsQRPath });
    });

    test('should render a valid decodable QR code on the Standard Grid', async ({ page }) => {
        // Open Test Grid Modal
        await page.click('#btnTestGrid');
        await expect(page.locator('#testGridModal')).toBeVisible();

        // Ensure we are on Standard tab
        await expect(page.locator('#tabStandard')).toBeVisible();

        // Give it a moment to render the canvas
        await page.waitForTimeout(1000);

        const decodedData = await page.evaluate(() => {
            const canvas = document.getElementById('standardPreviewCanvas');
            if (!canvas) return { error: 'Canvas not found' };

            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // @ts-ignore - jsQR is injected via script tag
            const code = window.jsQR(imageData.data, imageData.width, imageData.height);
            return code ? { success: true, data: code.data } : { success: false, error: 'QR not found or not decodable' };
        });

        expect(decodedData.success, `QR decoding failed: ${decodedData.error}`).toBe(true);

        // Verify QR content matches expected settings (Standard UV)
        // Expected data format: {"v":1,"l":[2000,500,14],"f":[40,80,9],"p":70,"s":425,"t":"uv"}
        const qrContent = JSON.parse(decodedData.data);
        expect(qrContent.v).toBe(1);
        expect(qrContent.t).toBe('uv');
        expect(qrContent.p).toBe(70);
        expect(qrContent.s).toBe(425);
    });

    test('should render a valid decodable QR code on the Custom Grid after updating parameters', async ({ page }) => {
        // Open Test Grid Modal
        await page.click('#btnTestGrid');
        await expect(page.locator('#testGridModal')).toBeVisible();

        // Switch to Custom Tab
        await page.click('button[data-modal-tab="custom"]');
        await expect(page.locator('#tabCustom')).toBeVisible();

        // Fill custom values
        await page.fill('#gridFreqMin', '55');
        await page.fill('#gridFreqMax', '95');
        await page.fill('#gridPower', '85');

        // Refresh Preview
        await page.click('#btnPreviewGrid');

        // Small wait for animation/rendering
        await page.waitForTimeout(1000);

        const decodedData = await page.evaluate(() => {
            const canvas = document.getElementById('gridPreviewCanvas');
            if (!canvas) return { error: 'Canvas not found' };

            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // @ts-ignore - jsQR is injected
            const code = window.jsQR(imageData.data, imageData.width, imageData.height);
            return code ? { success: true, data: code.data } : { success: false, error: 'QR not found on custom grid' };
        });

        expect(decodedData.success, `Custom QR decoding failed: ${decodedData.error}`).toBe(true);

        const qrContent = JSON.parse(decodedData.data);
        // f: [freqMin, freqMax, numRows]
        expect(qrContent.f[0]).toBe(55);
        expect(qrContent.f[1]).toBe(95);
        expect(qrContent.p).toBe(85);
    });
});
