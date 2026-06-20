const path = require('path');
require('dotenv').config();

module.exports = {
    PORT: process.env.SERVER_PORT || 40404,
    SESSION_SECRET: process.env.SESSION_SECRET || 'super_secret_fallback_salt_123',
    POLL_INTERVAL_MS: 60 * 1000,
    FETCH_TIMEOUT_MS: 5000,
    UPTIME_KUMA_URL: process.env.UPTIME_KUMA_URL || '',
    UPTIME_KUMA_SLUG: process.env.UPTIME_KUMA_SLUG || 'hub',
    CONTROL_PANEL_URL: process.env.CONTROL_PANEL_URL || '',
    CONTROL_PANEL_KEY: process.env.CONTROL_PANEL_KEY || '',
    YT_WORKER_URL: process.env.YT_WORKER_URL || '',
    YT_WORKER_KEY: process.env.YT_WORKER_KEY || '',
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
    },
    CONSTANTS: {
        PANEL_GAME_SERVER_TAG: process.env.PANEL_GAME_SERVER_TAG || '[game]',
        PANEL_CHUNK_SIZE: 3,
        API_TIMEOUT_MS: 5000,
        FU_PROJECT: {
            DEFAULT_BASE_COST: 400,
            DEFAULT_CLOCK_SECTIONS: 6
        },
        QUIZZER: {
            AUTO_SKIP_TIME_MS: 1500,
            SHUFFLE_QUESTIONS: true,
            SHUFFLE_ANSWERS: true
        }
    }
};
