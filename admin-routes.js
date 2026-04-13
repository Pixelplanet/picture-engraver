/**
 * Admin Routes
 * Express router providing:
 *  - Token-based auth middleware
 *  - Admin settings CRUD API
 *  - On-the-fly test grid generation endpoint (public, no auth)
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AdminSettings, VALID_LASER_TYPES, validateTestGridSettings, validateColorMap } from './src/lib/admin-settings.js';

// ── Device → laser type mapping (for test grid generation) ──────────────────────
// Maps settingsKey to the device/laser pair needed by TestGridGenerator
const LASER_TYPE_TO_DEVICE = {
    uv:          { activeDevice: 'f2_ultra_uv',    activeLaserType: null },
    mopa:        { activeDevice: 'f2_ultra_mopa',  activeLaserType: 'mopa' },
    mopa_single: { activeDevice: 'f2_ultra_single', activeLaserType: 'mopa_single' },
    blue_ultra:  { activeDevice: 'f2_ultra_mopa',  activeLaserType: 'blue_ultra' },
    ir:          { activeDevice: 'f2',              activeLaserType: 'ir' },
    blue_f2:     { activeDevice: 'f2',              activeLaserType: 'blue_f2' },
};

// ── Lazy-loaded TestGridGenerator (ESM import from bundled code) ────────────────
let TestGridGeneratorClass = null;
async function getTestGridGenerator() {
    if (!TestGridGeneratorClass) {
        const mod = await import('./src/lib/test-grid-generator.js');
        TestGridGeneratorClass = mod.TestGridGenerator;
    }
    return TestGridGeneratorClass;
}

// ── XCS Cache ──────────────────────────────────────────────────────────────────
const xcsCache = new Map();

function invalidateXcsCache() {
    xcsCache.clear();
}

// ── Rate Limiters ──────────────────────────────────────────────────────────────

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;

const adminLimiter = isTest
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 60 * 1000,  // 1 minute
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
    });

const testgridLimiter = isTest
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 60 * 1000,
        max: 60,
        standardHeaders: true,
        legacyHeaders: false,
    });

// ── Auth Middleware ─────────────────────────────────────────────────────────────

function requireAdminAuth(req, res, next) {
    const token = process.env.ADMIN_TOKEN;
    if (!token) {
        return res.status(403).json({ error: 'Admin interface is disabled (ADMIN_TOKEN not configured)' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header with Bearer token required' });
    }

    const provided = authHeader.slice(7);
    // Constant-time comparison to prevent timing attacks
    if (provided.length !== token.length || !timingSafeEqual(provided, token)) {
        return res.status(401).json({ error: 'Invalid admin token' });
    }

    next();
}

/**
 * Constant-time string comparison.
 */
function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

// ── Router Factory ─────────────────────────────────────────────────────────────

