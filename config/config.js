const path = require('path');
require('dotenv').config();

module.exports = {
    PORT: process.env.SERVER_PORT || 40404,
    CACHE_TTL: 5 * 60 * 1000,
    POLL_INTERVAL_MS: 60 * 1000,
    FETCH_TIMEOUT_MS: 5000,
    UPTIME_KUMA_URL: process.env.UPTIME_KUMA_URL || '',
    UPTIME_KUMA_SLUG: process.env.UPTIME_KUMA_SLUG || 'hub',
    CONTROL_PANEL_URL: process.env.CONTROL_PANEL_URL || '',
    CONTROL_PANEL_KEY: process.env.CONTROL_PANEL_KEY || '',
    ADMIN_PASS: process.env.ADMIN_PASS || '',
    FU_PASS: process.env.FU_PASS || '',
    RATE_LIMITS: {
        SAVE_WINDOW_MS: 15 * 60 * 1000,
        SAVE_MAX: 15,
        REFRESH_WINDOW_MS: 1 * 60 * 1000,
        REFRESH_MAX: 5
    },
    PATHS: {
        PROJECTS_JSON: path.join(__dirname, 'projects.json'),
        FU_DATA_DIR: path.join(__dirname, '..', 'public', 'data', 'fu-projects', 'projects')
    }
};
