const path = require('path');

module.exports = {
    PORT: process.env.SERVER_PORT || 8080,
    WEBSERVER_DIR: path.join(__dirname, 'webserver'),
    CACHE_TTL: 5 * 60 * 1000,
    UPTIME_KUMA_URL: process.env.UPTIME_KUMA_URL || '',
    UPTIME_KUMA_SLUG: process.env.UPTIME_KUMA_SLUG || 'hub',
    CONTROL_PANEL_URL: process.env.CONTROL_PANEL_URL || '',
    CONTROL_PANEL_KEY: process.env.CONTROL_PANEL_KEY || ''
};