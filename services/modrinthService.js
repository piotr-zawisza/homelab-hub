const config = require('../config/config');

const HEADERS = { 'User-Agent': 'modpack-compat-checker/3.1' };
const WEIGHTS = { 'release': 3, 'beta': 2, 'alpha': 1, '': 0 };
const CF_LOADERS = ['Forge', 'Fabric', 'Quilt', 'NeoForge'];

const GAME_VERSIONS_TTL_MS = 6 * 60 * 60 * 1000;
const PROJECT_TTL_MS = 10 * 60 * 1000;

let gameVersionsCache = { at: 0, set: null };
const projectCache = new Map();

// Bezpieczne parsowanie wersji zapobiegające błędom NaN przy nietypowych tagach (np. "1.20-rc1")
const parseVersion = (v) => {
    const parts = v.split(/[\.\-]/).map(p => parseInt(p, 10));
    return parts.map(p => isNaN(p) ? 0 : p);
};

const isMin1_12_2 = (v) => {
    const p = parseVersion(v);
    return p[0] > 1 || (p[0] === 1 && p[1] > 12) || (p[0] === 1 && p[1] === 12 && (p[2] || 0) >= 2);
};

const fetchWithTimeout = (url, options = {}, timeoutMs = 8000) =>
    fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });

async function fetchOfficialReleases() {
    if (gameVersionsCache.set && Date.now() - gameVersionsCache.at < GAME_VERSIONS_TTL_MS) {
        return gameVersionsCache.set;
    }

    try {
        const r = await fetchWithTimeout("https://api.modrinth.com/v2/tag/game_version", { headers: HEADERS }, 10000);
        if (!r.ok) {
            console.error(`[ModService] Failed to fetch game versions. API HTTP ${r.status}`);
            return gameVersionsCache.set || new Set();
        }
        const data = await r.json();
        const set = new Set(data.filter(i => i.version_type === "release" && isMin1_12_2(i.version)).map(i => i.version));
        gameVersionsCache = { at: Date.now(), set };
        return set;
    } catch (err) {
        console.error("[ModService] Game versions fetch error:", err.message);
        return gameVersionsCache.set || new Set();
    }
}

async function fetchFromModrinth(slug) {
    const key = encodeURIComponent(slug);
    const pRes = await fetchWithTimeout(`https://api.modrinth.com/v2/project/${key}`, { headers: HEADERS });
    if (!pRes.ok) return null;

    const pData = await pRes.json();
    const vRes = await fetchWithTimeout(`https://api.modrinth.com/v2/project/${key}/version`, { headers: HEADERS });
    if (!vRes.ok) return null;

    const versions = await vRes.json();
    return { slug, id: pData.id, name: pData.title, source: 'modrinth', versions };
}

async function fetchFromCurseForge(slug) {
    if (!config.CURSEFORGE_API_KEY) {
        console.error('[ModService] CURSEFORGE_API_KEY is not set, skipping CurseForge.');
        return null;
    }

    const cfHeaders = {
        'x-api-key': config.CURSEFORGE_API_KEY,
        'Accept': 'application/json',
        'User-Agent': HEADERS['User-Agent']
    };

    // gameId 432 = Minecraft, classId 6 = Mods
    const sRes = await fetchWithTimeout(`https://api.curseforge.com/v1/mods/search?gameId=432&classId=6&slug=${encodeURIComponent(slug)}`, { headers: cfHeaders });
    if (!sRes.ok) {
        console.error(`[ModService] CurseForge search failed for ${slug}: HTTP ${sRes.status}`);
        return null;
    }

    const sData = await sRes.json();
    if (!sData.data || sData.data.length === 0) return null;

    const modInfo = sData.data[0];
    const fRes = await fetchWithTimeout(`https://api.curseforge.com/v1/mods/${modInfo.id}/files?pageSize=200`, { headers: cfHeaders });
    if (!fRes.ok) {
        console.error(`[ModService] CurseForge files failed for ${slug}: HTTP ${fRes.status}`);
        return null;
    }

    const fData = await fRes.json();
    const versions = fData.data.map(f => {
        const vType = f.releaseType === 1 ? "release" : (f.releaseType === 2 ? "beta" : "alpha");
        const loaders = (f.gameVersions || []).filter(v => CF_LOADERS.includes(v)).map(v => v.toLowerCase());
        const mcVers = (f.gameVersions || []).filter(v => /^\d+\.\d+(\.\d+)?$/.test(v));
        return { version_type: vType, loaders: loaders.length ? loaders : ['forge'], game_versions: mcVers };
    });

    return { slug, id: `cf:${modInfo.id}`, name: modInfo.name, source: 'curseforge', versions };
}

