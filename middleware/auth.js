const crypto = require('crypto');
const config = require('../config/config');

const ADMIN_COOKIE_TOKEN = crypto.createHash('sha256').update(config.ADMIN_PASS + config.SESSION_SECRET).digest('hex');

const secureCompare = (inputPass, envPass) => {
    if (!inputPass || !envPass || typeof inputPass !== 'string' || typeof envPass !== 'string') {
        return false;
    }

    const inputHash = crypto.createHash('sha256').update(inputPass).digest();
    const envHash = crypto.createHash('sha256').update(envPass).digest();

    return crypto.timingSafeEqual(inputHash, envHash);
};

// Length-checked, so a malformed cookie can never make timingSafeEqual throw
const isAdminSession = (req) => {
    const cookieSession = req.cookies ? req.cookies.hub_session : null;
    if (typeof cookieSession !== 'string') return false;

    const cookieBuffer = Buffer.from(cookieSession);
    const tokenBuffer = Buffer.from(ADMIN_COOKIE_TOKEN);

    return cookieBuffer.length === tokenBuffer.length && crypto.timingSafeEqual(cookieBuffer, tokenBuffer);
};

const requireAdmin = (req, res, next) => {
    if (isAdminSession(req)) return next();

    const pass = req.headers['authorization'] || (req.body && req.body.password);
    if (secureCompare(pass, config.ADMIN_PASS)) return next();

    return res.status(401).json({ error: "Unauthorized. Sign in." });
};

module.exports = { ADMIN_COOKIE_TOKEN, secureCompare, isAdminSession, requireAdmin };
