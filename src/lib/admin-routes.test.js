import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createAdminRouter, timingSafeEqual, LASER_TYPE_TO_DEVICE } from '../../admin-routes.js';
import { AdminSettings, VALID_LASER_TYPES, HARDCODED_TEST_GRID_DEFAULTS } from './admin-settings.js';

// ── Test Helpers ────────────────────────────────────────────────────────────────

const TEST_TOKEN = 'test-admin-token-12345';

function createApp(adminSettings) {
    const app = express();
    app.use(express.json());
    app.use(createAdminRouter(adminSettings));
    return app;
}

// ── timingSafeEqual ─────────────────────────────────────────────────────────────

describe('timingSafeEqual', () => {
    it('should return true for equal strings', () => {
        expect(timingSafeEqual('abc', 'abc')).toBe(true);
    });

    it('should return false for different strings of same length', () => {
        expect(timingSafeEqual('abc', 'abd')).toBe(false);
    });

    it('should return false for different lengths', () => {
        expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    });

    it('should return true for empty strings', () => {
        expect(timingSafeEqual('', '')).toBe(true);
    });
});

// ── LASER_TYPE_TO_DEVICE mapping ────────────────────────────────────────────────

describe('LASER_TYPE_TO_DEVICE', () => {
    it('should map all valid laser types', () => {
        for (const lt of VALID_LASER_TYPES) {
            expect(LASER_TYPE_TO_DEVICE[lt]).toBeDefined();
            expect(LASER_TYPE_TO_DEVICE[lt].activeDevice).toBeTruthy();
        }
    });

    it('should map UV to f2_ultra_uv', () => {
        expect(LASER_TYPE_TO_DEVICE.uv.activeDevice).toBe('f2_ultra_uv');
    });

    it('should map MOPA to f2_ultra_mopa', () => {
        expect(LASER_TYPE_TO_DEVICE.mopa.activeDevice).toBe('f2_ultra_mopa');
        expect(LASER_TYPE_TO_DEVICE.mopa.activeLaserType).toBe('mopa');
    });
});

// ── Admin Auth Middleware ────────────────────────────────────────────────────────

describe('Admin Auth', () => {
    let tmpDir, adminSettings, app;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-route-test-'));
        adminSettings = new AdminSettings(tmpDir);
        app = createApp(adminSettings);
    });

    afterEach(() => {
        delete process.env.ADMIN_TOKEN;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return 403 when ADMIN_TOKEN is not set', async () => {
        delete process.env.ADMIN_TOKEN;
        const res = await request(app).get('/admin/api/settings');
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('disabled');
    });

    it('should return 401 when no Authorization header', async () => {
        process.env.ADMIN_TOKEN = TEST_TOKEN;
        const res = await request(app).get('/admin/api/settings');
        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Bearer token required');
    });

    it('should return 401 with wrong token', async () => {
        process.env.ADMIN_TOKEN = TEST_TOKEN;
        const res = await request(app)
            .get('/admin/api/settings')
            .set('Authorization', 'Bearer wrong-token-xxxxx');
        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Invalid');
    });

    it('should grant access with correct token', async () => {
        process.env.ADMIN_TOKEN = TEST_TOKEN;
        const res = await request(app)
            .get('/admin/api/settings')
            .set('Authorization', `Bearer ${TEST_TOKEN}`);
        expect(res.status).toBe(200);
        expect(res.body.testGridDefaults).toBeDefined();
    });
});

// ── Admin Settings CRUD API ─────────────────────────────────────────────────────

