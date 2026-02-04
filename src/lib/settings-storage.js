/**
 * Settings Storage Module
 * Handles saving/loading settings from cookies/localStorage
 */

const STORAGE_KEY = 'pictureEngraverSettings';

import { DEFAULT_COLOR_MAP_DATA } from './default-color-map.js';

// Device Profiles definitions
export const DEVICE_PROFILES = {
    'f2_ultra_uv': {
        id: 'f2_ultra_uv',
        name: 'XTool F2 Ultra (UV)',
        description: 'Optimized for UV Laser Module',
        settings: {
            // Engraving defaults
            power: 70,
            speed: 425,
            passes: 1,
            crossHatch: true,
            // Frequency range (kHz)
            freqMin: 40,
            freqMax: 80,
            // LPC range
            lpiMin: 300,
            lpiMax: 2000,
            // Standard Color Settings (UV Defaults)
            blackFreq: 40,
            blackLpi: 500,
            blackSpeed: 100,
            blackPower: 100,
            whiteFreq: 123,
            whiteLpi: 400,
            whiteSpeed: 425,
            whitePower: 70
        }
    },
    'f2_ultra_mopa': {
        id: 'f2_ultra_mopa',
        name: 'XTool F2 Ultra (MOPA)',
        description: 'Standard Fiber/Diode usage (MOPA)',
        settings: {
            // Engraving defaults
            power: 14,
            speed: 1000,
            passes: 1,
            crossHatch: false,
            pulseWidth: 80,

            // Grid Ranges (Speed vs Frequency)
            freqMin: 200,
            freqMax: 1200,
            speedMin: 200,
            speedMax: 1200,

            // Lines/cm (LPC) - High Density
            lpiMin: 300,
            lpiMax: 5000,
            lpi: 5000,

            // Standard Color Settings (MOPA Defaults)
            blackFreq: 30,
            blackLpi: 300,
            blackSpeed: 1000,
            blackPower: 80,
            whiteFreq: 50,
            whiteLpi: 300,
            whiteSpeed: 1000,
            whitePower: 40
        }
    },
    'svg_export': {
        id: 'svg_export',
        name: 'SVG Vector Export',
        description: 'Export clean SVG vectors without laser settings',
        type: 'virtual', // Flag to indicate this is not a real laser device
        settings: {
            // Only size defaults, no laser parameters
            defaultWidth: 200,
            defaultHeight: 200
        }
    },
};

const DEFAULT_PROFILE_ID = 'f2_ultra_uv'; // Default to UV for backward compat

const COMMON_DEFAULTS = {
    // Size defaults (mm)
    defaultWidth: 200,
    defaultHeight: 200,
    activeDevice: null, // Will be set by user
    _version: 2.0 // Increment this when defaults change to force update
};