async function fetchProject(slug, requestedSource = 'any') {
    const cacheKey = `${requestedSource}:${slug}`;
    const cached = projectCache.get(cacheKey);
    if (cached && Date.now() - cached.at < PROJECT_TTL_MS) return cached.value;

    let result = null;
    try {
        if (requestedSource !== 'curseforge') result = await fetchFromModrinth(slug);
        if (!result && requestedSource !== 'modrinth') result = await fetchFromCurseForge(slug);
    } catch (err) {
        console.error(`[ModService] Fetch error for ${slug}:`, err.message);
    }

    if (!result) {
        // Errors are not cached so a retry can succeed
        return { slug, id: null, name: slug, source: 'error', versions: [] };
    }

    projectCache.set(cacheKey, { at: Date.now(), value: result });
    return result;
}

async function fetchAll(slugMap) {
    const dict = {};
    const chunkSize = 15;
    const entries = Array.from(slugMap.entries());

    for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const results = await Promise.all(chunk.map(([slug, src]) => fetchProject(slug, src)));
        results.forEach(r => { if (r) dict[r.slug] = r; });

        if (i + chunkSize < entries.length) {
            await new Promise(res => setTimeout(res, 500));
        }
    }
    return dict;
}

async function generateMatrix(inputRequests) {
    const slugMap = new Map();
    inputRequests.forEach(req => {
        if (typeof req === 'string') slugMap.set(req, 'any');
        else if (req && req.slug) slugMap.set(req.slug, req.source || 'any');
    });

    const slugs = Array.from(slugMap.keys());
    if (!slugs.length) return { slugs: [], modMeta: {}, loaders: {} };

    const validMc = await fetchOfficialReleases();
    const projects = await fetchAll(slugMap);

    // Dependencies are keyed by Modrinth project id, so compare against fetched ids (not slugs)
    const knownIds = new Set(Object.values(projects).map(p => p.id).filter(Boolean));
    const deps = new Map();
    Object.values(projects).forEach(p => {
        (p.versions || []).forEach(v => {
            (v.dependencies || []).forEach(d => {
                if (d.dependency_type === "required" && d.project_id && !knownIds.has(d.project_id)) {
                    deps.set(d.project_id, 'modrinth');
                }
            });
        });
    });

    if (deps.size > 0) {
        const depProjects = await fetchAll(deps);
        Object.entries(depProjects).forEach(([key, p]) => {
            // Skip dependencies that resolve to an already listed project
            if (p.id && knownIds.has(p.id)) return;
            if (p.id) knownIds.add(p.id);
            projects[key] = p;
            slugs.push(key);
        });
    }

    const matrix = {};
    const modMeta = {};

    for (const [slug, pData] of Object.entries(projects)) {
        modMeta[slug] = { name: pData.name, source: pData.source };

        for (const v of pData.versions) {
            const vType = v.version_type || "";
            const loaders = v.loaders || [];
            const mcVers = (v.game_versions || []).filter(gv => validMc.has(gv));

            for (const mcVer of mcVers) {
                for (const loader of loaders) {
                    if (!matrix[loader]) matrix[loader] = {};
                    if (!matrix[loader][mcVer]) matrix[loader][mcVer] = {};

                    const prev = matrix[loader][mcVer][slug] || "";
                    if (prev === "release" || (prev === "beta" && vType === "alpha")) continue;
                    matrix[loader][mcVer][slug] = vType;
                }
            }
        }
    }

    const out = { slugs, modMeta, loaders: {} };
    for (const [loader, mcs] of Object.entries(matrix)) {
        const rows = [];
        for (const [mcVer, mods] of Object.entries(mcs)) {
            const cells = slugs.map(s => mods[s] || "");
            const f = cells.filter(c => c).length;
            const q = cells.reduce((sum, c) => sum + (WEIGHTS[c] || 0), 0);
            rows.push({ v: mcVer, c: cells, f, q });
        }

        rows.sort((a, b) => {
            if (a.f !== b.f) return b.f - a.f;
            if (a.q !== b.q) return b.q - a.q;
            const pa = parseVersion(a.v), pb = parseVersion(b.v);
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                const diff = (pb[i] || 0) - (pa[i] || 0);
                if (diff !== 0) return diff;
            }
            return 0;
        });
        out.loaders[loader] = rows;
    }

    const errors = Object.values(projects).filter(p => p.source === 'error').length;
    console.log(`[ModService] Matrix built: ${slugs.length} mods (${errors} failed), ${Object.keys(out.loaders).length} loaders.`);
    return out;
}

module.exports = { generateMatrix };
