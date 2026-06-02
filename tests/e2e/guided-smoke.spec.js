import { test, expect } from '@playwright/test';

test('guided custom grid: options consolidated, invert + fill-area work', async ({ page }) => {
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
    await page.click('button[data-modal-tab="custom"]');

    // LPC defaults read 800 → 300 (left = high energy)
    await expect(page.locator('#gridLpiMin')).toHaveValue('800');
    await expect(page.locator('#gridLpiMax')).toHaveValue('300');

    // Options section consolidated at the bottom with the new checkboxes
    await expect(page.locator('#gridOptionsSection #gridCrossHatch')).toBeVisible();
    await expect(page.locator('#gridOptionsSection #gridFillArea')).toBeVisible();

    // Flex-only options hidden in guided mode
    await expect(page.locator('#optShowLabelsRow')).toBeHidden();

    // Invert button swaps LPC start/end
    await page.click('.btn-invert-axis[data-invert="gridLpiMin,gridLpiMax"]');
    await expect(page.locator('#gridLpiMin')).toHaveValue('300');
    await expect(page.locator('#gridLpiMax')).toHaveValue('800');

    // Fill-area toggle works without errors
    await page.check('#gridFillArea');
    await expect(page.locator('#gridFillArea')).toBeChecked();

    const appErrors = errors.filter(e => !/lasertools\.org|CORS|Failed to load resource|net::ERR/i.test(e));
    expect(appErrors).toEqual([]);
});
