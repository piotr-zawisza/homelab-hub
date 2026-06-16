const config = require('../config');

let panelCache = [];
let initialFetchPromise = null;

async function fetchPanelData() {
    const url = process.env.CONTROL_PANEL_URL;
    const apiKey = process.env.CONTROL_PANEL_KEY;

    if (!url || !apiKey) return;

    try {
        const res = await fetch(`${url}/api/client?include=allocations`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!res.ok) throw new Error("Panel API returned status: " + res.status);

        const data = await res.json();
        let servers = [];
        let statusPromises = [];

        for (const server of data.data) {
            const attrs = server.attributes;
            
            const desc = attrs.description || "";
            if (!desc.toLowerCase().includes("[game]")) {
                continue;
            }

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
            servers.push(srvObj);

            const statusReq = fetch(`${url}/api/client/servers/${attrs.identifier}/resources`, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            })
            .then(r => r.ok ? r.json() : null)
            .then(statData => {
                if (statData) {
                    const state = statData.attributes.current_state;
                    if (state === 'running') srvObj.status = 'up';
                    else if (state === 'offline') srvObj.status = 'down';
                    else srvObj.status = 'pending';
                } else {
                    srvObj.status = 'down';
                }
            })
            .catch(err => console.error(`[Panel] Status error for ${attrs.name}:`, err.message));

            statusPromises.push(statusReq);
        }

        await Promise.all(statusPromises);
        panelCache = servers;

    } catch (err) {
        console.error("[Panel] Error while fetching:", err.message);
    }
}

initialFetchPromise = fetchPanelData();
setInterval(fetchPanelData, 60 * 1000);

async function getPanelData() {
    if (panelCache.length === 0 && initialFetchPromise) {
        await initialFetchPromise;
    }
    return panelCache;
}

module.exports = { getPanelData, fetchPanelData };