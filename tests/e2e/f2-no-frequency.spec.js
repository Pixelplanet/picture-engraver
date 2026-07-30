import { test, expect } from '@playwright/test';

// The regular xTool F2 (GS006) has no frequency control, so every frequency
// option must be hidden when it is the active device.
test.describe('Regular F2 — no frequency option', () => {
    const completeOnboarding = async (page) => {
        await page.addInitScript(() => {
            localStorage.setItem('pictureEngraver_onboarding', 'completed');
            localStorage.setItem('pictureEngraver_onboarding_testgrid', 'completed');
        });
    };

    test('hides the frequency controls in settings', async ({ page }) => {
        await completeOnboarding(page);
        await page.goto('/');
        await page.locator('button[data-id="f2"]').click();
        await expect(page.locator('#deviceSelectionOverlay')).toBeHidden({ timeout: 5000 });

        await page.click('#btnSettings');
        await expect(page.locator('#settingsModal')).toBeVisible();
        await expect(page.locator('#settingFreqGroup')).toBeHidden();
        await expect(page.locator('#settingBlackFreq')).toBeHidden();
    });

    test('offers no Frequency row in the test-grid custom axes', async ({ page }) => {
        await completeOnboarding(page);
        await page.goto('/');
        await page.locator('button[data-id="f2"]').click();
        await expect(page.locator('#deviceSelectionOverlay')).toBeHidden({ timeout: 5000 });

        await page.click('#btnTestGrid');
        await expect(page.locator('#testGridModal')).toBeVisible();
        await page.locator('button[data-modal-tab="custom"]').click();
        await expect(page.locator('#flexAxisMatrix .flex-axis-row').first()).toBeVisible();
        const freqRow = page.locator('#flexAxisMatrix .flex-axis-row', { hasText: 'Frequency' });
        await expect(freqRow).toHaveCount(0);
    });

    test('still shows frequency for the F2 Ultra UV', async ({ page }) => {
        await completeOnboarding(page);
        await page.goto('/');
        await page.locator('button[data-id="f2_ultra_uv"]').click();
        await expect(page.locator('#deviceSelectionOverlay')).toBeHidden({ timeout: 5000 });

        await page.click('#btnSettings');
        await expect(page.locator('#settingsModal')).toBeVisible();
        await expect(page.locator('#settingFreqGroup')).toBeVisible();
    });
});