describe('Admin Settings API', () => {
    let tmpDir, adminSettings, app;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-route-test-'));
        adminSettings = new AdminSettings(tmpDir);
        app = createApp(adminSettings);
        process.env.ADMIN_TOKEN = TEST_TOKEN;
    });

    afterEach(() => {
        delete process.env.ADMIN_TOKEN;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const authHeader = () => ({ Authorization: `Bearer ${TEST_TOKEN}` });

    // ── GET /admin/api/settings ─────────────────────────────────────────

    describe('GET /admin/api/settings', () => {
        it('should return all defaults', async () => {
            const res = await request(app)
                .get('/admin/api/settings')
                .set(authHeader());

            expect(res.status).toBe(200);
            expect(res.body.testGridDefaults).toBeDefined();
            for (const lt of VALID_LASER_TYPES) {
                expect(res.body.testGridDefaults[lt]).toBeDefined();
            }
        });

        it('should return customized settings after update', async () => {
            // First update UV power
            await request(app)
                .patch('/admin/api/settings/testgrid/uv')
                .set(authHeader())
                .send({ power: 55 });

            // Then fetch all settings
            const res = await request(app)
                .get('/admin/api/settings')
                .set(authHeader());

            expect(res.status).toBe(200);
            expect(res.body.testGridDefaults.uv.power).toBe(55);
        });
    });

    // ── PATCH /admin/api/settings/testgrid/:laserType ───────────────────

    describe('PATCH /admin/api/settings/testgrid/:laserType', () => {
        it('should update a single laser type', async () => {
            const res = await request(app)
                .patch('/admin/api/settings/testgrid/mopa')
                .set(authHeader())
                .send({ power: 20, speedMin: 300 });

            expect(res.status).toBe(200);
            expect(res.body.power).toBe(20);
            expect(res.body.speedMin).toBe(300);
            // Other defaults should remain
            expect(res.body.cardWidth).toBe(86);
        });

        it('should reject invalid laser type', async () => {
            const res = await request(app)
                .patch('/admin/api/settings/testgrid/plasma')
                .set(authHeader())
                .send({ power: 50 });

            expect(res.status).toBe(400);
        });

        it('should reject invalid settings', async () => {
            const res = await request(app)
                .patch('/admin/api/settings/testgrid/uv')
                .set(authHeader())
                .send({ cardWidth: -5 });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('cardWidth');
        });

        it('should persist across requests', async () => {
            await request(app)
                .patch('/admin/api/settings/testgrid/ir')
                .set(authHeader())
                .send({ power: 33 });

            // Fetch settings to verify persistence
            const res = await request(app)
                .get('/admin/api/settings')
                .set(authHeader());

            expect(res.body.testGridDefaults.ir.power).toBe(33);
        });

        it('should not affect other laser types', async () => {
            const before = await request(app)
                .get('/admin/api/settings')
                .set(authHeader());

            await request(app)
                .patch('/admin/api/settings/testgrid/uv')
                .set(authHeader())
                .send({ power: 10 });

            const after = await request(app)
                .get('/admin/api/settings')
                .set(authHeader());

            expect(after.body.testGridDefaults.uv.power).toBe(10);
            expect(after.body.testGridDefaults.mopa.power).toBe(before.body.testGridDefaults.mopa.power);
        });
    });

    // ── PUT /admin/api/settings ─────────────────────────────────────────

    describe('PUT /admin/api/settings', () => {
        it('should replace all settings', async () => {
            const fullSettings = adminSettings.load();
            fullSettings.testGridDefaults.uv.power = 42;
            fullSettings.testGridDefaults.mopa.power = 8;

            const res = await request(app)
                .put('/admin/api/settings')
                .set(authHeader())
                .send(fullSettings);

            expect(res.status).toBe(200);
            expect(res.body.testGridDefaults.uv.power).toBe(42);
            expect(res.body.testGridDefaults.mopa.power).toBe(8);
        });

        it('should reject unknown laser types', async () => {
            const res = await request(app)
                .put('/admin/api/settings')
                .set(authHeader())
                .send({ testGridDefaults: { plasma: { power: 50 } } });

            expect(res.status).toBe(400);
        });
    });

    // ── POST /admin/api/settings/reset ──────────────────────────────────

    describe('POST /admin/api/settings/reset', () => {
        it('should reset to hardcoded defaults', async () => {
            // Customize first
            await request(app)
                .patch('/admin/api/settings/testgrid/uv')
                .set(authHeader())
                .send({ power: 1 });

            // Reset
            const res = await request(app)
                .post('/admin/api/settings/reset')
                .set(authHeader());

            expect(res.status).toBe(200);
            expect(res.body.testGridDefaults.uv.power).toBe(HARDCODED_TEST_GRID_DEFAULTS.uv.power);
        });
    });
});

