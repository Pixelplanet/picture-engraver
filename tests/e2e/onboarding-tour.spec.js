
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
        // We typically target the first one, which should have the ID now.
        const layerColor = page.locator('.layer-color.assigned').first();
        await expect(layerColor).toBeVisible();
        await layerColor.click();

        // 7. Pick a Calibrated Color
        // Sometimes the click on layerColor (Step 6) might trigger logic that advances or the picker click is simulated/handled fast.
        // Wait for EITHER step 7 or step 8.
        const tooltipText = await page.locator('.tour-tooltip').innerText();
        if (!tooltipText.includes('8. Changes Applied')) {
            await expect(page.locator('.tour-tooltip')).toContainText('7. Pick a Calibrated Color', { timeout: 10000 });
        }

        // Click a color in the mini picker canvas
        const pickerCanvas = page.locator('#miniPickerCanvas');
        await expect(pickerCanvas).toBeVisible();
        await pickerCanvas.click();

        // 8. Preview Results (Updated: was 9)
        await expect(page.locator('.tour-tooltip')).toContainText('8. Preview Results', { timeout: 10000 });
        await page.click('#tourNextBtn');

        // 9. Export (Updated: was 10)
        await expect(page.locator('.tour-tooltip')).toContainText('9. Export');

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

    test('should skip the onboarding tour when requested', async ({ page }) => {
        // 0. Welcome Modal
        await expect(page.locator('#welcomeModal')).toBeVisible();

        // Click "Accept & Skip"
        await page.click('#welcomeModal .btn-secondary'); // "Accept & Skip"

        // Modal should close
        await expect(page.locator('#welcomeModal')).toBeHidden();

        // Verify completed status in localStorage
        const status = await page.evaluate(() => localStorage.getItem('pictureEngraver_onboarding'));
        expect(status).toBe('completed');

        // Verify state by uploading: controls should be visible, tour hidden
        await page.setInputFiles('#fileInput', {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
        });

        // Controls should appear
        await expect(page.locator('#controlsSection')).toBeVisible();
        await expect(page.locator('#btnProcess')).toBeVisible();

        // Tour elements should NOT be present
        await expect(page.locator('.tour-tooltip')).toBeHidden();
    });
    test('should keep welcome modal buttons visible on small screens', async ({ page }) => {
        // Set a small viewport height
        await page.setViewportSize({ width: 800, height: 400 });
        await page.goto('/');

        // Welcome Modal should be visible
        await expect(page.locator('#welcomeModal')).toBeVisible();

        // Buttons should be visible and clickable
        const skipBtn = page.locator('#welcomeModal button:has-text("Accept & Skip")');
        const startBtn = page.locator('#welcomeModal button:has-text("Accept & Start Tour")');

        await expect(skipBtn).toBeInViewport();
        await expect(startBtn).toBeInViewport();
    });
});
