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
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net",
                "https://unpkg.com"
            ],
            styleSrc: ["'self'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    let lang = req.query.lang;
    if (!lang) {
        const acceptLanguage = req.headers['accept-language'] || '';
        lang = acceptLanguage.toLowerCase().includes('pl') ? 'pl' : 'en';
    }
    req.lang = lang;
    next();
});
app.use('/', viewRoutes);
app.use('/api', apiRoutes);
app.use((req, res) => {
    res.status(404).render('error404', { lang: req.lang, t: dictionary[req.lang] || dictionary['en'] });
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
        app.listen(config.PORT, () => {
            console.log(`[SUCCESS] Web server running on port ${config.PORT}`);
        });
    } catch (err) {
        console.error("[FATAL] Error while initialising services:", err);
        process.exit(1);
    }
}

bootstrap();
