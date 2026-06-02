import { test, expect } from '@playwright/test';

test('custom grid: flex picker, options consolidated, invert + fill-area work', async ({ page }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await page.addInitScript(() => {
        localStorage.setItem('pictureEngraver_onboarding', 'completed');
        localStorage.setItem('pictureEngraver_onboarding_testgrid', 'completed');
        localStorage.setItem('pictureEngraverSettings', JSON.stringify({
            activeDevice: 'f2_ultra_uv', power: 70, speed: 425, passes: 1,
        }));
    });

    await page.goto('/');
    await page.click('#btnTestGrid');
    await expect(page.locator('#testGridModal')).toBeVisible();
    await page.click('button[data-modal-tab="custom"]');

    // The custom grid is always the Axis Picker (flex) matrix now.
    await expect(page.locator('#flexAxisControl')).toBeVisible();
    await expect(page.locator('#flexAxisMatrix .flex-axis-row').first()).toBeVisible();

    // Removed legacy controls must not be present.
    await expect(page.locator('#gridPresetSelect')).toHaveCount(0);
    await expect(page.locator('#btnPreviewGrid')).toHaveCount(0);

    // Options section consolidated at the bottom with the new checkboxes
    await expect(page.locator('#gridOptionsSection #gridCrossHatch')).toBeVisible();
    await expect(page.locator('#gridOptionsSection #gridFillArea')).toBeVisible();

    // Flex-only options (axis tick labels) are available in flex mode.
    await expect(page.locator('#optShowLabelsRow')).toBeVisible();

    // Invert button on the Power (Y) axis swaps Start/End values.
    const powerRow = page.locator('#flexAxisMatrix .flex-axis-row', { hasText: 'Power' });
    const minBefore = await powerRow.locator('#flexMin_power').inputValue();
    const maxBefore = await powerRow.locator('#flexMax_power').inputValue();
    await powerRow.locator('.flex-range-sep').click();
    await expect(powerRow.locator('#flexMin_power')).toHaveValue(maxBefore);
    await expect(powerRow.locator('#flexMax_power')).toHaveValue(minBefore);

    // Fill-area toggle works without errors
    await page.check('#gridFillArea');
    await expect(page.locator('#gridFillArea')).toBeChecked();

    const appErrors = errors.filter(e => !/lasertools\.org|CORS|Failed to load resource|net::ERR/i.test(e));
    expect(appErrors).toEqual([]);
});
