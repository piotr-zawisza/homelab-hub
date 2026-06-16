const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const { clearCache } = require('../projectService');
const fuService = require('../services/fuProjectService');
const { fetchUptimeData } = require('../services/uptimeService');
const { fetchPanelData } = require('../services/panelService');

const router = express.Router();

const saveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { error: "Too many tries. Try again later." }
});

const refreshLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    message: { error: "Too many refresh tries. Try again later." }
});

const requireAdmin = (req, res, next) => {
    const pass = req.headers['authorization'] || req.body.password;
    if (pass !== process.env.ADMIN_PASS) {
        return res.status(401).json({ error: "Access denied" });
    }
    next();
};

const payloadSchema = Joi.object({
    id: Joi.string().allow('', null).optional(),
    // Możesz tu w przyszłości zdefiniować dokładną strukturę, np.:
    // name: Joi.string().max(100).required(),
}).unknown(true); // .unknown(true) pozwala narazie na dowolne inne klucze

router.post('/refresh-cache', refreshLimiter, async (req, res) => {
    clearCache();
    await Promise.all([
        fetchUptimeData(),
        fetchPanelData()
    ]);
    res.status(200).json({ message: "Cache refreshed successfully" });
});

router.post('/fu-projects/save', saveLimiter, async (req, res, next) => {
    try {
        const { password, payload } = req.body;
        
        if (password !== process.env.FU_GROUP_PASS) {
            return res.status(401).json({ error: "Invalid password." });
        }

        if (!payload) {
            return res.status(400).json({ error: "No payload." });
        }

        const { error } = payloadSchema.validate(payload);
        if (error) {
            return res.status(400).json({ error: "Invalid data structure.", details: error.details });
        }

        const id = await fuService.saveProject(payload, payload.id);
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