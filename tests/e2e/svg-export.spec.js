import { test, expect } from '@playwright/test';

// Use a fresh storage state for each test
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('SVG Export Virtual Device', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('pictureEngraver_onboarding', 'completed');
        });
    });

    test('should show SVG Export option on landing page', async ({ page }) => {
        await page.goto('/');
        const overlay = page.locator('#deviceSelectionOverlay');
        await expect(overlay).toBeVisible({ timeout: 10000 });
        const svgExportBtn = page.locator('button[data-id="svg_export"]');
        await expect(svgExportBtn).toBeVisible();
    });

    test('should hide laser-specific UI when SVG Export is selected', async ({ page }) => {
        await page.goto('/');
        const svgBtn = page.locator('button[data-id="svg_export"]');
        await expect(svgBtn).toBeVisible({ timeout: 10000 });
        await svgBtn.click();
        await expect(page.locator('#deviceSelectionOverlay')).toBeHidden({ timeout: 5000 });
        await expect(page.locator('.device-badge')).toContainText('SVG Vector Export');

        // Buttons that should be hidden
        await expect(page.locator('#btnTestGrid')).toBeHidden();
        await expect(page.locator('#btnAutoAssign')).toBeHidden();
        await expect(page.locator('#btnHelp')).toBeHidden();
        await expect(page.locator('#btnSettings')).toBeHidden();

        const exportBtn = page.locator('#btnDownloadXCS');
        await expect(exportBtn).toContainText('Download SVG');
        await expect(exportBtn).toBeEnabled();
    });

    test('should show simple color picker in layer edit modal for SVG mode', async ({ page }) => {
        await page.goto('/');

        // Select SVG Export device
        await page.locator('button[data-id="svg_export"]').click();
        await expect(page.locator('#deviceSelectionOverlay')).toBeHidden({ timeout: 5000 });

        // Upload distinct red square image (16x16)
        await page.setInputFiles('#fileInput', {
            name: 'red_square.png',
            mimeType: 'image/png',
            buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEUlEQVR42mP8z8BQz0AEYBxWAAX/A/2Y1M1wAAAAAElFTkSuQmCC', 'base64')
        });

        // Wait for preview
        await expect(page.locator('#originalPreviewContainer')).toBeVisible({ timeout: 5000 });

        // Use custom small size to make processing fast
        await page.selectOption('#sizeSelect', 'custom');
        await page.fill('#customWidth', '20'); // 20mm

        // Wait for button to be interactive
        const processBtn = page.locator('#btnProcess');
        await expect(processBtn).toBeEnabled();

        // Process image
        await processBtn.click();

        // Wait for layers to appear
        await expect(page.locator('.layers-list .layer-item').first()).toBeVisible({ timeout: 30000 });

        // Export button should be enabled immediately after processing in SVG mode
        const exportBtn = page.locator('#btnDownloadXCS');
        await expect(exportBtn).toBeEnabled();

        // Click on a layer's color box to open edit modal
        await page.locator('.layer-item .layer-color.assigned').first().click();

        // Verify Layer Edit Modal opens
        const editModal = page.locator('#layerEditModal');
        await expect(editModal).toBeVisible({ timeout: 5000 });

        // Verify HTML5 color picker is present (SVG mode shows simple picker)
        const colorPicker = editModal.locator('input[type="color"]');
        await expect(colorPicker).toBeVisible();

        // Verify Frequency input field is hidden (SVG mode hides laser settings)
        await expect(page.locator('#layerEditFreq')).not.toBeVisible();
    });

    test('should maintain laser UI when UV device is selected', async ({ page }) => {
        await page.goto('/');
        await page.locator('button[data-id="f2_ultra_uv"]').click();
        await expect(page.locator('#deviceSelectionOverlay')).toBeHidden({ timeout: 5000 });
        await expect(page.locator('.device-badge')).toContainText('F2 Ultra (UV)');
        await expect(page.locator('#btnTestGrid')).toBeVisible();
        await expect(page.locator('#btnAutoAssign')).toBeAttached();
        await expect(page.locator('#btnDownloadXCS')).toContainText('Download XCS');
    });

    test('should allow switching from UV to SVG device via badge click', async ({ page }) => {
        await page.goto('/');
        await page.locator('button[data-id="f2_ultra_uv"]').click();
        await expect(page.locator('#deviceSelectionOverlay')).toBeHidden({ timeout: 5000 });
        await expect(page.locator('.device-badge')).toContainText('F2 Ultra (UV)');

        // Click on badge to switch device
        await page.click('.device-badge');

        // Landing page should reappear
        const overlay = page.locator('#deviceSelectionOverlay');
        await expect(overlay).toBeVisible({ timeout: 5000 });

        // Now select SVG Export
        await page.locator('button[data-id="svg_export"]').click();
        await expect(overlay).toBeHidden({ timeout: 5000 });

        // Verify SVG mode is now active
        await expect(page.locator('.device-badge')).toContainText('SVG Vector Export');
    });
});
