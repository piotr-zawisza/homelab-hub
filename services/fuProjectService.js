const fsSync = require('fs');
const fsp = fsSync.promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');

const DATA_DIR = config.PATHS.FU_DATA_DIR;

const fileLocks = new Map();

async function acquireLock(id) {
    let release;
    const nextLock = new Promise(resolve => { release = resolve; });

    if (fileLocks.has(id)) {
        const currentLock = fileLocks.get(id);
        fileLocks.set(id, currentLock.then(() => nextLock));
        await currentLock;
    } else {
        fileLocks.set(id, nextLock);
    }

    return () => {
        if (fileLocks.get(id) === nextLock) {
            fileLocks.delete(id);
        }
        release();
    };
}

// One-time move of saves out of public/ (they used to be served by express.static)
async function migrateLegacySaves() {
    const legacyDir = config.PATHS.FU_LEGACY_DATA_DIR;
    let files;
    try {
        files = await fsp.readdir(legacyDir);
    } catch (err) {
        if (err.code === 'ENOENT') return;
        throw err;
    }

    let migrated = 0;
    for (const file of files) {
        if (!/^[a-f0-9]{8}\.json$/i.test(file)) {
            if (file.endsWith('.temp.json')) console.warn(`[WARN] FU migration: skipped leftover temp file ${file}`);
            continue;
        }
        const src = path.join(legacyDir, file);
        try {
            await fsp.copyFile(src, path.join(DATA_DIR, file), fsSync.constants.COPYFILE_EXCL);
            await fsp.unlink(src);
            migrated++;
        } catch (err) {
            if (err.code === 'EEXIST') {
                console.warn(`[WARN] FU migration: ${file} already exists in the new directory, left the old copy in place`);
            } else {
                console.error(`[ERROR] FU migration failed for ${file}:`, err);
            }
        }
    }
    if (migrated > 0) console.log(`[FU] Migrated ${migrated} saves out of public/data`);
}

async function init() {
    try {
        await fsp.mkdir(DATA_DIR, { recursive: true });
    } catch (err) {
        console.error("[ERROR] Failed to create fu-projects directory:", err);
        throw err;
    }
    try {
        await migrateLegacySaves();
    } catch (err) {
        console.error("[ERROR] FU legacy save migration failed:", err);
    }
}

async function saveProject(payload, existingId) {
    let id = existingId;

    if (!id || typeof id !== 'string' || !/^[a-f0-9]{8}$/i.test(id)) {
        let isUnique = false;
        while (!isUnique) {
            id = crypto.randomBytes(4).toString('hex');
            try {
                await fsp.access(path.join(DATA_DIR, `${id}.json`));
            } catch (err) {
                if (err.code === 'ENOENT') {
                    isUnique = true;
                } else {
                    throw err;
                }
            }
        }
    }

    const releaseLock = await acquireLock(id);
    try {
        payload.id = id;

        const tempFilePath = path.join(DATA_DIR, `${id}.temp.json`);
        const finalFilePath = path.join(DATA_DIR, `${id}.json`);

        await fsp.writeFile(tempFilePath, JSON.stringify(payload));
        await fsp.rename(tempFilePath, finalFilePath);
    } finally {
        releaseLock();
    }
    return id;
}

async function loadProject(id) {
    const safeId = id.replace(/[^a-f0-9]/gi, '');
    const data = await fsp.readFile(path.join(DATA_DIR, `${safeId}.json`), 'utf-8');
    return JSON.parse(data);
}

module.exports = { init, saveProject, loadProject };
