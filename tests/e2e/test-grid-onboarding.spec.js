
import { test, expect } from '@playwright/test';

test.describe('Test Grid Onboarding', () => {
    test.beforeEach(async ({ page }) => {
        // Clear all storage first
        await page.addInitScript(() => localStorage.clear());

        // Mark main onboarding as completed so we don't get stuck there
        await page.addInitScript(() => {
            localStorage.setItem('pictureEngraver_onboarding', 'completed');
            // Ensure test grid onboarding is NOT completed
            localStorage.removeItem('pictureEngraver_onboarding_testgrid');
        });

        await page.goto('/');

        // Handle Device Selection Overlay if present (Standard UV)
        const uvBtn = page.locator('button[data-id="f2_ultra_uv"]');
        try {
            if (await uvBtn.isVisible({ timeout: 2000 })) {
                await uvBtn.click();
            }
        } catch (e) { }
    });

    test('should show test grid onboarding modal on first visit', async ({ page }) => {
        // Click Test Grid button
        await page.click('#btnTestGrid');

        // Check if the Info Modal appears
        const infoModal = page.locator('#testGridInfoModal');
        await expect(infoModal).toBeVisible();
        await expect(infoModal).toContainText('Calibration Workflow');

        // Click "Got it"
        await infoModal.locator('.btn-primary').click();

        // Modal should disappear
        await expect(infoModal).toBeHidden();

        // Verify it is marked as completed in localStorage
        const status = await page.evaluate(() => localStorage.getItem('pictureEngraver_onboarding_testgrid'));
        expect(status).toBe('completed');
    });

    test('should NOT show test grid onboarding modal if already completed', async ({ page }) => {
        // Mark as already completed
        await page.addInitScript(() => {
            localStorage.setItem('pictureEngraver_onboarding_testgrid', 'completed');
        });
        await page.reload();

        // Handle Device Selection again after reload
        const uvBtn = page.locator('button[data-id="f2_ultra_uv"]');
        try {
            if (await uvBtn.isVisible({ timeout: 2000 })) {
                await uvBtn.click();
            }
        } catch (e) { }

        // Click Test Grid button
        await page.click('#btnTestGrid');

        // Check if the Info Modal does NOT appear
        const infoModal = page.locator('#testGridInfoModal');
        await expect(infoModal).toBeHidden();

        // The actual Test Grid modal should be visible
        await expect(page.locator('#testGridModal')).toBeVisible();
    });
});