export function createAdminRouter(adminSettings) {
    const router = Router();

    // ── Public: Test Grid Generation ────────────────────────────────────────

    router.get('/api/testgrid/:laserType', testgridLimiter, async (req, res) => {
        const laserType = req.params.laserType;

        if (!VALID_LASER_TYPES.includes(laserType)) {
            return res.status(400).json({ error: `Invalid laser type. Valid: ${VALID_LASER_TYPES.join(', ')}` });
        }

        try {
            // Check cache
            const cached = xcsCache.get(laserType);
            if (cached) {
                res.set('Content-Type', 'application/json');
                res.set('Content-Disposition', `attachment; filename="Standard_Test_Grid_${laserType}.xcs"`);
                res.set('X-Cache', 'HIT');
                return res.send(cached);
            }

            const defaults = adminSettings.getTestGridDefaults(laserType);
            const deviceInfo = LASER_TYPE_TO_DEVICE[laserType];

            const TestGridGenerator = await getTestGridGenerator();
            const generator = new TestGridGenerator({
                ...defaults,
                activeDevice: deviceInfo.activeDevice,
                activeLaserType: deviceInfo.activeLaserType,
            });

            const { xcs } = generator.generateBusinessCardGrid();

            // Cache the result
            xcsCache.set(laserType, xcs);

            res.set('Content-Type', 'application/json');
            res.set('Content-Disposition', `attachment; filename="Standard_Test_Grid_${laserType}.xcs"`);
            res.set('X-Cache', 'MISS');
            res.send(xcs);
        } catch (err) {
            console.error(`[TestGrid] Failed to generate grid for ${laserType}:`, err.message);
            res.status(500).json({ error: 'Failed to generate test grid' });
        }
    });

    // ── Admin API (auth required) ──────────────────────────────────────────

    router.get('/admin/api/settings', adminLimiter, requireAdminAuth, (req, res) => {
        const settings = adminSettings.load();
        res.json(settings);
    });

    router.put('/admin/api/settings', adminLimiter, requireAdminAuth, (req, res) => {
        try {
            const saved = adminSettings.save(req.body);
            invalidateXcsCache();
            res.json(saved);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.patch('/admin/api/settings/testgrid/:laserType', adminLimiter, requireAdminAuth, (req, res) => {
        const laserType = req.params.laserType;
        try {
            const saved = adminSettings.updateTestGridDefaults(laserType, req.body);
            invalidateXcsCache();
            res.json(saved.testGridDefaults[laserType]);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.get('/admin/api/settings/testgrid/:laserType/preview', adminLimiter, requireAdminAuth, async (req, res) => {
        const laserType = req.params.laserType;
        if (!VALID_LASER_TYPES.includes(laserType)) {
            return res.status(400).json({ error: 'Invalid laser type' });
        }

        try {
            const defaults = adminSettings.getTestGridDefaults(laserType);
            const deviceInfo = LASER_TYPE_TO_DEVICE[laserType];

            const TestGridGenerator = await getTestGridGenerator();
            const generator = new TestGridGenerator({
                ...defaults,
                activeDevice: deviceInfo.activeDevice,
                activeLaserType: deviceInfo.activeLaserType,
            });

            const { xcs, gridInfo } = generator.generateBusinessCardGrid();
            res.json({ gridInfo, xcsLength: xcs.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/api/settings/reset', adminLimiter, requireAdminAuth, (req, res) => {
        const saved = adminSettings.reset();
        invalidateXcsCache();
        res.json(saved);
    });

    // ── Color Map Management (admin, auth required) ────────────────────────

    // List all color maps (metadata only)
    router.get('/admin/api/colormaps', adminLimiter, requireAdminAuth, (req, res) => {
        const deviceType = req.query.deviceType || undefined;
        const maps = adminSettings.listColorMaps(deviceType);
        res.json(maps);
    });

    // Get a single color map (full data)
    router.get('/admin/api/colormaps/:id', adminLimiter, requireAdminAuth, (req, res) => {
        const map = adminSettings.getColorMap(req.params.id);
        if (!map) return res.status(404).json({ error: 'Color map not found' });
        res.json(map);
    });

    // Upload / create a new color map
    router.post('/admin/api/colormaps', adminLimiter, requireAdminAuth, (req, res) => {
        try {
            // Accept either a direct map object or an export package with maps/grids array
            let mapData = req.body;

            // If it's an export package, extract the first map
            if (mapData.maps && Array.isArray(mapData.maps)) {
                mapData = mapData.maps[0];
            } else if (mapData.grids && Array.isArray(mapData.grids)) {
                mapData = mapData.grids[0];
            }

            const saved = adminSettings.saveColorMap(mapData);
            res.status(201).json(saved);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // Update a color map
    router.put('/admin/api/colormaps/:id', adminLimiter, requireAdminAuth, (req, res) => {
        try {
            const mapData = { ...req.body, id: req.params.id };
            const saved = adminSettings.saveColorMap(mapData);
            res.json(saved);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // Delete a color map
    router.delete('/admin/api/colormaps/:id', adminLimiter, requireAdminAuth, (req, res) => {
        const deleted = adminSettings.deleteColorMap(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Color map not found' });
        res.json({ success: true });
    });

    // Set a color map as default for its device type
    router.post('/admin/api/colormaps/:id/set-default', adminLimiter, requireAdminAuth, (req, res) => {
        try {
            const result = adminSettings.setDefaultColorMap(req.params.id);
            res.json(result);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // ── Public: Color Maps for clients ─────────────────────────────────────

    router.get('/api/colormaps/:deviceType', testgridLimiter, (req, res) => {
        const deviceType = req.params.deviceType;
        const maps = adminSettings.getColorMapsForDevice(deviceType);
        res.json(maps);
    });

    return router;
}

// Export for testing
export { requireAdminAuth, timingSafeEqual, invalidateXcsCache, LASER_TYPE_TO_DEVICE };
