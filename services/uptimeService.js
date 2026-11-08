const config = require('../config/config');

let uptimeCache = [];
let initialFetchPromise = null;
let pollTimer = null;

// Uptime Kuma heartbeat status codes: 0 = down, 1 = up, 2 = pending, 3 = maintenance
const STATUS_MAP = { 0: 'down', 1: 'up' };

async function fetchJson(endpoint) {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(config.FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error("API returned status: " + res.status);
    return res.json();
}

async function fetchUptimeData() {
    const url = config.UPTIME_KUMA_URL;
    const slug = encodeURIComponent(config.UPTIME_KUMA_SLUG);

    if (!url) return;

    try {
        const [page, heartbeats] = await Promise.all([
            fetchJson(`${url}/api/status-page/${slug}`),
            fetchJson(`${url}/api/status-page/heartbeat/${slug}`)
        ]);

        const heartbeatList = heartbeats.heartbeatList || {};
        const services = [];

        (page.publicGroupList || []).forEach(group => {
            (group.monitorList || []).forEach(monitor => {
                const beats = heartbeatList[monitor.id] || [];
                const last = beats[beats.length - 1];

                services.push({
                    name: monitor.name,
                    status: last ? (STATUS_MAP[last.status] || 'pending') : 'pending',
                    url: monitor.url || '#'
                });
            });
        });

        uptimeCache = services;
    } catch (err) {
        console.error("[Uptime] Error while fetching:", err.message);
    }
}

async function startPolling() {
    await fetchUptimeData();
    pollTimer = setTimeout(startPolling, config.POLL_INTERVAL_MS);
    pollTimer.unref();
}

initialFetchPromise = startPolling();

async function getUptimeData() {
    if (uptimeCache.length === 0 && initialFetchPromise) {
        await initialFetchPromise;
    }
    return uptimeCache;
}

module.exports = { getUptimeData, fetchUptimeData };
