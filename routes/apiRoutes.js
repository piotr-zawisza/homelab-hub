const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const config = require('../config/config');
const { clearCache } = require('../services/projectService');
const fuService = require('../services/fuProjectService');
const { fetchUptimeData } = require('../services/uptimeService');
const { fetchPanelData } = require('../services/panelService');
const modrinthService = require('../services/modrinthService');
const { ADMIN_COOKIE_TOKEN, secureCompare, requireAdmin } = require('../middleware/auth');

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

const compatLimiter = rateLimit({
    windowMs: config.RATE_LIMITS.COMPAT_WINDOW_MS,
    max: config.RATE_LIMITS.COMPAT_MAX,
    message: { error: "Too many tries. Try again later." }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: "Too many signing in tries. Try again later." }
});

router.post('/auth/login', loginLimiter, (req, res) => {
    if (secureCompare(req.body.password, config.ADMIN_PASS)) {
        res.cookie('hub_session', ADMIN_COOKIE_TOKEN, {
            httpOnly: true,
            sameSite: 'strict',
            secure: req.secure,
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

router.post('/refresh-cache', refreshLimiter, requireAdmin, async (req, res, next) => {
    try {
        clearCache();
        await Promise.all([
            fetchUptimeData(),
            fetchPanelData()
        ]);
        res.status(200).json({ message: "Cache refreshed successfully" });
    } catch (err) {
        next(err);
    }
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

const requireWorker = (req, res, next) => {
    if (!config.YT_WORKER_URL) {
        return res.status(503).json({ error: "YT worker is not configured." });
    }
    next();
};
router.use('/yt', requireWorker);

const fetchWorker = async (endpoint, method, body = null) => {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': config.YT_WORKER_KEY
        },
        signal: AbortSignal.timeout(10000)
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
            interval_hours: parseInt(req.body.interval_hours) || 12,
            target_dir: req.body.target_dir || null
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
        await fetchWorker(`/tasks/${encodeURIComponent(taskId)}`, 'DELETE');
        res.status(200).json({ message: "Task removed successfully." });
    } catch (err) {
        console.error("[YT Sync] Task removal error:", err.message);
        res.status(500).json({ error: "Failed to delete task" });
    }
});

const MOD_SLUG_RE = /^[\w.-]{1,100}$/;
const compatSchema = Joi.object({
    slugs: Joi.array().min(1).max(150).items(
        Joi.string().pattern(MOD_SLUG_RE),
        Joi.object({
            slug: Joi.string().pattern(MOD_SLUG_RE).required(),
            source: Joi.string().valid('any', 'modrinth', 'curseforge').default('any')
        })
    ).required()
});

router.post('/mods/compat', compatLimiter, async (req, res, next) => {
    try {
        const { error, value } = compatSchema.validate({ slugs: req.body.slugs });
        if (error) {
            return res.status(400).json({ error: "Invalid payload." });
        }

        const data = await modrinthService.generateMatrix(value.slugs);
        res.status(200).json(data);
    } catch (err) {
        console.error("[ModCompat] Matrix generation failed:", err.message);
        next(err);
    }
});

module.exports = router;
