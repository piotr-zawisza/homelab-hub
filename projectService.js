const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const config = require('./config');

let projectsCache = null;
let lastCacheTime = 0;

async function getFallbackNameFromHtml(filePath) {
    return new Promise((resolve) => {
        const stream = fs.createReadStream(filePath, { encoding: 'utf-8', start: 0, end: 8192 });
        let content = '';
        
        stream.on('data', chunk => {
            content += chunk;
            const match = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (match && match[1] && match[1].trim() !== "") {
                stream.destroy();
                resolve(match[1].trim());
            }
        });
        
        stream.on('end', () => resolve(null));
        stream.on('error', () => resolve(null));
    });
}

async function getProjectData(dirName) {
    const projectPath = path.join(config.WEBSERVER_DIR, dirName);
    
    try {
        const manifestContent = await fsp.readFile(path.join(projectPath, 'manifest.json'), 'utf-8');
        const manifest = JSON.parse(manifestContent);
        return {
            name: manifest.name || {},
            description: manifest.description || {},
            status: manifest.status || null
        };
    } catch (err) {
        console.warn(`[WARN] Invalid or non-existent manifest for '${dirName}': ${err.message}`);
    }

    let fallbackName = dirName.charAt(0).toUpperCase() + dirName.slice(1).replace(/-/g, ' ');
    try {
        const htmlTitle = await getFallbackNameFromHtml(path.join(projectPath, 'index.html'));
        if (htmlTitle) {
            fallbackName = htmlTitle;
        }
    } catch (err) {
        console.warn(`[WARN] Couldn't find index.html for '${dirName}': ${err.message}`);
    }

    return {
        name: { pl: fallbackName, en: fallbackName },
        description: { pl: "", en: "" },
        status: null
    };
}

async function getCachedProjects() {
    const now = Date.now();
    if (projectsCache && (now - lastCacheTime < config.CACHE_TTL)) {
        return projectsCache;
    }

    try {
        const files = await fsp.readdir(config.WEBSERVER_DIR, { withFileTypes: true });
        const directories = files.filter(d => d.isDirectory()).map(d => d.name);

        const projects = await Promise.all(directories.map(async (dir) => {
            const data = await getProjectData(dir);
            return { dir, ...data };
        }));

        projectsCache = projects;
        lastCacheTime = now;
        return projectsCache;
    } catch (err) {
        console.error("[ERROR] Couldn't update projects cache:", err);
        return projectsCache || [];
    }
}

function clearCache() {
    projectsCache = null;
    lastCacheTime = 0;
    console.log("[INFO] Projects cache refreshed.");
}

module.exports = { getCachedProjects, clearCache };