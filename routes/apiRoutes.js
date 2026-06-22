const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const crypto = require('crypto');
const config = require('../config/config');
const { clearCache } = require('../services/projectService');
const fuService = require('../services/fuProjectService');
const { fetchUptimeData } = require('../services/uptimeService');
const { fetchPanelData } = require('../services/panelService');

const dictionary = require('../lang');
const router = express.Router();

const saveLimiter = rateLimit({
    windowMs: config.RATE_LIMITS.SAVE_WINDOW_MS,
    max: config.RATE_LIMITS.SAVE_MAX,
    message: { error: "Too many tries. Try again later." }
});

const refreshLimiter = rateLimit({
    windowMs: config.RATE_LIMITS.REFRESH_WINDOW_MS,
    max: config.RATE_LIMITS.REFRESH_MAX,
    message: { error: "Too many refresh tries. Try again later." }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: "Too many signing in tries. Try again later." }
});

const secureCompare = (inputPass, envPass) => {
    if (!inputPass || !envPass || typeof inputPass !== 'string' || typeof envPass !== 'string') {
        return false;
    }

    const inputBuffer = Buffer.from(inputPass || '');
    const envBuffer = Buffer.from(envPass || '');

    if (inputBuffer.length !== envBuffer.length || inputBuffer.length === 0) {
        return false;
    }

    const inputHash = crypto.createHash('sha256').update(inputBuffer).digest();
    const envHash = crypto.createHash('sha256').update(envBuffer).digest();

    return crypto.timingSafeEqual(inputHash, envHash);
};

const ADMIN_COOKIE_TOKEN = crypto.createHash('sha256').update(config.ADMIN_PASS + config.SESSION_SECRET).digest('hex');

const requireAdmin = (req, res, next) => {
    const pass = req.headers['authorization'] || req.body.password;
    const cookieSession = req.cookies ? req.cookies.hub_session : null;

    if (cookieSession) {
        const cookieBuffer = Buffer.from(cookieSession);
        const tokenBuffer = Buffer.from(ADMIN_COOKIE_TOKEN);

        if (cookieBuffer.length === tokenBuffer.length && crypto.timingSafeEqual(cookieBuffer, tokenBuffer)) {
            return next();
        }
    }

    if (secureCompare(pass, config.ADMIN_PASS)) {
        return next();
    }

    return res.status(401).json({ error: "Unauthorized. Sign in." });
};

router.post('/auth/login', loginLimiter, (req, res) => {
    if (secureCompare(req.body.password, config.ADMIN_PASS)) {
        res.cookie('hub_session', ADMIN_COOKIE_TOKEN, {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
        res.status(200).json({ message: "Signed in successfully. Session stored." });
    } else {
        res.status(401).json({ error: "Invalid password." });
    }
});

router.post('/auth/logout', (req, res) => {
    res.clearCookie('hub_session', { httpOnly: true, sameSite: 'strict' });
    res.status(200).json({ message: "Logged out successfully." });
});

const payloadSchema = Joi.object({
    id: Joi.string().allow('', null).optional(),
    name: Joi.string().allow('', null).max(200).optional(),
    baseCost: Joi.number().integer().min(0).optional(),
    areaMultiplier: Joi.number().min(0).optional(),
    useMultiplier: Joi.number().min(0).optional(),
    hasFlaw: Joi.boolean().optional(),
    flawDesc: Joi.string().allow('', null).max(1000).optional(),
    desc: Joi.string().allow('', null).max(2000).optional(),
    clockSections: Joi.number().integer().min(1).optional(),
    savedLang: Joi.string().valid('pl', 'en').optional()
}).unknown(true);

router.get('/lang/:code', (req, res) => {
    const lang = req.params.code;
    if (dictionary[lang]) {
        res.status(200).json(dictionary[lang]);
    } else {
        res.status(404).json({ error: "Language not found." });
    }
});

router.post('/refresh-cache', refreshLimiter, requireAdmin, async (req, res) => {
    clearCache();
    await Promise.all([
        fetchUptimeData(),
        fetchPanelData()
    ]);
    res.status(200).json({ message: "Cache refreshed successfully" });
});

router.post('/fu-projects/save', saveLimiter, requireAdmin, async (req, res, next) => {
    try {
        const { payload } = req.body;

        if (!payload) {
            return res.status(400).json({ error: "No payload." });
        }

        const { error, value: cleanPayload } = payloadSchema.validate(payload, { stripUnknown: true });

        if (error) {
            return res.status(400).json({ error: "Invalid data structure.", details: error.details });
        }

        const id = await fuService.saveProject(cleanPayload, cleanPayload.id);
        res.status(200).json({ id: `fuid:${id}` });
    } catch (err) {
        next(err);
    }
});

router.get('/fu-projects/load/:id', async (req, res, next) => {
    try {
        const data = await fuService.loadProject(req.params.id);
        res.status(200).json(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ error: "Project not found." });
        }
        next(err);
    }
});

const fetchWorker = async (endpoint, method, body = null) => {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': config.YT_WORKER_KEY
        }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${config.YT_WORKER_URL}${endpoint}`, options);
    if (!response.ok) throw new Error(`Worker error: ${response.status}`);
    return response;
};

router.post('/yt/download', requireAdmin, async (req, res) => {
    try {
        await fetchWorker('/download', 'POST', { url: req.body.url });
        res.status(200).json({ message: "Download task sent." });
    } catch (err) {
        console.error("[YT Sync] Download error:", err.message);
        res.status(500).json({ error: "Error while communicating with Worker." });
    }
});

router.post('/yt/sync', requireAdmin, async (req, res) => {
    try {
        await fetchWorker('/sync', 'POST', {
            url: req.body.url,
            interval_hours: parseInt(req.body.interval_hours) || 12
        });
        res.status(200).json({ message: "Synchronization task added" });
    } catch (err) {
        console.error("[YT Sync] Setup error:", err.message);
        res.status(500).json({ error: "Error while communicating with Worker." });
    }
});

router.post('/yt/sync/force', requireAdmin, async (req, res) => {
    try {
        await fetchWorker('/sync/force', 'POST');
        res.status(200).json({ message: "Forced synchronization." });
    } catch (err) {
        console.error("[YT Sync] Force sync error:", err.message);
        res.status(500).json({ error: "Error while communicating with Worker." });
    }
});

router.get('/yt/logs', requireAdmin, async (req, res) => {
    try {
        const response = await fetchWorker('/logs', 'GET');
        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

router.get('/yt/tasks', requireAdmin, async (req, res) => {
    try {
        const response = await fetchWorker('/tasks', 'GET');
        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        console.error("[YT Sync] Task dump error:", err.message);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
});

router.delete('/yt/tasks/:id', requireAdmin, async (req, res) => {
    try {
        const taskId = req.params.id;
        await fetchWorker(`/tasks/${taskId}`, 'DELETE');
        res.status(200).json({ message: "Task removed successfully." });
    } catch (err) {
        console.error("[YT Sync] Task removal error:", err.message);
        res.status(500).json({ error: "Failed to delete task" });
    }
});

module.exports = router;
