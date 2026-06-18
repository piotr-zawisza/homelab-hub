const express = require('express');
const dictionary = require('../lang');
const { getCachedProjects } = require('../services/projectService');
const uptimeService = require('../services/uptimeService');
const panelService = require('../services/panelService');

const router = express.Router();

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
        fullDictionary: dictionary
    });
});

router.get('/quizzer', (req, res) => {
    const t = dictionary[req.lang] || dictionary['en'];
    res.render('quizzer', { lang: req.lang, t: t });
});

module.exports = router;
