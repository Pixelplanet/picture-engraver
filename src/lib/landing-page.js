export class LandingPage {
    constructor(settingsStorage, onDeviceSelected) {
        this.settingsStorage = settingsStorage;
        this.onDeviceSelected = onDeviceSelected;
        this.overlay = document.getElementById('deviceSelectionOverlay');
        this.profiles = settingsStorage.getProfiles();
    }

    /**
     * Check if we need to show the landing page
     * @param {boolean} force - Force show even if device is already selected
     */
    show(force = false) {
        const currentSettings = this.settingsStorage.load();

        // precise logic:
        // 1. If no activeDevice is set, SHOW.
        // 2. If force is TRUE, SHOW.
        // 3. Otherwise, do NOT show, just trigger callback with existing device.

        if (!force && currentSettings.activeDevice) {
            this.onDeviceSelected(currentSettings.activeDevice);
            return;
        }

        this.render();
        this.overlay.style.display = 'flex';
    }

    render() {
        // Check for Dev Mode (URL param or localStorage)
        const urlParams = new URLSearchParams(window.location.search);
        const isDevMode = urlParams.get('mode') === 'dev' || localStorage.getItem('dev_mode') === 'true';

        this.overlay.innerHTML = `
            <div style="text-align: center; color: white; max-width: 600px; padding: 40px; background: #252525; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <img src="./logo.png" alt="Logo" style="width: 80px; margin-bottom: 20px;">
                <h1 style="margin: 0 0 10px 0; font-size: 2em; font-weight: 600;">Select Your Laser</h1>
                <p style="color: #bbb; margin-bottom: 30px;">Choose the target machine for your project settings.</p>

                <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
                    <!-- Standard UV Button -->
                    <button class="device-btn" data-id="f2_ultra_uv" style="
                        background: linear-gradient(135deg, #6e40aa, #a044ff);
                        border: none;
                        border-radius: 8px;
                        padding: 20px;
                        width: 200px;
                        cursor: pointer;
                        transition: transform 0.2s;
                        display: flex; flex-direction: column; align-items: center; gap: 10px;
                        color: white;
                    ">
                        <span style="font-size: 3em;">🟣</span>
                        <span style="font-size: 1.2em; font-weight: 600;">F2 Ultra UV</span>
                        <span style="font-size: 0.8em; opacity: 0.8;">Stainless Steel Colors</span>
                    </button>

                    <!-- Base Model Button (Conditional) -->
                    ${isDevMode ? `
                    <button class="device-btn" data-id="f2_ultra_mopa" style="
                        background: linear-gradient(135deg, #2b5876, #4e4376);
                        border: none;
                        border-radius: 8px;
                        padding: 20px;
                        width: 200px;
                        cursor: pointer;
                        transition: transform 0.2s;
                        display: flex; flex-direction: column; align-items: center; gap: 10px;
                        color: white;
                    ">
                        <span style="font-size: 3em;">🔵</span>
                        <span style="font-size: 1.2em; font-weight: 600;">F2 Ultra MOPA</span>
                        <span style="font-size: 0.8em; opacity: 0.8;">Diode / Fiber</span>
                    </button>
                    ` : ''}
                </div>

                ${!isDevMode ? `
                    <div style="margin-top: 20px; font-size: 0.8em; color: #555;">
                        Only F2 Ultra UV is currently supported publicly.
                    </div>
                ` : ''}
            </div>
        `;

        // Add hover effects via JS since inline styles are limited for pseudo-classes
        this.overlay.querySelectorAll('.device-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => btn.style.transform = 'translateY(-5px)');
            btn.addEventListener('mouseleave', () => btn.style.transform = 'translateY(0)');

            btn.addEventListener('click', () => {
                const deviceId = btn.dataset.id;
                this.selectDevice(deviceId);
            });
        });
    }

    selectDevice(deviceId) {
        // 1. Load current settings
        const settings = this.settingsStorage.load();

        // 2. Set active device
        settings.activeDevice = deviceId;

        // 3. Save
        this.settingsStorage.save(settings);

        // 4. Hide overlay
        this.overlay.style.display = 'none';

        // 5. Callback
        this.onDeviceSelected(deviceId);
    }
}