export const SettingsStorage = {
    /**
     * Get available profiles
     */
    getProfiles() {
        return DEVICE_PROFILES;
    },

    /**
     * Get default settings for a specific profile (or system default)
     */
    getDefaults(profileId = DEFAULT_PROFILE_ID) {
        const profile = DEVICE_PROFILES[profileId] || DEVICE_PROFILES[DEFAULT_PROFILE_ID];
        return {
            ...COMMON_DEFAULTS,
            ...profile.settings,
            activeDevice: profileId
        };
    },

    /**
     * Check if settings have been explicitly saved to storage
     * Used by landing page to determine if device selection is needed
     * @returns {boolean}
     */
    hasExplicitSettings() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return !!parsed.activeDevice;
            }
        } catch (error) {
            // Ignore
        }
        return false;
    },

    /**
     * Check if a profile is a virtual device (not a real laser)
     * @param {string} profileId - Profile ID to check
     * @returns {boolean}
     */
    isVirtualDevice(profileId) {
        const profile = DEVICE_PROFILES[profileId];
        return profile?.type === 'virtual';
    },

    /**
     * Check if currently active device is virtual (SVG mode)
     * @returns {boolean}
     */
    isCurrentDeviceVirtual() {
        const settings = this.load();
        return this.isVirtualDevice(settings.activeDevice);
    },

    /**
     * Load settings from storage
     */
    load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);

                // If we have an active device, ensure we merge with THAT device's defaults
                const deviceId = parsed.activeDevice || DEFAULT_PROFILE_ID;
                const baseDefaults = this.getDefaults(deviceId);

                // Version Check & Migration
                if (!parsed._version || parsed._version < COMMON_DEFAULTS._version) {
                    console.info(`Migrating settings from version ${parsed._version || 'none'} to ${COMMON_DEFAULTS._version}`);
                    const standardKeys = [
                        'blackFreq', 'blackLpi', 'blackSpeed', 'blackPower',
                        'whiteFreq', 'whiteLpi', 'whiteSpeed', 'whitePower'
                    ];
                    standardKeys.forEach(key => {
                        parsed[key] = baseDefaults[key];
                    });
                    parsed._version = COMMON_DEFAULTS._version;
                    this.save(parsed);
                }

                // We overlay parsed settings on top of defaults
                return { ...baseDefaults, ...parsed };
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
        // If nothing stored, return defaults
        // Note: activeDevice will be 'f2_ultra_uv' but logic might check if it was explicitly chosen later
        return this.getDefaults();
    },

    /**
     * Save settings to storage
     */
    save(settings) {
        try {
            // Ensure activeDevice is preserved
            if (!settings.activeDevice) {
                console.warn('Saving settings without activeDevice, defaulting to UV');
                settings.activeDevice = DEFAULT_PROFILE_ID;
            }
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
    // Multi Color Map Storage
    // ===================================

    /**
     * Get all saved color maps
     * Performs auto-migration of legacy single map if found
     * @returns {Array} Array of color map objects
     */
    getColorMaps() {
        try {
            // Check for legacy migration
            this._migrateLegacyColorMap();

            const stored = localStorage.getItem(STORAGE_KEY + '_maps');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load color maps:', error);
        }
        return [];
    },

    /**
     * Ensure a system default map exists
     * Uses real extracted data from calibration
     */
    ensureSystemDefaultMap() {
        try {
            const maps = this.getColorMaps();
            const defaultId = 'system_default_v8'; // Bump version to force update

            // Use real extracted data (from imported constant)
            const defaultMap = {
                id: defaultId,
                name: 'System Default (Optimized)',
                active: true,
                createdAt: new Date().toISOString(),
                data: DEFAULT_COLOR_MAP_DATA
            };

            // Remove ANY old default maps (including current version to force update data)
            // We want exactly one system default map with the latest data
            let i = maps.length;
            let foundIndex = -1;
            while (i--) {
                if (maps[i].id.startsWith('system_default_v')) {
                    if (maps[i].id === defaultId) {
                        foundIndex = i;
                    } else {
                        maps.splice(i, 1);
                    }
                }
            }

            // Always update or add
            if (foundIndex !== -1) {
                // Update existing v7 to ensure cutting edge data (useful during dev)
                // Preserve active status if user toggled it? No, system default should probably stay active unless user explicitly disabled it.
                // But we mainly care about data.
                maps[foundIndex].data = DEFAULT_COLOR_MAP_DATA;
                maps[foundIndex].name = 'System Default (Optimized)'; // Ensure name is current
            } else {
                maps.unshift(defaultMap); // Add to beginning
            }

            localStorage.setItem(STORAGE_KEY + '_maps', JSON.stringify(maps));
            console.info('Created/Updated System Default color map');

        } catch (error) {
            console.error('Failed to create default map:', error);
        }
    },

    /**
     * Save a new color map
     * @param {Object} data - The color map data
     * @param {string} name - User defined name for the map
     * @returns {string|null} The new ID or null on failure
     */
    saveColorMap(data, name) {
        try {
            const maps = this.getColorMaps();
            const id = 'cm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            const newMap = {
                id: id,
                name: name || `Test Grid ${new Date().toLocaleDateString()}`,
                active: true, // Auto-activate new maps
                createdAt: new Date().toISOString(),
                data: data // The actual map data (entries, ranges, etc)
            };

            maps.push(newMap);
            localStorage.setItem(STORAGE_KEY + '_maps', JSON.stringify(maps));
            return id;
        } catch (error) {
            console.error('Failed to save color map:', error);
            return null;
        }
    },

    /**
     * Delete a color map by ID
     * @param {string} id 
     */
    deleteColorMap(id) {
        try {
            let maps = this.getColorMaps();
            maps = maps.filter(m => m.id !== id);
            localStorage.setItem(STORAGE_KEY + '_maps', JSON.stringify(maps));
            return true;
        } catch (error) {
            console.error('Failed to delete color map:', error);
            return false;
        }
    },

    /**
     * Toggle active state of a map
     * @param {string} id 
     * @param {boolean} isActive 
     */
    toggleColorMapActive(id, isActive) {
        try {
            const maps = this.getColorMaps();
            const map = maps.find(m => m.id === id);
            if (map) {
                map.active = isActive;
                localStorage.setItem(STORAGE_KEY + '_maps', JSON.stringify(maps));
                return true;
            }
        } catch (error) {
            console.error('Failed to toggle map:', error);
        }
        return false;
    },

    /**
     * Export all color maps to JSON string
     */
    exportColorMaps() {
        const maps = this.getColorMaps();
        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString(),
            maps: maps
        };
        return JSON.stringify(exportData, null, 2);
    },

    /**
     * Import color maps from JSON string
     * @param {string} jsonString 
     * @returns {number} Count of imported maps
     */
    importColorMaps(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.maps || !Array.isArray(parsed.maps)) {
                throw new Error('Invalid format: missing maps array');
            }

            // Validation: Check for embedded picture data in ALL maps
            parsed.maps.forEach((map, index) => {
                if (!map.data || !map.data.gridImage || !map.data.gridImage.base64) {
                    throw new Error(`Map #${index + 1} "${map.name || 'Untitled'}" is missing embedded grid image. Legacy maps are no longer supported.`);
                }
            });

            const currentMaps = this.getColorMaps();
            let addedCount = 0;

            parsed.maps.forEach(importedMap => {

                // Determine if we should generate a new ID (avoid collision)
                // We'll regenerate IDs on import to be safe, unless it's a backup restore logic
                // For simplicity, let's treat them as new maps if they don't exactly match ID

                // Check for duplicate by content/name to avoid spamming duplicates?
                // For now, simple append
                const newId = 'cm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                importedMap.id = newId;
                importedMap.importedAt = new Date().toISOString();
                importedMap.active = true; // Activate imported maps by default

                currentMaps.push(importedMap);
                addedCount++;
            });

            localStorage.setItem(STORAGE_KEY + '_maps', JSON.stringify(currentMaps));
            return addedCount;
        } catch (error) {
            console.error('Import failed:', error);
            throw error;
        }
    },

    /**
     * Private: Migrate legacy single map structure to new list
     */
    _migrateLegacyColorMap() {
        try {
            const legacyKey = STORAGE_KEY + '_colormap';
            const legacyData = localStorage.getItem(legacyKey);

            // Optimization: check if we already migrated
            if (localStorage.getItem(STORAGE_KEY + '_migrated')) return;

            if (legacyData) {
                const mapData = JSON.parse(legacyData);
                const maps = [];

                // Create new map structure
                const newMap = {
                    id: 'legacy_import',
                    name: 'Previous Calibration',
                    active: true,
                    createdAt: mapData.savedAt || new Date().toISOString(),
                    data: mapData
                };

                maps.push(newMap);
                localStorage.setItem(STORAGE_KEY + '_maps', JSON.stringify(maps));
                localStorage.setItem(STORAGE_KEY + '_migrated', 'true');
                console.info('Migrated legacy color map to new storage format');
            }
        } catch (error) {
            console.error('Migration failed:', error);
        }
    },

    // Compatibility methods for existing code (will direct to new storage)

    /**
     * @deprecated Use getColorMaps()
     * Returns a "merged" map of all active maps specifically for the unified palette logic
     */
    loadColorMap() {
        const maps = this.getColorMaps();
        const activeMaps = maps.filter(m => m.active);

        if (activeMaps.length === 0) return null;

        // Merge entries
        let mergedEntries = [];
        activeMaps.forEach(map => {
            // Add reference to source map in entries if useful
            const entries = map.data.entries.map(e => ({
                ...e,
                _sourceMap: map.name,
                _sourceMapId: map.id,
                _gridImage: map.data.gridImage,
                _numCols: map.data.numCols,
                _numRows: map.data.numRows
            }));
            mergedEntries = mergedEntries.concat(entries);
        });

        return {
            entries: mergedEntries,
            // Ranges might be ambiguous if maps differ, but we take from first
            freqRange: activeMaps[0].data.freqRange,
            lpiRange: activeMaps[0].data.lpiRange
        };
    },

    /**
     * @deprecated Use hasColorMaps()
     */
    hasColorMap() {
        const maps = this.getColorMaps();
        return maps.some(m => m.active);
    },

    /**
     * Clear all maps (Dangerous)
     */
    clearColorMap() {
        localStorage.removeItem(STORAGE_KEY + '_maps');
        localStorage.removeItem(STORAGE_KEY + '_migrated');
        return true;
    }
};
