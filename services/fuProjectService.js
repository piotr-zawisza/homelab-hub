const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data', 'fu-projects');

async function init() {
    try {
        await fsp.mkdir(DATA_DIR, { recursive: true });
    } catch (err) {
        console.error("[ERROR] Failed to create fu-projects directory:", err);
    }
}

async function saveProject(payload, existingId) {
    let id = existingId;
    if (!id || typeof id !== 'string' || !/^[a-f0-9]{8}$/i.test(id)) {
        id = crypto.randomBytes(4).toString('hex');
    }

    payload.id = id;
    await fsp.writeFile(path.join(DATA_DIR, `${id}.json`), JSON.stringify(payload));
    return id;
}

async function loadProject(id) {
    const safeId = id.replace(/[^a-f0-9]/gi, '');
    const data = await fsp.readFile(path.join(DATA_DIR, `${safeId}.json`), 'utf-8');
    return JSON.parse(data);
}

module.exports = { init, saveProject, loadProject };