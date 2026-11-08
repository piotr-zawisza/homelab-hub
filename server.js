const express = require('express');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.error("[FATAL] Couldn't find .env file! Stopping...");
    process.exit(1);
}

const config = require('./config/config');
if (!config.ADMIN_PASS || config.ADMIN_PASS.length < 8) {
    console.error("[FATAL] ADMIN_PASS is missing or too short! Minimum 8 characters required.");
    process.exit(1);
}

const dictionary = require('./lang');
const fuService = require('./services/fuProjectService');

const apiRoutes = require('./routes/apiRoutes');
const viewRoutes = require('./routes/viewRoutes');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views/pages'));
app.set('trust proxy', 1);

app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('hex');
    next();
});

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                (req, res) => `'nonce-${res.locals.nonce}'`,
                "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/",
                "https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/",
                "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/",
                "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/"
            ],
            styleSrc: ["'self'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// Only supported languages ever reach the views (lang is embedded in pages)
app.use((req, res, next) => {
    const queryLang = typeof req.query.lang === 'string' ? req.query.lang : null;
    // acceptsLanguages() returns the first offered language when the header is absent, so check it explicitly
    const headerLang = req.headers['accept-language'] ? req.acceptsLanguages('pl', 'en') : false;
    const lang = dictionary[queryLang] ? queryLang : (headerLang || 'en');
    req.lang = lang;
    res.locals.lang = lang;
    res.locals.t = dictionary[lang];
    // JSON for <script type="application/json">: '<' escaped so it can't close the tag
    res.locals.safeJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
    next();
});
app.use('/', viewRoutes);
app.use('/api', apiRoutes);
app.use((req, res) => {
    res.status(404).render('error404');
});

app.use((err, req, res, next) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.url}:`, err.message);
    if (res.headersSent) return next(err);
    if (req.path.startsWith('/api/')) {
        res.status(500).json({ error: "Internal server error." });
    } else {
        res.status(500).send("<h1>500 - Internal server error</h1>");
    }
});

async function bootstrap() {
    try {
        await fuService.init();
        const server = app.listen(config.PORT, () => {
            console.log(`[SUCCESS] Web server running on port ${config.PORT}`);
        });

        const shutdown = (signal) => {
            console.log(`[INFO] ${signal} received, shutting down...`);
            server.close(() => process.exit(0));
            setTimeout(() => process.exit(1), 5000).unref();
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (err) {
        console.error("[FATAL] Error while initialising services:", err);
        process.exit(1);
    }
}

bootstrap();
