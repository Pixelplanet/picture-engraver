const { chromium, devices } = require('playwright');
const path = require('path');

const TARGET_URL = 'http://localhost:3002';

(async () => {
    console.log('📱 Starting Responsive Design Tests...');
    const browser = await chromium.launch({ headless: false });

    const testConfigs = [
        { name: 'Desktop', width: 1920, height: 1080, device: null },
        { name: 'Tablet', width: 768, height: 1024, device: devices['iPad (gen 7)'] },
        { name: 'Mobile', width: 375, height: 667, device: devices['iPhone SE'] }
    ];

    for (const config of testConfigs) {
        console.log(`\nTesting ${config.name}...`);
        const context = await browser.newContext(config.device || { viewport: { width: config.width, height: config.height } });
        const page = await context.newPage();

        try {
            await page.goto(TARGET_URL);

            // Determine if we expect mobile warning or welcome modal
            // Note: OnboardingManager.js uses navigator.userAgent to detect mobile.
            // iPad UA contains "iPad", so it triggers isMobile() == true.

            const isMobileUA = config.device && config.device.userAgent.match(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i);

            if (isMobileUA) {
                console.log('👀 Waiting for Mobile Warning...');
                const mobileWarning = page.locator('#mobileWarningModal');
                await mobileWarning.waitFor({ state: 'visible', timeout: 10000 });
                console.log('✅ Mobile Warning Modal visible');
                await page.click('button:has-text("I Understand")');
            } else {
                console.log('👀 Waiting for Welcome Modal...');
                const welcomeModal = page.locator('#welcomeModal');
                await welcomeModal.waitFor({ state: 'visible', timeout: 10000 });
                console.log('✅ Welcome Modal visible');
                await page.click('button:has-text("Accept & Skip")');
            }

            // Verify header is visible
            const header = page.locator('.header');
            await header.waitFor({ state: 'visible' });
            console.log('✅ Header is visible');

            // Screenshot
            const screenshotPath = path.join(process.env.TEMP || '.', `responsive_${config.name.toLowerCase()}.png`);
            await page.screenshot({ path: screenshotPath });
            console.log(`📸 Screenshot saved: ${screenshotPath}`);

        } catch (error) {
            console.error(`❌ Test failed for ${config.name}:`, error.message);
        } finally {
            await context.close();
        }
    }

    await browser.close();
    console.log('\n🏁 Responsive Tests finished');
})();
