document.addEventListener('DOMContentLoaded', () => {
    const appContextEl = document.getElementById('app-context');
    const appContext = appContextEl ? JSON.parse(appContextEl.textContent) : {};

    const dict = (window.DICT && window.DICT.yt_sync) ? window.DICT.yt_sync : {};

    let isAuthenticated = appContext.isLoggedIn || false;

    // Logged out: the only interactive element is the button that opens the global login modal
    const btnLoginPrompt = document.getElementById('btn-login-prompt');
    if (btnLoginPrompt) {
        btnLoginPrompt.addEventListener('click', () => {
            const authToggle = document.getElementById('btn-global-auth-toggle');
            if (authToggle) authToggle.click();
        });
    }

    const toggleButtonLoading = (btn, isLoading, originalText) => {
        if (!btn) return;
        if (isLoading) {
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = '...';
            btn.disabled = true;
        } else {
            btn.innerHTML = originalText || btn.dataset.originalText;
            btn.disabled = false;
        }
    };

    // Resolves to true only when the API call succeeded
    const apiCall = async (endpoint, btn, originalBtnText, body = null) => {
        const payload = body ? { ...body } : {};
        toggleButtonLoading(btn, true);

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                window.showToast(data.message, 'success');
                return true;
            }

            window.showToast(data.error || dict.errServer, 'error');
            if (res.status === 401) {
                isAuthenticated = false;
                window.location.reload();
            }
            return false;
        } catch (err) {
            window.showToast(dict.errConn, 'error');
            return false;
        } finally {
            toggleButtonLoading(btn, false, originalBtnText);
        }
    };

    const tasksTable = document.getElementById('tasks-table');
    const tasksTbody = document.getElementById('tasks-tbody');
    const tasksEmpty = document.getElementById('tasks-empty');
    const tasksLoading = document.getElementById('tasks-loading');

    const fetchTasks = async () => {
        if (!isAuthenticated || !tasksTbody) return;

        try {
            const res = await fetch('/api/yt/tasks');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            tasksLoading.classList.add('d-none');

            if (data.tasks && data.tasks.length > 0) {
                tasksTbody.innerHTML = '';
                data.tasks.forEach(task => {
                    const tr = document.createElement('tr');

                    let displayTitle = task.title;
                    if (!displayTitle || displayTitle === 'Unknown Playlist') {
                        displayTitle = task.url.replace(/^https?:\/\/(www\.)?youtube\.com\//, '');
                    }

                    // Worker data is untrusted: build with DOM nodes (textContent), never innerHTML
                    const urlTd = document.createElement('td');
                    urlTd.className = 'is-truncate';
                    urlTd.title = task.url;

                    const link = document.createElement('a');
                    link.className = 'yt-task-link';
                    link.textContent = displayTitle;
                    if (/^https?:\/\//i.test(task.url)) {
                        link.href = task.url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    }
                    urlTd.appendChild(link);

                    if (task.target_dir) {
                        const folderBadge = document.createElement('span');
                        folderBadge.className = 'badge yt-folder-badge';
                        folderBadge.textContent = `👤 ${task.target_dir}`;
                        urlTd.appendChild(folderBadge);
                    }

                    const intervalTd = document.createElement('td');
                    intervalTd.className = 'is-center';
                    intervalTd.textContent = `${task.interval_hours}h`;

                    const actionTd = document.createElement('td');
                    actionTd.className = 'is-end';
                    const delBtn = document.createElement('button');
                    delBtn.className = 'btn btn-danger btn-sm btn-delete-task';
                    delBtn.dataset.id = task.id;
                    delBtn.textContent = dict.btnDelete;
                    actionTd.appendChild(delBtn);

                    tr.append(urlTd, intervalTd, actionTd);
                    tasksTbody.appendChild(tr);
                });

                tasksEmpty.classList.add('d-none');
                tasksTable.classList.remove('d-none');
            } else {
                tasksTable.classList.add('d-none');
                tasksEmpty.classList.remove('d-none');
            }
        } catch (err) {
            tasksLoading.textContent = dict.tasksLoadErr;
            tasksLoading.classList.add('is-error');
            tasksLoading.classList.remove('d-none');
        }
    };

    // One delegated handler for all delete buttons (rows are rebuilt on every fetch)
    if (tasksTbody) {
        tasksTbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-delete-task');
            if (!btn) return;

            const originalText = btn.innerHTML;
            toggleButtonLoading(btn, true);

            try {
                const delRes = await fetch(`/api/yt/tasks/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
                if (delRes.ok) {
                    window.showToast(dict.taskRemoved, 'success');
                    fetchTasks();
                } else {
                    window.showToast(dict.taskRemoveErr, 'error');
                    toggleButtonLoading(btn, false, originalText);
                }
            } catch (err) {
                window.showToast(dict.errConn, 'error');
                toggleButtonLoading(btn, false, originalText);
            }
        });
    }

    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) {
        btnDownload.addEventListener('click', async () => {
            const urlEl = document.getElementById('dl-url');
            const url = urlEl ? urlEl.value.trim() : '';
            if (!url) return window.showToast(dict.errLink, 'error');
            await apiCall('/api/yt/download', btnDownload, dict.dlBtn, { url });
        });
    }

    const btnSync = document.getElementById('btn-sync');
    if (btnSync) {
        btnSync.addEventListener('click', async () => {
            const urlEl = document.getElementById('sync-url');
            const url = urlEl ? urlEl.value.trim() : '';

            const intervalEl = document.getElementById('sync-interval');
            const interval = intervalEl ? intervalEl.value : '12';

            const targetEl = document.getElementById('sync-target');
            const target_dir = targetEl && targetEl.value.trim() !== '' ? targetEl.value.trim() : null;

            if (!url) return window.showToast(dict.errLink, 'error');

            const ok = await apiCall('/api/yt/sync', btnSync, dict.syncBtn, { url, interval_hours: interval, target_dir });

            // Keep what the user typed when the call failed
            if (ok) {
                urlEl.value = '';
                if (targetEl) targetEl.value = '';
                fetchTasks();
            }
        });
    }

    const btnForce = document.getElementById('btn-force');
    if (btnForce) {
        btnForce.addEventListener('click', () => {
            apiCall('/api/yt/sync/force', btnForce, dict.forceBtn);
        });
    }

    fetchTasks();

    const logOutput = document.getElementById('log-output');
    const btnClearLogs = document.getElementById('btn-clear-logs');
    let knownLogsCount = 0;
    let pollTimer = null;
    let isFetching = false;

    const addSystemLine = (text) => {
        const line = document.createElement('span');
        line.className = 'log-line system';
        line.textContent = text;
        logOutput.replaceChildren(line);
    };

    const fetchLogs = async () => {
        if (!isAuthenticated || !logOutput) return;
        if (isFetching || document.hidden) return;

        isFetching = true;

        try {
            const res = await fetch('/api/yt/logs');
            if (!res.ok) throw new Error('HTTP Error');
            const data = await res.json();

            if (data.logs && data.logs.length > 0) {
                if (logOutput.querySelector('.system')) {
                    logOutput.innerHTML = '';
                }

                if (data.logs.length < knownLogsCount) {
                    knownLogsCount = 0;
                }

                const newLogs = data.logs.slice(knownLogsCount);
                newLogs.forEach(logText => {
                    const line = document.createElement('span');
                    line.className = 'log-line';

                    if (logText.includes('[ERROR]')) line.classList.add('error');
                    else if (logText.includes('[WARNING]')) line.classList.add('warning');
                    else if (logText.includes('[SYNC]')) line.classList.add('info');

                    line.textContent = logText;
                    logOutput.appendChild(line);
                });

                if (newLogs.length > 0) {
                    knownLogsCount = data.logs.length;
                    logOutput.scrollTop = logOutput.scrollHeight;
                }
            }
        } catch (err) {
            console.warn('[YT-Sync] Log polling error - ignored');
        } finally {
            isFetching = false;
            pollTimer = setTimeout(fetchLogs, 4000);
        }
    };

    fetchLogs();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearTimeout(pollTimer);
        } else {
            fetchLogs();
        }
    });

    if (btnClearLogs) {
        btnClearLogs.addEventListener('click', () => addSystemLine(dict.logsCleared));
    }
});
