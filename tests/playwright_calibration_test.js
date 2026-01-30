const { chromium } = require('playwright');
const path = require('path');

const TARGET_URL = 'http://localhost:3002';

(async () => {
    console.log('⚖ Starting Calibration Grid Test...');
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto(TARGET_URL);
        await page.click('button:has-text("Accept & Skip")');

        // 1. Open Test Grid Modal
        console.log('📂 Opening Test Grid Modal...');
        await page.click('#btnTestGrid');

        // 2. Handle Calibration Info Modal (First run)
        const infoModal = page.locator('#testGridInfoModal');
        if (await infoModal.isVisible({ timeout: 2000 })) {
            console.log('ℹ Dismissing calibration info modal...');
            await page.click('#testGridInfoModal button:has-text("Got it")');
        }

        const modal = page.locator('#testGridModal');
        await modal.waitFor({ state: 'visible' });
        console.log('✅ Test Grid Modal opened');

        // 3. Click through tabs
        const tabs = ['standard', 'custom', 'analyzer'];
        for (const tab of tabs) {
            console.log(`📑 Clicking tab: ${tab}`);
            await page.click(`.modal-tab[data-modal-tab="${tab}"]`);

            const content = page.locator(`.modal-tab-content[id="tab${tab.charAt(0).toUpperCase() + tab.slice(1)}"]`);
            await content.waitFor({ state: 'visible' });
            console.log(`✅ Tab ${tab} content visible`);
        }

        await page.screenshot({ path: path.join(process.env.TEMP || '.', 'calibration_test_result.png') });
        console.log('📸 Screenshot saved');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
        console.log('🏁 Calibration Grid Test finished');
    }
})();
