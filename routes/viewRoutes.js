const express = require('express');
const fsp = require('fs').promises;
const path = require('path');
const { getCachedProjects } = require('../services/projectService');
const uptimeService = require('../services/uptimeService');
const panelService = require('../services/panelService');
const config = require('../config/config');
const { isAdminSession } = require('../middleware/auth');

const router = express.Router();

router.use((req, res, next) => {
    res.locals.isLoggedIn = isAdminSession(req);
    next();
});

router.get('/', async (req, res, next) => {
    try {
        const [projects, services, panelServers] = await Promise.all([
            getCachedProjects(),
            uptimeService.getUptimeData(),
            panelService.getPanelData()
        ]);

        res.render('index', {
            projects: projects,
            services: services,
            panelServers: panelServers
        });
    } catch (err) {
        next(err);
    }
});

router.get('/fu-projects', (req, res) => {
    res.render('fu-projects', {
        appConfig: config.CONSTANTS.FU_PROJECT
    });
});

router.get('/quizzer', async (req, res) => {
    let quizSets = [];

    try {
        const quizDir = path.join(__dirname, '../public/data/quizzer/quiz-set');
        const files = await fsp.readdir(quizDir);
        quizSets = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch (err) {
        console.error("[Quizzer] Error while reading quiz-set directory:", err);
    }

    res.render('quizzer', {
        appConfig: config.CONSTANTS.QUIZZER,
        quizSets: quizSets
    });
});

router.get('/yt-sync', (req, res) => {
    res.render('yt-sync');
});

router.get('/mod-compat', (req, res) => {
    res.render('mod-compat');
});

module.exports = router;
