const express = require('express');
const crypto = require('crypto');
const dictionary = require('../lang');
const { getCachedProjects } = require('../services/projectService');
const uptimeService = require('../services/uptimeService');
const panelService = require('../services/panelService');
const config = require('../config/config');

const router = express.Router();

const ADMIN_COOKIE_TOKEN = crypto.createHash('sha256').update(config.ADMIN_PASS + config.SESSION_SECRET).digest('hex');

router.use((req, res, next) => {
    const cookieSession = req.cookies ? req.cookies.hub_session : null;
    if (cookieSession && crypto.timingSafeEqual(Buffer.from(cookieSession), Buffer.from(ADMIN_COOKIE_TOKEN))) {
        res.locals.isLoggedIn = true;
    } else {
        res.locals.isLoggedIn = false;
    }
    next();
});

router.get('/', async (req, res, next) => {
    try {
        const lang = req.lang;

        const [projects, services, panelServers] = await Promise.all([
            getCachedProjects(),
            uptimeService.getUptimeData(),
            panelService.getPanelData()
        ]);

        const t = dictionary[lang] || dictionary['en'];

        res.render('index', {
            lang: lang,
            t: t,
            projects: projects,
            services: services,
            panelServers: panelServers
        });
    } catch (err) {
        next(err);
    }
});

router.get('/fu-projects', (req, res) => {
    const t = dictionary[req.lang] || dictionary['en'];
    res.render('fu-projects', {
        lang: req.lang,
        t: t,
        appConfig: config.CONSTANTS.FU_PROJECT
    });
});

router.get('/quizzer', (req, res) => {
    const t = dictionary[req.lang] || dictionary['en'];
    res.render('quizzer', {
        lang: req.lang,
        t: t,
        appConfig: config.CONSTANTS.QUIZZER
    });
});


router.get('/yt-sync', (req, res) => {
    const t = dictionary[req.lang] || dictionary['en'];
    res.render('yt-sync', {
        lang: req.lang,
        t: t
    });
});

module.exports = router;