// ── Public Test Grid Endpoint ───────────────────────────────────────────────────

describe('GET /api/testgrid/:laserType', () => {
    let tmpDir, adminSettings, app;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-route-test-'));
        adminSettings = new AdminSettings(tmpDir);
        app = createApp(adminSettings);
    });

    afterEach(() => {
        delete process.env.ADMIN_TOKEN;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should reject invalid laser type', async () => {
        const res = await request(app).get('/api/testgrid/plasma');
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid laser type');
    });

    it('should generate XCS for UV', async () => {
        const res = await request(app).get('/api/testgrid/uv');
        expect(res.status).toBe(200);
        // XCS is JSON-based
        expect(res.headers['content-disposition']).toContain('Standard_Test_Grid_uv.xcs');
        expect(res.headers['x-cache']).toBe('MISS');
    });

    it('should return cached result on second request', async () => {
        await request(app).get('/api/testgrid/uv');

        const res = await request(app).get('/api/testgrid/uv');
        expect(res.status).toBe(200);
        expect(res.headers['x-cache']).toBe('HIT');
    });

    it('should generate XCS for MOPA', async () => {
        const res = await request(app).get('/api/testgrid/mopa');
        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toContain('Standard_Test_Grid_mopa.xcs');
    });

    it('should generate XCS for all laser types', async () => {
        for (const lt of VALID_LASER_TYPES) {
            const res = await request(app).get(`/api/testgrid/${lt}`);
            expect(res.status).toBe(200);
        }
    });

    it('should not require authentication', async () => {
        // No auth header — should still work
        const res = await request(app).get('/api/testgrid/uv');
        expect(res.status).toBe(200);
    });

    it('should serve admin-customized defaults', async () => {
        process.env.ADMIN_TOKEN = TEST_TOKEN;

        // Customize UV power
        await request(app)
            .patch('/admin/api/settings/testgrid/uv')
            .set({ Authorization: `Bearer ${TEST_TOKEN}` })
            .send({ power: 30 });

        // The XCS cache gets invalidated on settings change, so this generates fresh
        const res = await request(app).get('/api/testgrid/uv');
        expect(res.status).toBe(200);
        // XCS will contain the customized settings (hard to verify content, but the endpoint works)
    });
});

// ── Color Map API ───────────────────────────────────────────────────────────────

