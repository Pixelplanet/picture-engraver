const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const TARGET_URL = 'http://localhost:3002';
const TEST_IMAGE_PATH = path.join('c:', 'Projects', 'Picture Engraver', 'dist', 'logo.png');

(async () => {
    console.log('🔄 Starting Workflow Test...');

    if (!fs.existsSync(TEST_IMAGE_PATH)) {
        console.error(`❌ Test image not found at ${TEST_IMAGE_PATH}`);
        process.exit(1);
    }

    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto(TARGET_URL);

        // 1. Skip Onboarding
        console.log('⏭ Skipping onboarding...');
        await page.click('button:has-text("Accept & Skip")');

        // 2. Upload Image
        console.log('📤 Uploading image...');
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('#dropZone');
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(TEST_IMAGE_PATH);
        console.log('✅ Image uploaded');

        // 3. Wait for controls to appear
        await page.waitForSelector('#controlsSection', { state: 'visible' });

        // 4. Set Settings
        console.log('⚙ Adjusting settings...');
        // Change to custom size
        await page.selectOption('#sizeSelect', 'custom');
        await page.waitForSelector('#customSizeGroup', { state: 'visible' });
        await page.fill('#customWidth', '50');

        // Change color count
        await page.evaluate(() => {
            const slider = document.querySelector('#colorSlider');
            slider.value = 6;
            slider.dispatchEvent(new Event('input'));
            slider.dispatchEvent(new Event('change'));
        });
        console.log('✅ Settings adjusted');

        // 5. Process Image
        console.log('⏳ Processing image...');
        await page.click('#btnProcess');

        // 6. Wait for Layers Panel
        console.log('👀 Waiting for layers panel...');
        await page.waitForSelector('#layersPanel', { state: 'visible', timeout: 15000 });

        const layerItems = page.locator('.layer-item');
        await layerItems.first().waitFor({ state: 'visible' });
        const layerCount = await layerItems.count();
        console.log(`✅ Found ${layerCount} layers`);

        // 7. Test Auto-Assign
        console.log('🤖 Testing Auto-Assign...');
        await page.click('#btnAutoAssign');

        // Check if progress toast/status appears
        const statusText = await page.locator('#calibrationStatus').innerText();
        console.log('✅ Auto-assign clicked. Status:', statusText);

        await page.screenshot({ path: path.join(process.env.TEMP || '.', 'workflow_test_result.png') });
        console.log('📸 Screenshot saved');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
        console.log('🏁 Workflow Test finished');
    }
})();
