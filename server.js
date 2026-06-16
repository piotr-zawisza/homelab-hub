const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');

const config = require('./config');
const dictionary = require('./lang');
const fuService = require('./services/fuProjectService');
fuService.init();

const apiRoutes = require('./routes/apiRoutes');
const viewRoutes = require('./routes/viewRoutes');

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'",
                "'unsafe-eval'",
                "https://cdnjs.cloudflare.com", 
                "https://cdn.jsdelivr.net", 
                "https://unpkg.com"
            ],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"], 
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.set('view engine', 'ejs');
app.set('views', __dirname);

app.use((req, res, next) => {
    let lang = req.query.lang;
    if (!lang) {
        const acceptLanguage = req.headers['accept-language'] || '';
        lang = acceptLanguage.toLowerCase().includes('pl') ? 'pl' : 'en';
    }
    req.lang = lang;
    next();
});

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.use('/', viewRoutes);
app.use('/api', apiRoutes);
app.use(express.static(config.WEBSERVER_DIR));

app.use((req, res) => {
    const lang = req.lang || 'en';
    const t = dictionary[lang] || dictionary['en'];

    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="${lang}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t.errorTitle}</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <div class="box" style="text-align: center;">
                <h1 style="color: #ff5252; border: none; margin-bottom: 0;">404</h1>
                <p style="color: #a0a0b0; margin-bottom: 25px;">${t.errorDesc}</p>
                <a class="project-card-link" href="/?lang=${lang}">
                    <div class="project-item" style="justify-content: center;">
                        <span class="project-name">${t.backToHub}</span>
                    </div>
                </a>
            </div>
        </body>
        </html>
    `);
});

app.use((err, req, res, next) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.url}:`, err.message);
    
    if (res.headersSent) {
        return next(err);
    }
    
    if (req.path.startsWith('/api/')) {
        res.status(500).json({ error: "Internal server error." });
    } else {
        res.status(500).send("<h1>500 - Internal server error</h1>");
    }
});

app.listen(config.PORT, () => {
    console.log(`[SUCCESS] Web server running on port ${config.PORT}`);
});