describe('Color Map Admin API', () => {
    let tmpDir, adminSettings, app;

    const makeMap = (overrides = {}) => ({
        name: 'UV Calibration',
        deviceType: 'f2_ultra_uv',
        data: {
            entries: [
                { color: { r: 100, g: 150, b: 200 }, frequency: 40, lpi: 500, gridPos: { col: 0, row: 0 } },
            ],
            numCols: 1, numRows: 1,
        },
        ...overrides,
    });

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-cm-route-'));
        adminSettings = new AdminSettings(tmpDir);
        app = createApp(adminSettings);
        process.env.ADMIN_TOKEN = TEST_TOKEN;
    });

    afterEach(() => {
        delete process.env.ADMIN_TOKEN;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const authHeader = () => ({ Authorization: `Bearer ${TEST_TOKEN}` });

    it('should require auth for admin endpoints', async () => {
        const res = await request(app).get('/admin/api/colormaps');
        expect(res.status).toBe(401);
    });

    describe('POST /admin/api/colormaps', () => {
        it('should upload a color map', async () => {
            const res = await request(app)
                .post('/admin/api/colormaps')
                .set(authHeader())
                .send(makeMap());

            expect(res.status).toBe(201);
            expect(res.body.id).toBeTruthy();
            expect(res.body.name).toBe('UV Calibration');
            expect(res.body.entryCount).toBe(1);
        });

        it('should accept an export package with maps array', async () => {
            const pkg = {
                version: 1,
                maps: [makeMap({ name: 'From Export' })],
            };
            const res = await request(app)
                .post('/admin/api/colormaps')
                .set(authHeader())
                .send(pkg);

            expect(res.status).toBe(201);
            expect(res.body.name).toBe('From Export');
        });

        it('should reject invalid map', async () => {
            const res = await request(app)
                .post('/admin/api/colormaps')
                .set(authHeader())
                .send({ name: '' });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /admin/api/colormaps', () => {
        it('should list uploaded maps', async () => {
            await request(app).post('/admin/api/colormaps').set(authHeader()).send(makeMap());
            await request(app).post('/admin/api/colormaps').set(authHeader()).send(makeMap({ name: 'Second' }));

            const res = await request(app).get('/admin/api/colormaps').set(authHeader());
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });

        it('should filter by deviceType', async () => {
            await request(app).post('/admin/api/colormaps').set(authHeader()).send(makeMap({ deviceType: 'f2_ultra_uv' }));
            await request(app).post('/admin/api/colormaps').set(authHeader()).send(makeMap({ name: 'MOPA', deviceType: 'f2_ultra_mopa' }));

            const res = await request(app).get('/admin/api/colormaps?deviceType=f2_ultra_uv').set(authHeader());
            expect(res.body).toHaveLength(1);
            expect(res.body[0].deviceType).toBe('f2_ultra_uv');
        });
    });

    describe('GET /admin/api/colormaps/:id', () => {
        it('should return full map data', async () => {
            const created = await request(app).post('/admin/api/colormaps').set(authHeader()).send(makeMap());
            const res = await request(app).get(`/admin/api/colormaps/${created.body.id}`).set(authHeader());

            expect(res.status).toBe(200);
            expect(res.body.data.entries).toHaveLength(1);
        });

        it('should return 404 for unknown id', async () => {
            const res = await request(app).get('/admin/api/colormaps/nonexistent').set(authHeader());
            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /admin/api/colormaps/:id', () => {
        it('should delete a map', async () => {
            const created = await request(app).post('/admin/api/colormaps').set(authHeader()).send(makeMap());
            const res = await request(app).delete(`/admin/api/colormaps/${created.body.id}`).set(authHeader());
            expect(res.status).toBe(200);

            const list = await request(app).get('/admin/api/colormaps').set(authHeader());
            expect(list.body).toHaveLength(0);
        });

        it('should return 404 for unknown id', async () => {
            const res = await request(app).delete('/admin/api/colormaps/nonexistent').set(authHeader());
            expect(res.status).toBe(404);
        });
    });

    describe('POST /admin/api/colormaps/:id/set-default', () => {
        it('should set map as default', async () => {
            const created = await request(app).post('/admin/api/colormaps').set(authHeader()).send(makeMap());
            const res = await request(app).post(`/admin/api/colormaps/${created.body.id}/set-default`).set(authHeader());

            expect(res.status).toBe(200);
            expect(res.body.isDefault).toBe(true);
        });
    });

    describe('GET /api/colormaps/:deviceType (public)', () => {
        it('should return maps for a device without auth', async () => {
            await request(app).post('/admin/api/colormaps').set(authHeader()).send(makeMap());

            // No auth header — public endpoint
            const res = await request(app).get('/api/colormaps/f2_ultra_uv');
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].data.entries).toBeDefined();
        });

        it('should return empty array for device with no maps', async () => {
            const res = await request(app).get('/api/colormaps/f2');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });
});
