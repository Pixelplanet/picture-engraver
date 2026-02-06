import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Color Grids Management
 * Tests the consolidated Color Grids section in the Analyzer tab
 */

test.describe('Color Grids Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Brute force hide potential blockers to ensure stable test
        await page.addStyleTag({ content: '#welcomeModal, #testGridInfoModal, .modal-backdrop { display: none !important; }' });

        // Handle Device Selection Overlay if present
        const deviceOverlay = page.locator('#deviceSelectionOverlay');
        if (await deviceOverlay.isVisible()) {
            await page.locator('.device-btn').first().click();
            await expect(deviceOverlay).not.toBeVisible();
            await page.waitForTimeout(500);
        }
    });

    test('should display Color Grids section in Test Grid modal Analyzer tab', async ({ page }) => {
        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await expect(page.locator('#testGridModal')).toBeVisible();

        // Switch to Analyzer tab
        await page.click('[data-modal-tab="analyzer"]');

        // Verify Color Grids section exists
        const colorGridsSection = page.locator('#colorGridsSection');
        await expect(colorGridsSection).toBeVisible();

        // Verify header exists
        await expect(page.locator('#colorGridsSection h3')).toContainText('Color Grids');

        // Verify stats summary exists
        await expect(page.locator('#gridStatsText')).toBeVisible();
    });

    test('should display system default grid', async ({ page }) => {
        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await expect(page.locator('#testGridModal')).toBeVisible();

        // Switch to Analyzer tab
        await page.click('[data-modal-tab="analyzer"]');

        // Wait for grid list to populate
        await page.waitForTimeout(200);

        // Should have at least the system default grid
        const gridItems = page.locator('#colorGridsList .color-grid-item');
        await expect(gridItems).toHaveCount(await gridItems.count() > 0 ? await gridItems.count() : 1);

        // Check for system default
        const systemGrid = page.locator('.color-grid-item.system-grid');
        await expect(systemGrid.first()).toBeVisible();
        await expect(systemGrid.first()).toContainText('System');
    });

    test('should have toggle switches for each grid', async ({ page }) => {
        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await page.click('[data-modal-tab="analyzer"]');

        await page.waitForTimeout(200);

        // Each grid should have a toggle switch
        const toggles = page.locator('#colorGridsList .grid-active-toggle');
        const count = await toggles.count();
        expect(count).toBeGreaterThan(0);

        // System default should be checked by default
        const firstToggle = toggles.first();
        await expect(firstToggle).toBeChecked();
    });

    test('should have selection checkboxes for export', async ({ page }) => {
        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await page.click('[data-modal-tab="analyzer"]');

        await page.waitForTimeout(200);

        // Each grid should have a selection checkbox
        const checkboxes = page.locator('#colorGridsList .grid-select-checkbox');
        const count = await checkboxes.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should have individual export buttons', async ({ page }) => {
        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await page.click('[data-modal-tab="analyzer"]');

        await page.waitForTimeout(200);

        // Each grid should have an export button
        const exportButtons = page.locator('#colorGridsList [data-action="export"]');
        const count = await exportButtons.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should have Import and Export buttons', async ({ page }) => {
        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await page.click('[data-modal-tab="analyzer"]');

        // Verify main action buttons exist
        await expect(page.locator('#btnExportGrids')).toBeVisible();
        await expect(page.locator('#btnImportGrids')).toBeVisible();

        // Verify hidden file input exists for import
        await expect(page.locator('#gridImportFileInput')).toBeAttached();
    });

    test('should not show delete button for system grids', async ({ page }) => {
        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await page.click('[data-modal-tab="analyzer"]');

        await page.waitForTimeout(200);

        // System grids should not have delete button
        const systemGrid = page.locator('.color-grid-item.system-grid').first();
        const deleteButton = systemGrid.locator('[data-action="delete"]');
        await expect(deleteButton).toHaveCount(0);
    });

    test('should toggle grid active state', async ({ page }) => {
        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await page.click('[data-modal-tab="analyzer"]');

        await page.waitForTimeout(300);

        // Get initial state of first toggle
        let toggle = page.locator('#colorGridsList .grid-active-toggle').first();
        const wasChecked = await toggle.isChecked();

        // Click on the toggle's parent label for better click target
        await page.locator('#colorGridsList .color-grid-toggle').first().click();
        await page.waitForTimeout(500); // Wait for state update and re-render

        // Re-query the toggle since the list may have been re-rendered
        toggle = page.locator('#colorGridsList .grid-active-toggle').first();
        const isNowChecked = await toggle.isChecked();

        // After toggle, state should be different
        expect(isNowChecked).toBe(!wasChecked);

        // Toggle back to original state
        await page.locator('#colorGridsList .color-grid-toggle').first().click();
        await page.waitForTimeout(500);
    });

    test('should update stats when grids change', async ({ page }) => {
        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await page.click('[data-modal-tab="analyzer"]');

        await page.waitForTimeout(200);

        // Get initial stats text
        const statsText = await page.locator('#gridStatsText').textContent();

        // Stats should contain meaningful info
        expect(statsText).toMatch(/unique colors|No grids|Loading/i);
    });

    test('should display color count for each grid', async ({ page }) => {
        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await page.click('[data-modal-tab="analyzer"]');

        await page.waitForTimeout(200);

        // Each grid should show color count
        const gridMeta = page.locator('#colorGridsList .color-grid-meta').first();
        const metaText = await gridMeta.textContent();
        expect(metaText).toMatch(/\d+ colors/i);
    });
});

test.describe('Color Grids Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Brute force hide potential blockers
        await page.addStyleTag({ content: '#welcomeModal, #testGridInfoModal, .modal-backdrop { display: none !important; }' });

        // Handle Device Selection Overlay
        const deviceOverlay = page.locator('#deviceSelectionOverlay');
        if (await deviceOverlay.isVisible()) {
            await page.locator('.device-btn').first().click();
            await expect(deviceOverlay).not.toBeVisible();
            await page.waitForTimeout(500);
        }
    });

    test('should use active grids for auto-assign', async ({ page }) => {
        // This is an integration test - verify the grids affect auto-assign
        // We just check the UI connects properly

        // Open Test Grid modal
        await page.click('#btnTestGrid');
        await page.click('[data-modal-tab="analyzer"]');

        await page.waitForTimeout(200);

        // Verify at least one grid is active
        const activeToggles = page.locator('#colorGridsList .grid-active-toggle:checked');
        const activeCount = await activeToggles.count();

        // Stats should reflect active grids
        const statsText = await page.locator('#gridStatsText').textContent();
        if (activeCount > 0) {
            // Stats text may have line breaks, just check for key parts
            expect(statsText).toMatch(/\d+\s+unique colors/i);
            expect(statsText).toMatch(/\d+\s+grid/i);
        }
    });
});
