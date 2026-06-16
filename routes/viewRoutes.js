const express = require('express');
const dictionary = require('../lang');
const { getCachedProjects } = require('../projectService');
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

        res.render('hub', {
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

module.exports = router;