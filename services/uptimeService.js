const config = require('../config');

let uptimeCache = [];
let initialFetchPromise = null;

async function fetchUptimeData() {
    const url = process.env.UPTIME_KUMA_URL;
    const slug = process.env.UPTIME_KUMA_SLUG || 'hub';

    if (!url) return;

    try {
        const res = await fetch(`${url}/api/status-page/${slug}`);
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

                    const badgeReq = fetch(`${url}/api/badge/${monitor.id}/status`)
                        .then(r => r.text())
                        .then(svg => {
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

initialFetchPromise = fetchUptimeData();
setInterval(fetchUptimeData, 60 * 1000);

async function getUptimeData() {
    if (uptimeCache.length === 0 && initialFetchPromise) {
        await initialFetchPromise;
    }
    return uptimeCache;
}

module.exports = { getUptimeData, fetchUptimeData };