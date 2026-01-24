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
    },

    // ===================================
    // Color Map Storage
    // ===================================

    /**
     * Save color map data from analyzer
     * @param {Object} colorMapData - The color map containing colors and their settings
     */
    saveColorMap(colorMapData) {
        try {
            localStorage.setItem(STORAGE_KEY + '_colormap', JSON.stringify(colorMapData));
            return true;
        } catch (error) {
            console.error('Failed to save color map:', error);
            return false;
        }
    },

    /**
     * Load saved color map
     * @returns {Object|null} The saved color map or null if not found
     */
    loadColorMap() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY + '_colormap');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load color map:', error);
        }
        return null;
    },

    /**
     * Check if a color map exists
     * @returns {boolean}
     */
    hasColorMap() {
        return localStorage.getItem(STORAGE_KEY + '_colormap') !== null;
    },

    /**
     * Clear the saved color map
     */
    clearColorMap() {
        try {
            localStorage.removeItem(STORAGE_KEY + '_colormap');
            return true;
        } catch (error) {
            console.error('Failed to clear color map:', error);
            return false;
        }
    }
};
