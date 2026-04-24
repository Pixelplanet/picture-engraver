import { getDeviceFamiliesWithVisibility, isMultiLaserDevice, getDeviceConfig } from './device-registry.js';

// Theme colors per device for the landing page buttons
const DEVICE_THEMES = {
    f2_ultra_uv:     { gradient: 'linear-gradient(135deg, #6e40aa, #a044ff)', emoji: '🟣', subtitle: 'UV Laser Module' },
    f2_ultra_mopa:   { gradient: 'linear-gradient(135deg, #2b5876, #4e4376)', emoji: '🔴', subtitle: 'MOPA + Blue Diode' },
    f2_ultra_single: { gradient: 'linear-gradient(135deg, #1a3a5c, #4e4376)', emoji: '🔴', subtitle: 'MOPA Laser Only' },
    f2:              { gradient: 'linear-gradient(135deg, #2d4a22, #5a8a3c)', emoji: '🟢', subtitle: 'IR + Blue Diode' },
    svg_export:      { gradient: 'linear-gradient(135deg, #2d3436, #636e72)', emoji: '📁', subtitle: 'Vector Only (No Laser)' },
};

export class LandingPage {
    constructor(settingsStorage, onDeviceSelected, visibilitySettings = null) {
        this.settingsStorage = settingsStorage;
        this.onDeviceSelected = onDeviceSelected;
        this.overlay = document.getElementById('deviceSelectionOverlay');
        this.profiles = settingsStorage.getProfiles();
        this.visibilitySettings = visibilitySettings;
    }

    setVisibilitySettings(visibilitySettings) {
        this.visibilitySettings = visibilitySettings;
    }

    /**
     * Check if we need to show the landing page
     * @param {boolean} force - Force show even if device is already selected
     */
    show(force = false) {
        // Check if user has explicitly saved settings (with a device selection)
        const hasExplicitDevice = this.settingsStorage.hasExplicitSettings();

        // precise logic:
        // 1. If no explicit device is set, SHOW the selection.
        // 2. If force is TRUE, SHOW.
        // 3. Otherwise, do NOT show, just trigger callback with existing device.

        if (!force && hasExplicitDevice) {
            const currentSettings = this.settingsStorage.load();
            this.onDeviceSelected(currentSettings.activeDevice);
            return;
        }

        this.render();
        this.overlay.style.display = 'flex';
    }

    render() {
        const families = getDeviceFamiliesWithVisibility(this.visibilitySettings);

        // Build device buttons grouped by family
        const familySections = families.map(({ family, devices }) => {
            const buttons = devices.map(device => {
                const theme = DEVICE_THEMES[device.id] || DEVICE_THEMES.svg_export;
                const multi = isMultiLaserDevice(device.id, this.visibilitySettings);
                return `
                    <button class="device-btn" data-id="${device.id}" style="
                        background: ${theme.gradient};
                        border: none;
                        border-radius: 8px;
                        padding: 20px;
                        width: 200px;
                        cursor: pointer;
                        transition: transform 0.2s;
                        display: flex; flex-direction: column; align-items: center; gap: 10px;
                        color: white;
                    ">
                        <span style="font-size: 3em;">${theme.emoji}</span>
                        <span style="font-size: 1.2em; font-weight: 600;">${device.name}</span>
                        <span style="font-size: 0.8em; opacity: 0.8;">${theme.subtitle}</span>
                        ${multi ? '<span style="font-size: 0.7em; opacity: 0.6; margin-top: 2px;">⚡ Switchable Laser</span>' : ''}
                    </button>`;
            }).join('');

            return `
                <div style="margin-bottom: 20px; width: 100%;">
                    <h3 style="color: #888; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">${family.name}</h3>
                    <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
                        ${buttons}
                    </div>
                </div>`;
        }).join('');

        this.overlay.innerHTML = `
            <div style="text-align: center; color: white; max-width: 700px; padding: 40px; background: #252525; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <img src="./logo.png" alt="Logo" style="width: 80px; margin-bottom: 20px;">
                <h1 style="margin: 0 0 10px 0; font-size: 2em; font-weight: 600;">Select Your Laser</h1>
                <p style="color: #bbb; margin-bottom: 30px;">Choose the target machine for your project settings.</p>
                ${familySections}
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

        // 2. Set active device and default laser type
        settings.activeDevice = deviceId;
        const deviceConfig = getDeviceConfig(deviceId);
        settings.activeLaserType = deviceConfig ? deviceConfig.defaultLaserType : null;

        // 3. Save
        this.settingsStorage.save(settings);

        // 4. Hide overlay
        this.overlay.style.display = 'none';

        // 5. Callback
        this.onDeviceSelected(deviceId);
    }
}
