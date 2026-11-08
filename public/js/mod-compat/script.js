document.addEventListener('DOMContentLoaded', () => {
    const dict = (window.DICT && window.DICT.mod_compat) ? window.DICT.mod_compat : {};

    const btnSubmit = document.getElementById('btn-submit');
    const inputArea = document.getElementById('mods-input');
    const inputCollapseArea = document.getElementById('input-collapse-area');
    const btnToggleInput = document.getElementById('btn-toggle-input');

    const resultsContainer = document.getElementById('results-container');
    const loaderTabs = document.getElementById('loader-tabs');
    const matrixScroll = document.getElementById('matrix-scroll');
    const compatTable = document.getElementById('compat-table');
    const compatCols = document.getElementById('compat-cols');
    const compatHead = document.getElementById('compat-head');
    const compatBody = document.getElementById('compat-body');

    const failedSection = document.getElementById('failed-section');
    const failedList = document.getElementById('failed-list');
    const summarySection = document.getElementById('summary-section');
    const summaryList = document.getElementById('summary-list');
    const noRows = document.getElementById('no-rows');

    const filterContainer = document.getElementById('filter-container');
    const minCoverageInput = document.getElementById('min-coverage');
    const minCoverageVal = document.getElementById('min-coverage-val');

    const SUMMARY_ROWS = 3;
    const SUMMARY_MAX_MISSING = 8;
    const HEAD_MIN_PX = 60;
    const HEAD_MAX_PX = 220;

    let currentData = null;
    let currentLoader = null;
    let currentMinCoverage = 0;

    // API data (mod names, slugs, versions) is untrusted - escape before it goes into innerHTML
    const escapeHtml = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const setInputCollapsed = (collapsed) => {
        inputCollapseArea.classList.toggle('d-none', collapsed);
        btnToggleInput.textContent = collapsed ? dict.btn_edit : dict.btn_hide;
        btnToggleInput.classList.toggle('btn-secondary', collapsed);
        btnToggleInput.classList.toggle('btn-primary', !collapsed);
    };

    minCoverageInput.addEventListener('input', (e) => {
        currentMinCoverage = parseInt(e.target.value, 10);
        minCoverageVal.textContent = `${currentMinCoverage}%`;
        render();
    });

    btnToggleInput.addEventListener('click', () => {
        setInputCollapsed(!inputCollapseArea.classList.contains('d-none'));
    });

    // One delegated handler; the buttons are rebuilt on every render
    loaderTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-loader]');
        if (!btn || btn.dataset.loader === currentLoader) return;
        currentLoader = btn.dataset.loader;
        render();
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

        if (!slugs.length) return window.showToast(dict.err_empty, 'error');

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
                window.showToast(dict.err_none, 'warning');
                return;
            }

            currentLoader = Object.keys(currentData.loaders).sort()[0];
            resultsContainer.classList.remove('d-none');
            btnToggleInput.classList.remove('d-none');
            setInputCollapsed(true);
            render();
        } catch (err) {
            console.error('[ModCompat] Request or render error:', err);
            window.showToast(dict.err_fetch, 'error');
        } finally {
            btnSubmit.innerHTML = originalText;
            btnSubmit.disabled = false;
        }
    });

    const getMeta = (slug) => {
        const meta = currentData.modMeta && currentData.modMeta[slug];
        return meta || { name: slug, source: 'unknown' };
    };

    // Failed mods are listed above the matrix instead of hiding in a tooltip
    const renderFailed = () => {
        const failed = currentData.slugs.filter(s => getMeta(s).source === 'error');
        failedSection.classList.toggle('d-none', failed.length === 0);
        failedList.replaceChildren(...failed.map(s => {
            const tag = document.createElement('span');
            tag.className = 'badge badge-danger';
            tag.textContent = getMeta(s).name;
            tag.title = dict.err_source;
            return tag;
        }));
    };

    // Best versions of the current loader (rows come sorted best-first), with the missing mods named
    const renderSummary = () => {
        const rows = currentData.loaders[currentLoader].slice(0, SUMMARY_ROWS);
        summarySection.classList.toggle('d-none', rows.length === 0);

        summaryList.replaceChildren(...rows.map(row => {
            const li = document.createElement('li');

            const version = document.createElement('span');
            version.className = 'mc-summary-version';
            version.textContent = row.v;

            const cov = document.createElement('span');
            cov.className = 'mc-summary-cov';
            cov.textContent = `${row.f}/${currentData.slugs.length}`;

            const missingEl = document.createElement('span');
            const missing = currentData.slugs.filter((s, idx) => !row.c[idx] && getMeta(s).source !== 'error');
            if (!missing.length) {
                missingEl.className = 'mc-summary-all';
                missingEl.textContent = dict.summary_all;
            } else {
                missingEl.className = 'mc-missing';
                missingEl.append(`${dict.summary_missing} `);
                missing.slice(0, SUMMARY_MAX_MISSING).forEach(s => {
                    const tag = document.createElement('span');
                    tag.className = 'badge badge-warning';
                    tag.textContent = getMeta(s).name;
                    missingEl.appendChild(tag);
                });
                if (missing.length > SUMMARY_MAX_MISSING) {
                    missingEl.append(`+${missing.length - SUMMARY_MAX_MISSING}`);
                }
            }

            li.append(version, cov, missingEl);
            return li;
        }));
    };

    function render() {
        if (!currentLoader || !currentData) return;

        loaderTabs.replaceChildren(...Object.keys(currentData.loaders).sort().map(l => {
            const btn = document.createElement('button');
            btn.className = `tab${l === currentLoader ? ' active' : ''}`;
            btn.dataset.loader = l;
            btn.textContent = l.toUpperCase();
            return btn;
        }));

        filterContainer.classList.remove('d-none');
        renderFailed();
        renderSummary();

        const srcClasses = currentData.slugs.map(s => {
            const source = getMeta(s).source;
            return source === 'modrinth' || source === 'curseforge' || source === 'error' ? `src-${source}` : '';
        });

        // Header height follows the longest mod name (vertical text), within sane limits
        const longest = currentData.slugs.reduce((max, s) => Math.max(max, String(getMeta(s).name).length), 0);
        const headPx = Math.min(HEAD_MAX_PX, Math.max(HEAD_MIN_PX, longest * 7 + 36));
        matrixScroll.style.setProperty('--mc-head-h', `${headPx}px`);

        compatCols.innerHTML = '<col class="mc-cw1"><col class="mc-cw2">' +
            srcClasses.map(c => `<col class="mc-col ${c}">`).join('');

        let headHtml = `<tr><th class="mc-c1">${escapeHtml(dict.col_version)}</th><th class="mc-c2">${escapeHtml(dict.col_coverage)}</th>`;
        currentData.slugs.forEach((s, idx) => {
            const meta = getMeta(s);
            const titleText = meta.source === 'error' ? `${meta.name} (${dict.err_source})` : `${meta.name} (${s})`;
            const cls = ['mc-mod', srcClasses[idx], meta.dep ? 'is-dep' : ''].filter(Boolean).join(' ');
            const tag = meta.dep ? `<span class="th-tag">${escapeHtml(dict.dep_tag)}</span>` : '';
            headHtml += `<th class="${cls}" title="${escapeHtml(titleText)}"><span class="th-name">${escapeHtml(meta.name)}</span>${tag}</th>`;
        });
        compatHead.innerHTML = `${headHtml}</tr>`;

        const badges = {
            release: ['badge-success', dict.legend_release, 'R'],
            beta: ['badge-warning', dict.legend_beta, 'B'],
            alpha: ['badge-danger', dict.legend_alpha, 'A']
        };

        const rows = currentData.loaders[currentLoader];
        const bestCount = rows.length ? rows[0].f : 0;
        let bodyHtml = '';
        let rowCount = 0;

        rows.forEach((row) => {
            const perc = Math.round(row.f / currentData.slugs.length * 100);
            if (perc < currentMinCoverage) return;

            const cov = `${row.f}/${currentData.slugs.length} (${perc}%)`;
            bodyHtml += `<tr class="${row.f === bestCount ? 'is-best' : ''}"><td class="mc-c1">${escapeHtml(row.v)}</td><td class="mc-c2">${cov}</td>`;

            row.c.forEach((cell) => {
                const badge = badges[cell];
                if (badge) {
                    bodyHtml += `<td><span class="badge badge--square ${badge[0]}" title="${escapeHtml(badge[1])}">${badge[2]}</span></td>`;
                } else {
                    bodyHtml += '<td class="mc-empty">-</td>';
                }
            });

            bodyHtml += '</tr>';
            rowCount++;
        });

        compatBody.innerHTML = bodyHtml;
        compatTable.classList.remove('d-none');
        noRows.classList.toggle('d-none', rowCount > 0);
        matrixScroll.classList.toggle('d-none', rowCount === 0);
    }

    // Column crosshair: highlight the hovered column through its <col> (the row hover is pure CSS)
    let hoverCol = null;
    const setHoverCol = (idx) => {
        const next = idx >= 2 ? compatCols.children[idx] : null;
        if (next === hoverCol) return;
        if (hoverCol) hoverCol.classList.remove('is-hover');
        hoverCol = next;
        if (hoverCol) hoverCol.classList.add('is-hover');
    };

    compatTable.addEventListener('mouseover', (e) => {
        const cell = e.target.closest('td, th');
        setHoverCol(cell ? cell.cellIndex : -1);
    });
    compatTable.addEventListener('mouseleave', () => setHoverCol(-1));
});
