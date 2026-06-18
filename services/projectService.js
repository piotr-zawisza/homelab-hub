const fsp = require('fs').promises;
const path = require('path');

let projectsCache = null;

async function getCachedProjects() {
    if (projectsCache) {
        return projectsCache;
    }

    try {
        const projectsPath = path.join(__dirname, '..', 'config', 'projects.json');
        const data = await fsp.readFile(projectsPath, 'utf-8');
        projectsCache = JSON.parse(data);
        return projectsCache;
    } catch (err) {
        console.error("[ERROR] Failed to load config/projects.json:", err.message);
        return [];
    }
}

function clearCache() {
    projectsCache = null;
    console.log("[INFO] Projects cache refreshed (Loaded from JSON).");
}

module.exports = { getCachedProjects, clearCache };
