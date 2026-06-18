const config = require('../config/config');

let panelCache = [];
let initialFetchPromise = null;
let pollTimer = null;

const chunkArray = (arr, size) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

async function fetchPanelData() {
    const url = config.CONTROL_PANEL_URL;
    const apiKey = config.CONTROL_PANEL_KEY;

    if (!url || !apiKey) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.FETCH_TIMEOUT_MS);

    try {
        const res = await fetch(`${url}/api/client?include=allocations`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error("Panel API returned status: " + res.status);

        const data = await res.json();

        const gameServers = data.data.filter(server => {
            const desc = server.attributes.description || "";
            return desc.toLowerCase().includes("[game]");
        });

        let updatedServers = [];
        const chunks = chunkArray(gameServers, 3);

        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (server) => {
                const attrs = server.attributes;
                let connectionAddresses = [];

                if (attrs.relationships?.allocations?.data) {
                    attrs.relationships.allocations.data.forEach(alloc => {
                        const note = alloc.attributes.notes || "";
                        if (note.trim() !== "") {
                            connectionAddresses.push(note.trim());
                        } else if (alloc.attributes.is_default) {
                            const rawIp = alloc.attributes.ip_alias || alloc.attributes.ip;
                            const port = alloc.attributes.port;
                            connectionAddresses.push(`${rawIp}:${port}`);
                        }
                    });
                }

                if (connectionAddresses.length === 0) {
                    connectionAddresses.push("Empty address");
                }

                const srvObj = {
                    id: attrs.identifier,
                    name: attrs.name,
                    ips: connectionAddresses,
                    status: 'pending'
                };

                const statusController = new AbortController();
                const statusTimeout = setTimeout(() => statusController.abort(), 5000);

                try {
                    const statusReq = await fetch(`${url}/api/client/servers/${attrs.identifier}/resources`, {
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        signal: statusController.signal
                    });

                    clearTimeout(statusTimeout);

                    if (statusReq.ok) {
                        const statData = await statusReq.json();
                        const state = statData.attributes.current_state;

                        if (state === 'running') srvObj.status = 'up';
                        else if (state === 'offline') srvObj.status = 'down';
                        else srvObj.status = 'pending';

                    } else {
                        srvObj.status = 'down';
                    }
                } catch (err) {
                    console.error(`[Panel] Status error for ${attrs.name}:`, err.message);
                    srvObj.status = 'down';
                }

                return srvObj;
            });

            const resolvedChunk = await Promise.allSettled(chunkPromises);
            resolvedChunk.forEach(result => {
                if (result.status === 'fulfilled') {
                    updatedServers.push(result.value);
                } else {
                    console.error("[Panel] Rejected verification for entry:", result.reason);
                }
            });
        }

        panelCache = updatedServers;

    } catch (err) {
        console.error("[Panel] Error while fetching:", err.message);
    }
}

async function startPolling() {
    await fetchPanelData();
    pollTimer = setTimeout(startPolling, config.POLL_INTERVAL_MS);
}

initialFetchPromise = startPolling();

async function getPanelData() {
    if (panelCache.length === 0 && initialFetchPromise) {
        await initialFetchPromise;
    }
    return panelCache;
}

module.exports = { getPanelData, fetchPanelData };
