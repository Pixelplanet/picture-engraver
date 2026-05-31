import { test, expect } from '@playwright/test';

// Smoke test for the flexible (any-2-axis) custom test grid UI.
test.describe('Flexible test grid (Axis Picker Matrix)', () => {
    test('renders matrix, enforces one X/one Y, and previews without errors', async ({ page }) => {
        const errors = [];
        page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
        page.on('pageerror', (err) => errors.push(err.message));

        await page.addInitScript(() => {
            localStorage.setItem('pictureEngraver_onboarding', 'completed');
            localStorage.setItem('pictureEngraver_onboarding_testgrid', 'completed');
            localStorage.setItem('pictureEngraverSettings', JSON.stringify({
                activeDevice: 'f2_ultra_uv', power: 70, speed: 425, passes: 1,
                freqMin: 40, freqMax: 80, lpiMin: 300, lpiMax: 2000
            }));
        });

        await page.goto('/');
        await page.click('#btnTestGrid');
        await expect(page.locator('#testGridModal')).toBeVisible();

        await page.click('button[data-modal-tab="custom"]');
        await expect(page.locator('#tabCustom')).toBeVisible();

        // Switch to custom-axes layout
        await page.selectOption('#gridLayoutMode', 'flex');

        // Matrix should render one row per (non-MOPA) variable
        const rows = page.locator('#flexAxisMatrix .flex-axis-row');
        await expect(rows.first()).toBeVisible();
        const rowCount = await rows.count();
        expect(rowCount).toBe(5); // frequency, power, speed, lpc, defocus (no pulseWidth on UV)

        // Exactly one X and one Y active by default
        const xActive = await page.locator('#flexAxisMatrix .flex-role-toggle button.active', { hasText: 'X' }).count();
        const yActive = await page.locator('#flexAxisMatrix .flex-role-toggle button.active', { hasText: 'Y' }).count();
        expect(xActive).toBe(1);
        expect(yActive).toBe(1);

        // Choosing Defocus as Y should force .xs (disable the .xcs button)
        // Find the Defocus row and click its Y button.
        const defocusRow = page.locator('#flexAxisMatrix .flex-axis-row', { hasText: 'Defocus' });
        await defocusRow.locator('.flex-role-toggle button', { hasText: 'Y' }).click();
        await expect(page.locator('#btnGenerateGrid')).toBeDisabled();

        // Switch Defocus back to constant — .xcs button re-enabled
        await defocusRow.locator('.flex-role-toggle button', { hasText: '•' }).click();
        await expect(page.locator('#btnGenerateGrid')).toBeEnabled();

        // Preview should draw to the canvas
        await page.click('#btnPreviewGrid');
        const hasPixels = await page.evaluate(() => {
            const canvas = document.getElementById('gridPreviewCanvas');
            if (!canvas || !canvas.width) return false;
            const ctx = canvas.getContext('2d');
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) return true;
            }
            return false;
        });
        expect(hasPixels).toBe(true);

        const appErrors = errors.filter(e =>
            !/lasertools\.org|CORS|Failed to load resource|net::ERR/i.test(e));
        expect(appErrors).toEqual([]);
    });

    test('exposes presets, labels, booklet and progressive-refine controls', async ({ page }) => {
        const errors = [];
        page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
        page.on('pageerror', (err) => errors.push(err.message));

        await page.addInitScript(() => {
            localStorage.setItem('pictureEngraver_onboarding', 'completed');
            localStorage.setItem('pictureEngraver_onboarding_testgrid', 'completed');
            localStorage.setItem('pictureEngraverSettings', JSON.stringify({
                activeDevice: 'f2_ultra_uv', power: 70, speed: 425, passes: 1,
                freqMin: 40, freqMax: 80, lpiMin: 300, lpiMax: 2000
            }));
        });

        await page.goto('/');
        await page.click('#btnTestGrid');
        await page.click('button[data-modal-tab="custom"]');
        await page.selectOption('#gridLayoutMode', 'flex');

        // Smart range suggestions
        await page.click('#btnFlexSuggest');

        // Preset dropdown should contain at least one built-in template
        const presetOptions = await page.locator('#gridPresetSelect option').count();
        expect(presetOptions).toBeGreaterThan(1);

        // Axis tick labels toggle exists and is checkable
        await page.check('#flexShowLabels');
        await expect(page.locator('#flexShowLabels')).toBeChecked();

        // Booklet: enabling reveals fields and populates the 3rd-variable list
        await page.check('#flexBookletEnable');
        await expect(page.locator('#flexBookletFields')).toBeVisible();
        const bookletParams = await page.locator('#flexBookletParam option').count();
        expect(bookletParams).toBeGreaterThan(0);

        // Progressive refine: enable, render preview, set a winner, zoom in
        await page.check('#flexRefineEnable');
        await expect(page.locator('#flexRefineFields')).toBeVisible();
        await page.click('#btnPreviewGrid');
        await page.fill('#flexRefineCol', '2');
        await page.fill('#flexRefineRow', '2');
        await page.click('#btnFlexRefine');
        await expect(page.locator('#flexRefineHint')).toContainText('Zoomed');

        const appErrors = errors.filter(e =>
            !/lasertools\.org|CORS|Failed to load resource|net::ERR/i.test(e));
        expect(appErrors).toEqual([]);
    });

    test('modal tabs are siblings and the Analyze tab loads its drop zone', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('pictureEngraver_onboarding', 'completed');
            localStorage.setItem('pictureEngraver_onboarding_testgrid', 'completed');
            localStorage.setItem('pictureEngraverSettings', JSON.stringify({ activeDevice: 'f2_ultra_uv' }));
        });

        await page.goto('/');
        await page.click('#btnTestGrid');

        // Regression: the three tab panels must be direct siblings of .modal-body.
        // A previous unbalanced <div> in the custom-grid booklet section nested
        // #tabAnalyzer inside .custom-grid-layout, so the Analyze tab never loaded.
        const parents = await page.evaluate(() =>
            ['tabStandard', 'tabCustom', 'tabAnalyzer'].map(id => {
                const el = document.getElementById(id);
                return el && el.parentElement ? el.parentElement.className : null;
            }));
        for (const cls of parents) expect(cls).toContain('modal-body');

        // Switching to the Analyze tab reveals its upload drop zone.
        await page.click('button[data-modal-tab="analyzer"]');
        await expect(page.locator('#tabAnalyzer')).toBeVisible();
        await expect(page.locator('#analyzerDropZone')).toBeVisible();
    });

    test('axis tick labels render in the preview without clipping', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('pictureEngraver_onboarding', 'completed');
            localStorage.setItem('pictureEngraver_onboarding_testgrid', 'completed');
            localStorage.setItem('pictureEngraverSettings', JSON.stringify({ activeDevice: 'f2_ultra_uv' }));
        });

        await page.goto('/');
        await page.click('#btnTestGrid');
        await page.click('button[data-modal-tab="custom"]');
        await page.selectOption('#gridLayoutMode', 'flex');

        // Without labels the canvas hugs the 85mm card (×4 px/mm = 340px).
        await page.click('#btnPreviewGrid');
        const baseW = await page.evaluate(() => document.getElementById('gridPreviewCanvas').width);

        // Enabling labels adds a left/bottom gutter so edge labels aren't clipped.
        await page.check('#flexShowLabels');
        await page.click('#btnPreviewGrid');
        const labelW = await page.evaluate(() => document.getElementById('gridPreviewCanvas').width);
        expect(labelW).toBeGreaterThan(baseW);
    });
});
