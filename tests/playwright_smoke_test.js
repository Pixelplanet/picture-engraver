const { chromium } = require('playwright');
const path = require('path');

const TARGET_URL = 'http://localhost:3002';

(async () => {
    console.log('🚀 Starting Smoke Test on:', TARGET_URL);
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // 1. Load Page
        await page.goto(TARGET_URL);
        const title = await page.title();
        console.log('✅ Page Title:', title);

        // 2. Check Welcome Modal
        const welcomeModal = page.locator('#welcomeModal');
        await welcomeModal.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✅ Welcome Modal is visible');

        // 3. Verify waving emoji is GONE (as per recent change)
        const wavingEmoji = await page.locator('.welcome-icon:has-text("👋")').isVisible();
        if (!wavingEmoji) {
            console.log('✅ Waving emoji correctly removed');
        } else {
            console.error('❌ Waving emoji is still present!');
        }

        // 4. Verify Local Fonts (Inter)
        const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
        console.log('✅ Body Font Family:', fontFamily);
        if (fontFamily.includes('Inter')) {
            console.log('✅ Inter font is correctly applied');
        }

        // 5. Test "Accept & Start Tour" button
        const startTourBtn = page.locator('button:has-text("Accept & Start Tour")');
        await startTourBtn.click();
        console.log('✅ Clicked Start Tour');

        // 6. Verify Onboarding Tour Highlight
        const tourHighlight = page.locator('.tour-highlight');
        await tourHighlight.waitFor({ state: 'visible', timeout: 2000 });
        console.log('✅ Onboarding tour started');

        await page.screenshot({ path: path.join(process.env.TEMP || '.', 'smoke_test_result.png') });
        console.log('📸 Screenshot saved');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
        console.log('🏁 Smoke Test finished');
    }
})();
