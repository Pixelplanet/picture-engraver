/**
 * Settings Storage Module
 * Handles saving/loading settings from cookies/localStorage
 */

const STORAGE_KEY = 'pictureEngraverSettings';

const DEFAULT_SETTINGS = {
    // Engraving defaults
    power: 70,
    speed: 425,
    passes: 1,
    crossHatch: true,

    // Frequency range (kHz)
    freqMin: 40,
    freqMax: 80,

    // LPI range (Lines Per Inch) - lowered to prevent wireframe rendering
    lpiMin: 200,
    lpiMax: 300,

    // Size defaults (mm)
    defaultWidth: 200,
    defaultHeight: 200
};

export const SettingsStorage = {
    /**
     * Get default settings
     */
    getDefaults() {
        return { ...DEFAULT_SETTINGS };
    },

    /**
     * Load settings from storage
     */
    load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
        return this.getDefaults();
    },

    /**
     * Save settings to storage
     */
    save(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    },

    /**
     * Clear saved settings
     */
    clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Failed to clear settings:', error);
            return false;
        }
    }
};
