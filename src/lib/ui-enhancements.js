
import { SettingsStorage } from './settings-storage.js';
import { getActiveLaserConfig } from './device-registry.js';

/**
 * Initializes listeners for frequency limits based on active device.
 * Enforces XCS 40kHz minimum for UV lasers.
 */
export function initFrequencyLimiter() {
    const minInput = document.getElementById('gridFreqMin');
    if (!minInput) return;

    // Monitor for changes
    minInput.addEventListener('change', () => {
        checkFrequencyLimit(minInput);
    });



    const maxInput = document.getElementById('gridFreqMax');
    if (maxInput) {
        maxInput.addEventListener('change', () => {
            // When max changes, re-validate min to unsure it's below max
            checkFrequencyLimit(minInput);
        });

    }

    // Also check on modal open or visibility change if needed, but input/change covers user interaction.
    // Initial check
    checkFrequencyLimit(minInput);
}

function checkFrequencyLimit(input) {
    const settings = SettingsStorage.load();
    const laser = getActiveLaserConfig(settings);
    const isMopaLike = laser ? (laser.hasPulseWidth && laser.hasMopaFrequency) : false;
    const laserLabel = laser ? laser.name : 'UV';

    // UV lasers have a hard 40kHz limit in XCS
    const limit = isMopaLike ? 1 : 40;

    // Update min attribute on the input element
    if (input.getAttribute('min') !== String(limit)) {
        input.setAttribute('min', limit);
    }

    // Get current value and max frequency value
    let val = parseInt(input.value, 10);
    const maxInput = document.getElementById('gridFreqMax');
    const maxVal = maxInput ? parseInt(maxInput.value, 10) : 1000; // Default high if not found

    let corrected = false;
    let message = '';

    // Enforce lower limit (e.g., 40kHz for UV)
    if (!isNaN(val) && val < limit) {
        val = limit;
        corrected = true;
        message = `Minimum ${limit}kHz enforced for ${laserLabel} laser.`;
    }

    // Enforce upper bound constraint (must be at least 1kHz less than max)
    // Only check if maxVal is valid and greater than limit
    if (!isNaN(val) && !isNaN(maxVal) && val >= maxVal) {
        val = maxVal - 1;
        // Ensure we don't drop below the absolute limit
        if (val < limit) val = limit;

        corrected = true;
        message = `Frequency min must be lower than max (${maxVal}kHz).`;
    }

    if (corrected) {
        input.value = val;
        showLimitFeedback(input, message);
    }
}

let feedbackTimeout;
function showLimitFeedback(element, message) {
    // Basic toast or tooltip logic, reusing existing toast if available or simple alert
    // If showToast is global, use it. Otherwise, simple specialized tooltip.
    if (typeof window.showToast === 'function') {
        window.showToast(message, 'info');
    } else {
        // Create temporary tooltip
        let tip = document.getElementById('freq-limit-tooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'freq-limit-tooltip';
            tip.style.position = 'absolute';
            tip.style.background = '#333';
            tip.style.color = '#fff';
            tip.style.padding = '5px 10px';
            tip.style.borderRadius = '4px';
            tip.style.fontSize = '12px';
            tip.style.zIndex = '10000';
            tip.style.pointerEvents = 'none';
            document.body.appendChild(tip);
        }

        const rect = element.getBoundingClientRect();
        tip.style.left = `${rect.left}px`;
        tip.style.top = `${rect.bottom + 5}px`;
        tip.innerText = message;
        tip.style.display = 'block';

        clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            tip.style.display = 'none';
        }, 3000);
    }
}
