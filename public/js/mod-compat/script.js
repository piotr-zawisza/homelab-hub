document.addEventListener('DOMContentLoaded', () => {
    const dict = (window.DICT && window.DICT.mod_compat) ? window.DICT.mod_compat : {};

    const btnSubmit = document.getElementById('btn-submit');
    const inputArea = document.getElementById('mods-input');
    const inputCollapseArea = document.getElementById('input-collapse-area');
    const btnToggleInput = document.getElementById('btn-toggle-input');

    const resultsContainer = document.getElementById('results-container');
    const loaderTabs = document.getElementById('loader-tabs');
    const compatTable = document.getElementById('compat-table');
    const compatHead = document.getElementById('compat-head');
    const compatBody = document.getElementById('compat-body');

    let currentData = null;
    let currentLoader = null;
    let currentMinCoverage = 0;

    const filterContainer = document.getElementById('filter-container');
    const minCoverageInput = document.getElementById('min-coverage');
    const minCoverageVal = document.getElementById('min-coverage-val');

    // API data (mod names, slugs, versions) is untrusted - escape before it goes into innerHTML
    const escapeHtml = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const setInputCollapsed = (collapsed) => {
        inputCollapseArea.classList.toggle('d-none', collapsed);
        btnToggleInput.innerText = collapsed ? dict.btn_edit : dict.btn_hide;
        btnToggleInput.classList.toggle('btn-secondary', collapsed);
        btnToggleInput.classList.toggle('btn-primary', !collapsed);
    };

    minCoverageInput.addEventListener('input', (e) => {
        currentMinCoverage = parseInt(e.target.value, 10);
        minCoverageVal.innerText = `${currentMinCoverage}%`;
        render();
    });

    btnToggleInput.addEventListener('click', () => {
        setInputCollapsed(!inputCollapseArea.classList.contains('d-none'));
    });

    // "slug", "modrinth.com/mod/slug" or "curseforge.com/minecraft/mc-mods/slug" (query/path suffixes ignored)
    const parseLine = (line) => {
        const cf = line.match(/curseforge\.com\/minecraft\/mc-mods\/([^/?#\s]+)/);
        if (cf) return { slug: cf[1], source: 'curseforge' };

        const mr = line.match(/modrinth\.com\/mod\/([^/?#\s]+)/);
        if (mr) return { slug: mr[1], source: 'modrinth' };

        if (line.startsWith('http')) return null;
        return { slug: line, source: 'any' };
    };

    btnSubmit.addEventListener('click', async () => {
        const slugs = inputArea.value.split('\n')
            .map(line => line.split('#')[0].trim())
            .filter(line => line.length > 0)
            .map(parseLine)
            .filter(Boolean);

        if (!slugs.length) return window.showToast(dict.err_empty, "error");

        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '...';
        btnSubmit.disabled = true;

        try {
            const res = await fetch('/api/mods/compat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slugs })
            });

            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            currentData = await res.json();

            if (!currentData || !currentData.loaders || !Object.keys(currentData.loaders).length) {
                window.showToast(dict.err_none, "warning");
                return;
            }

            currentLoader = Object.keys(currentData.loaders).sort()[0];
            resultsContainer.classList.remove('d-none');
            btnToggleInput.classList.remove('d-none');
            setInputCollapsed(true);
            render();
        } catch (err) {
            console.error("[ModCompat] Request or render error:", err);
            window.showToast(dict.err_fetch, "error");
        } finally {
            btnSubmit.innerHTML = originalText;
            btnSubmit.disabled = false;
        }
    });

    function render() {
        if (!currentLoader || !currentData) return;

        loaderTabs.innerHTML = Object.keys(currentData.loaders).sort().map(l =>
            `<button class="${l === currentLoader ? 'active' : ''}" data-loader="${escapeHtml(l)}">${escapeHtml(l.toUpperCase())}</button>`
        ).join('');

        loaderTabs.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentLoader = e.target.getAttribute('data-loader');
                render();
            });
        });

        filterContainer.classList.remove('d-none');

        let headHtml = `<tr><th class="corner-head">${escapeHtml(dict.col_version)}</th><th class="corner-head">${escapeHtml(dict.col_coverage)}</th>`;

        // Background class per mod column, by source
        const columnClasses = currentData.slugs.map(s => {
            const meta = currentData.modMeta && currentData.modMeta[s] ? currentData.modMeta[s] : { source: 'unknown' };
            if (meta.source === 'modrinth') return 'bg-modrinth';
            if (meta.source === 'curseforge') return 'bg-curseforge';
            if (meta.source === 'error') return 'bg-error';
            return '';
        });

        currentData.slugs.forEach((s, idx) => {
            const meta = currentData.modMeta && currentData.modMeta[s] ? currentData.modMeta[s] : { name: s, source: 'unknown' };

            const titleText = meta.source === 'error' ? `${meta.name} (${dict.err_source})` : `${meta.name} (${s})`;
            headHtml += `<th class="${columnClasses[idx]}"><div class="th-clip"><span class="th-inner" title="${escapeHtml(titleText)}">${escapeHtml(meta.name)}</span></div></th>`;
        });
        headHtml += '</tr>';
        compatHead.innerHTML = headHtml;

        const badges = {
            release: ['badge-r', 'Release', 'R'],
            beta: ['badge-b', 'Beta', 'B'],
            alpha: ['badge-a', 'Alpha', 'A']
        };

        let bodyHtml = '';
        let rowCount = 0;

        currentData.loaders[currentLoader].forEach((row) => {
            const perc = Math.round(row.f / currentData.slugs.length * 100);
            if (perc < currentMinCoverage) return;

            const cov = `${row.f}/${currentData.slugs.length} (${perc}%)`;
            bodyHtml += `<tr class="${rowCount === 0 ? 'highlight' : ''}"><td>${escapeHtml(row.v)}</td><td>${cov}</td>`;

            row.c.forEach((cell, idx) => {
                const bgClass = columnClasses[idx];
                const badge = badges[cell];
                if (badge) {
                    bodyHtml += `<td class="${bgClass}"><span class="badge ${badge[0]}" title="${badge[1]}">${badge[2]}</span></td>`;
                } else {
                    bodyHtml += `<td class="${bgClass} stat-none">-</td>`;
                }
            });

            bodyHtml += '</tr>';
            rowCount++;
        });

        compatBody.innerHTML = bodyHtml;
        compatTable.classList.remove('d-none');
    }
});
