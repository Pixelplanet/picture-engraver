import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import fs from 'fs';

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

        // The F2 has no default colour maps → dismiss the informational modal
        // that pops up shortly after selection so it doesn't intercept clicks.
        await page.waitForSelector('#btnDismissNoDefaults', { timeout: 3000 }).catch(() => {});
        await page.locator('#btnDismissNoDefaults').click().catch(() => {});

        await page.click('#btnTestGrid');
        await expect(page.locator('#testGridModal')).toBeVisible();
        await page.locator('button[data-modal-tab="custom"]').click();
        await expect(page.locator('#flexAxisMatrix .flex-axis-row').first()).toBeVisible();
        const freqRow = page.locator('#flexAxisMatrix .flex-axis-row', { hasText: 'Frequency' });
        await expect(freqRow).toHaveCount(0);
    });

    test('exports the custom grid as COLOR_ENGRAVE bitmaps with no frequency', async ({ page }) => {
        await completeOnboarding(page);
        await page.goto('/');
        await page.locator('button[data-id="f2"]').click();
        await expect(page.locator('#deviceSelectionOverlay')).toBeHidden({ timeout: 5000 });
        await page.waitForSelector('#btnDismissNoDefaults', { timeout: 3000 }).catch(() => {});
        await page.locator('#btnDismissNoDefaults').click().catch(() => {});

        await page.click('#btnTestGrid');
        await expect(page.locator('#testGridModal')).toBeVisible();
        await page.locator('button[data-modal-tab="custom"]').click();
        await expect(page.locator('#flexAxisMatrix .flex-axis-row').first()).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#btnGenerateGridXS').click(),
        ]);
        const buf = fs.readFileSync(await download.path());
        const zip = await JSZip.loadAsync(buf);

        const profiles = Object.values(JSON.parse(await zip.file('profiles.json').async('string')).profiles);
        expect(profiles.length).toBeGreaterThan(0);
        for (const p of profiles) {
            expect(p.processingType).toBe('COLOR_ENGRAVE');
            expect(p.values).not.toHaveProperty('frequency');
        }
        const displaysKey = Object.keys(zip.files).find(n => n.endsWith('displays-0.json'));
        const displays = JSON.parse(await zip.file(displaysKey).async('string')).displays;
        expect(displays.some(d => d.type === 'BITMAP')).toBe(true);
        expect(Object.keys(zip.files).some(n => /resources\/.*\.png$/.test(n))).toBe(true);
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
