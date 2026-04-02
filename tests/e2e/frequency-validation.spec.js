
import { test, expect } from '@playwright/test';

test.describe('Test Grid Frequency Validation', () => {

    test.describe('UV Laser (40kHz Limit)', () => {
        test.beforeEach(async ({ page }) => {
            // Bypass onboarding and set default device to UV
            await page.addInitScript(() => {
                localStorage.setItem('pictureEngraver_onboarding', 'completed');
                localStorage.setItem('pictureEngraverSettings', JSON.stringify({
                    activeDevice: 'f2_ultra_uv',
                    freqMin: 50,
                    freqMax: 90
                }));
            });

            await page.goto('/');
            await page.click('#btnTestGrid');
            await expect(page.locator('#testGridModal')).toBeVisible();
            await page.click('button[data-modal-tab="custom"]');
            await expect(page.locator('#tabCustom')).toBeVisible();
        });

        test('should enforce minimum frequency of 40kHz for UV', async ({ page }) => {
            const minInput = page.locator('#gridFreqMin');

            // Try setting below 40
            await minInput.fill('30');
            await minInput.blur(); // Trigger change event

            await expect(minInput).toHaveValue('40');
        });

        test('should allow valid values between 40 and Max-1', async ({ page }) => {
            const minInput = page.locator('#gridFreqMin');

            // Set to valid value
            await minInput.fill('60');
            await minInput.blur();
            await expect(minInput).toHaveValue('60');

            // Set to another valid value
            await minInput.fill('45');
            await minInput.blur();
            await expect(minInput).toHaveValue('45');
        });

        test('should enforce Min <= Max - 1', async ({ page }) => {
            const minInput = page.locator('#gridFreqMin');
            const maxInput = page.locator('#gridFreqMax');

            // Verify Max is 90
            await expect(maxInput).toHaveValue('90');

            // Try setting Min to 90 (equal to Max)
            await minInput.fill('90');
            await minInput.blur();
            await expect(minInput).toHaveValue('89'); // Should be Max - 1

            // Try setting Min to 95 (greater than Max)
            await minInput.fill('95');
            await minInput.blur();
            await expect(minInput).toHaveValue('89');
        });

        test('should adjust Min when Max is lowered', async ({ page }) => {
            const minInput = page.locator('#gridFreqMin');
            const maxInput = page.locator('#gridFreqMax');

            // Set Min to 70
            await minInput.fill('70');
            await minInput.blur();
            await expect(minInput).toHaveValue('70');

            // Set Max to 70 (so Min must drop to 69)
            await maxInput.fill('70');
            await maxInput.blur();

            // Check Min
            await expect(minInput).toHaveValue('69');
        });
    });

    test.describe('MOPA Laser (1kHz Limit)', () => {
        test.beforeEach(async ({ page }) => {
            // Set device to MOPA
            await page.addInitScript(() => {
                localStorage.setItem('pictureEngraver_onboarding', 'completed');
                localStorage.setItem('pictureEngraverSettings', JSON.stringify({
                    activeDevice: 'f1_ultra_mopa'
                }));
            });

            await page.goto('/');
            await page.click('#btnTestGrid');
            await expect(page.locator('#testGridModal')).toBeVisible();
            await page.click('button[data-modal-tab="custom"]');

            // For MOPA, default fixed param is Frequency, so range inputs are hidden.
            // We must select 'Fixed Power' to see Frequency Range inputs.
            const fixedParamSelect = page.locator('#gridFixedParam');
            await expect(fixedParamSelect).toBeVisible();
            await fixedParamSelect.selectOption('power');

            // Wait for Frequency Range to appear
            await expect(page.locator('#gridFreqMin')).toBeVisible();
        });

        test('should allow values below 40kHz for MOPA', async ({ page }) => {
            const minInput = page.locator('#gridFreqMin');

            // Try setting to 20
            await minInput.fill('20');
            await minInput.blur();

            await expect(minInput).toHaveValue('20');
        });

        test('should enforce minimum of 1kHz for MOPA', async ({ page }) => {
            const minInput = page.locator('#gridFreqMin');

            // Try setting to 0
            await minInput.fill('0');
            await minInput.blur();

            await expect(minInput).toHaveValue('1');
        });
    });

});
