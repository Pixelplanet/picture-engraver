
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Main Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            // Bypass Onboarding Welcome Modal
            localStorage.setItem('pictureEngraver_onboarding', 'completed');
        });
        await page.goto('/');

        // Select UV device to get to the main app
        const uvBtn = page.locator('button[data-id="f2_ultra_uv"]');
        await expect(uvBtn).toBeVisible({ timeout: 10000 });
        await uvBtn.click();
        await expect(page.locator('#deviceSelectionOverlay')).toBeHidden({ timeout: 5000 });
    });

    test('should show correct title and version', async ({ page }) => {
        await expect(page).toHaveTitle(/Picture Engraver/);
        await expect(page.locator('.header .title')).toHaveText('Picture Engraver');
        // Version is present in the UI - Update to match 2.0.0
        await expect(page.locator('text=v2.0.0')).toBeAttached();
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
