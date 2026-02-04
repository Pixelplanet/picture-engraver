
import { test, expect } from '@playwright/test';

test.describe('Onboarding Tour', () => {
    test.beforeEach(async ({ page }) => {
        // Clear local storage to trigger onboarding
        await page.addInitScript(() => {
            localStorage.clear();
        });
        await page.goto('/');

        // Select UV device to get to the main app if the selection overlay appears
        // Using a more robust check or just click if visible
        try {
            const uvBtn = page.locator('button[data-id="f2_ultra_uv"]');
            if (await uvBtn.isVisible({ timeout: 2000 })) {
                await uvBtn.click();
            }
        } catch (e) {
            // Ignore timeout, maybe overlay didn't appear
        }
    });

    test('should complete the main onboarding tour', async ({ page }) => {
        // 0. Welcome Modal
        await expect(page.locator('#welcomeModal')).toBeVisible();
        await page.click('#welcomeModal .btn-primary'); // "Accept & Start Tour"

        // 1. Upload Image
        await expect(page.locator('.tour-tooltip')).toContainText('1. Upload Image');
        await expect(page.locator('.tour-highlight')).toBeVisible();

        // Perform Upload
        await page.setInputFiles('#fileInput', {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
        });

        // 2. Adjust Settings
        await expect(page.locator('.tour-tooltip')).toContainText('2. Adjust Settings', { timeout: 10000 });
        await page.click('#tourNextBtn');

        // 3. Process
        await expect(page.locator('.tour-tooltip')).toContainText('3. Process');
        await page.click('#btnProcess');

        // 4. Layer Overview
        await expect(page.locator('.tour-tooltip')).toContainText('4. Layer Overview', { timeout: 10000 });
        await page.click('#tourNextBtn');

        // 5. Auto-Assign
        await expect(page.locator('.tour-tooltip')).toContainText('5. Auto-Assign Calibration');
        await page.click('#btnAutoAssign');

        // 6. Manual Fine-Tuning
        await expect(page.locator('.tour-tooltip')).toContainText('6. Manual Fine-Tuning');

        // Find a assigned layer color and click it
        // The previous step 'Auto-Assign' should have assigned colors.
        // We'll wait for the tooltip to settle, then click.
        const layerColor = page.locator('.layer-color.assigned').first();
        await expect(layerColor).toBeVisible();
        await layerColor.click();

        // 7. Pick a Calibrated Color
        await expect(page.locator('.tour-tooltip')).toContainText('7. Pick a Calibrated Color', { timeout: 10000 });

        // Click a color in the mini picker canvas
        const pickerCanvas = page.locator('#miniPickerCanvas');
        await expect(pickerCanvas).toBeVisible();
        await pickerCanvas.click();

        // 8. Changes Applied
        await expect(page.locator('.tour-tooltip')).toContainText('8. Changes Applied', { timeout: 10000 });
        // Step 8 is auto-triggered in main.js, so we might see it briefly.
        // But for the test, we can just wait for Step 9 or click Next if it's not auto-advancing.
        // Actually, window.onboarding.nextStep() is called by handleAction if it's not waiting.
        // In onboarding.js, handleAction calls nextStep() if action matches.

        // 9. Preview Results
        await expect(page.locator('.tour-tooltip')).toContainText('9. Preview Results', { timeout: 10000 });
        await page.click('#tourNextBtn');

        // 10. Export
        await expect(page.locator('.tour-tooltip')).toContainText('10. Export');

        // Check "Waiting for action..." state if the test logic in app sets it.
        // Logic in app: waitForAction: 'download'

        // Click Download
        await page.click('#btnDownloadXCS');

        // Tour should end and success message/or just tour finish
        // The tooltip might change to "Success" briefly or just disappear
        // Let's verify it disappears or the "Finish" button appears?
        // Wait, after 'download', handleAction('download') is called.
        // This is the last step.
        // src/lib/onboarding.js: 
        // if (this.currentStepIndex === this.tourSteps.length - 1) { setTimeout(() => this.endTour(), 600); }

        await expect(page.locator('.tour-tooltip')).toBeHidden({ timeout: 5000 });

        // Verify completed status
        const status = await page.evaluate(() => localStorage.getItem('pictureEngraver_onboarding'));
        expect(status).toBe('completed');
    });
});
