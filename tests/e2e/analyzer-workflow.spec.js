
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Analyzer Workflow', () => {
    test.setTimeout(60000); // 1 minute timeout

    test('should process unrotated testgrid image, rotate 3 times, verify manual settings, and export valid map', async ({ page }) => {
        // Capture console logs
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('DEBUG')) {
                console.log(`PAGE LOG: ${msg.text()}`);
            }
        });

        // 1. Initial Setup
        await page.goto('/');

        // Brute force hide potential blockers to ensure stable test
        await page.addStyleTag({ content: '#welcomeModal, #testGridInfoModal, .modal-backdrop { display: none !important; }' });

        // Handle Device Selection Overlay if present
        const deviceOverlay = page.locator('#deviceSelectionOverlay');
        if (await deviceOverlay.isVisible()) {
            console.log('PAGE LOG: Handling Device Selection Overlay');
            await page.locator('.device-btn').first().click();
            await expect(deviceOverlay).not.toBeVisible();
            await page.waitForTimeout(1000);
        }

        // 2. Open Test Grid Modal -> Analyzer Tab
        await page.getByRole('button', { name: 'Test Grid' }).click();
        await page.locator('[data-modal-tab="analyzer"]').click();

        // 3. Upload File
        const filePath = path.join(process.cwd(), 'testgrid picture.jpg');
        if (!fs.existsSync(filePath)) {
            test.skip('Test image "testgrid picture.jpg" not found.');
        }

        const fileChooserPromise = page.waitForEvent('filechooser');
        console.log('PAGE LOG: Uploading image...');
        await page.locator('#analyzerDropZone').click({ force: true });
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePath);

        // 4. Verify Image Loaded and Rotate 3 TIMES (until QR is in bottom right)
        await expect(page.locator('#analyzerCanvas')).toBeVisible();
        console.log('PAGE LOG: Rotating image 3 times...');
        await page.locator('#btnRotateAnalyzer').click();
        await page.waitForTimeout(500);
        await page.locator('#btnRotateAnalyzer').click();
        await page.waitForTimeout(500);
        await page.locator('#btnRotateAnalyzer').click();
        await page.waitForTimeout(1000);

        // 5. Input Manual Settings
        const minLpiField = page.locator('#manualLpiMin');
        if (!(await minLpiField.isVisible())) {
            console.log('PAGE LOG: Opening Manual Settings...');
            await page.locator('#btnToggleManualSettings').click();
            await expect(minLpiField).toBeVisible();
        }

        await page.locator('#manualFreqMin').fill('40');
        await page.locator('#manualFreqMax').fill('90');

        // Specific requirement: LPI 500 - 2000
        await page.locator('#manualLpiMin').fill('500');
        await page.locator('#manualLpiMax').fill('2000');

        await page.locator('#manualCols').fill('14');
        await page.locator('#manualRows').fill('9');

        await page.locator('#btnApplyManualSettings').click();

        // 6. Simulate Corner Clicks (Fullscreen alignment)
        console.log('PAGE LOG: Entering alignment mode...');
        await page.locator('#analyzerCanvas').click();
        await expect(page.locator('#alignmentModal')).toBeVisible();

        const alignCanvas = page.locator('#alignmentCanvas');
        const box = await alignCanvas.boundingBox();
        if (box) {
            console.log('PAGE LOG: Clicking corners on alignment canvas...');
            // Click Top-Left
            await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.1);
            // Click Top-Right
            await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.1);
            // Click Bottom-Right
            await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.9);
            // Click Bottom-Left
            await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.9);
        }

        await page.locator('#btnApplyAlignment').click();
        await expect(page.locator('#alignmentModal')).not.toBeVisible();

        // 7. Verify Grid Generated and Save
        await expect(page.locator('#colorMapSection')).toBeVisible();
        console.log('PAGE LOG: Saving color map...');
        await page.locator('#btnSaveColorMap').click();

        // Handle Prompt dialog
        page.on('dialog', dialog => {
            console.log('PAGE LOG: Dialog appeared:', dialog.message());
            dialog.accept('Playwright Test Map');
        });

        // 8. Verify Toast or Status
        // Look for the success message in the status div or toast
        await expect(page.locator('#savedColorMapStatus')).toBeVisible({ timeout: 10000 });
        console.log('PAGE LOG: Save successful!');

        // 9. Verify Export Validity in LocalStorage
        const mapData = await page.evaluate(() => {
            const maps = JSON.parse(localStorage.getItem('picture_engraver_maps') || '[]');
            return maps.find(m => m.name === 'Playwright Test Map');
        });

        expect(mapData).toBeDefined();
        console.log('DEBUG: Saved Map Data Keys:', Object.keys(mapData.data));
        if (mapData.data.gridImage) {
            console.log('DEBUG: Saved Map GridImage exists. Base64 len:', mapData.data.gridImage.base64.length);
        } else {
            console.log('DEBUG: Saved Map GridImage is MISSING/NULL');
        }

        expect(mapData.data.gridImage).not.toBeNull();
        const base64Length = mapData.data.gridImage.base64.length;
        console.log(`Saved Grid Image Base64 Length: ${base64Length}`);
        expect(base64Length).toBeGreaterThan(5000);
    });
});
