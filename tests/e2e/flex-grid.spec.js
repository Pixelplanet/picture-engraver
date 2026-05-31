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
});
