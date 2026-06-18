const config = require('../config/config');

let uptimeCache = [];
let initialFetchPromise = null;
let pollTimer = null;

async function fetchUptimeData() {
    const url = config.UPTIME_KUMA_URL;
    const slug = config.UPTIME_KUMA_SLUG;

    if (!url) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.FETCH_TIMEOUT_MS);

    try {
        const res = await fetch(`${url}/api/status-page/${slug}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error("API returned status: " + res.status);

        const data = await res.json();
        let services = [];
        let badgePromises = [];

        if (data.publicGroupList && data.publicGroupList.length > 0) {
            data.publicGroupList.forEach(group => {
                group.monitorList.forEach(monitor => {
                    const serviceData = {
                        name: monitor.name,
                        status: 'pending',
                        url: monitor.url || '#'
                    };
                    services.push(serviceData);

                    const badgeController = new AbortController();
                    const badgeTimeout = setTimeout(() => badgeController.abort(), 5000);

                    const badgeReq = fetch(`${url}/api/badge/${monitor.id}/status`, { signal: badgeController.signal })
                        .then(r => r.text())
                        .then(svg => {
                            clearTimeout(badgeTimeout);
                            const svgLower = svg.toLowerCase();
                            if (svgLower.includes('>up<') || svgLower.includes('#4c1')) {
                                serviceData.status = 'up';
                            } else if (svgLower.includes('>down<') || svgLower.includes('#e05d44')) {
                                serviceData.status = 'down';
                            }
                        })
                        .catch(err => console.error(`[Uptime] Badge error ${monitor.name}:`, err.message));

                    badgePromises.push(badgeReq);
                });
            });
        }
        await Promise.all(badgePromises);
        uptimeCache = services;
    } catch (err) {
        console.error("[Uptime] Error while fetching:", err.message);
    }
}

async function startPolling() {
    await fetchUptimeData();
    pollTimer = setTimeout(startPolling, config.POLL_INTERVAL_MS);
}

initialFetchPromise = startPolling();

async function getUptimeData() {
    if (uptimeCache.length === 0 && initialFetchPromise) {
        await initialFetchPromise;
    }
    return uptimeCache;
}

module.exports = { getUptimeData, fetchUptimeData };
