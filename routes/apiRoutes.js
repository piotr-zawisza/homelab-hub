const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const crypto = require('crypto');
const config = require('../config/config');
const { clearCache } = require('../services/projectService');
const fuService = require('../services/fuProjectService');
const { fetchUptimeData } = require('../services/uptimeService');
const { fetchPanelData } = require('../services/panelService');

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

const secureCompare = (inputPass, envPass) => {
    const inputBuffer = Buffer.from(inputPass || '');
    const envBuffer = Buffer.from(envPass || '');

    const inputHash = crypto.createHash('sha256').update(inputBuffer).digest();
    const envHash = crypto.createHash('sha256').update(envBuffer).digest();

    return crypto.timingSafeEqual(inputHash, envHash);
};

const requireAdmin = (req, res, next) => {
    const pass = req.headers['authorization'] || req.body.password;
    if (!secureCompare(pass, config.ADMIN_PASS)) {
        return res.status(401).json({ error: "Access denied." });
    }
    next();
};

const requireFuPass = (req, res, next) => {
    const pass = req.headers['authorization'] || req.body.password;
    if (!secureCompare(pass, config.FU_PASS)) {
        return res.status(401).json({ error: "Invalid project password." });
    }
    next();
};

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

router.post('/refresh-cache', refreshLimiter, requireAdmin, async (req, res) => {
    clearCache();
    await Promise.all([
        fetchUptimeData(),
        fetchPanelData()
    ]);
    res.status(200).json({ message: "Cache refreshed successfully" });
});

router.post('/fu-projects/save', saveLimiter, requireFuPass, async (req, res, next) => {
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

module.exports = router;
