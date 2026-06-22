document.addEventListener('DOMContentLoaded', () => {
    const appContextEl = document.getElementById('app-context');
    const appContext = appContextEl ? JSON.parse(appContextEl.textContent) : {};

    const dict = (window.DICT && window.DICT.yt_sync) ? window.DICT.yt_sync : {};

    let isAuthenticated = appContext.isLoggedIn || false;
    const terminalPanel = document.getElementById('terminal-panel');

    if (isAuthenticated) {
        if (terminalPanel) terminalPanel.style.display = 'block';
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
                window.showToast(data.message, "success");
            } else {
                window.showToast(data.error || dict.errServer || "Server error", "error");
                if (res.status === 401) {
                    isAuthenticated = false;
                    if (terminalPanel) terminalPanel.style.display = 'none';

                    window.location.reload();
                }
            }
        } catch (err) {
            window.showToast(dict.errConn || "Connection error.", "error");
        } finally {
            toggleButtonLoading(btn, false, originalBtnText);
        }
    };

    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            const urlEl = document.getElementById('dl-url');
            const url = urlEl ? urlEl.value : '';
            if (!url) return window.showToast(dict.errLink || "Enter link!", "error");
            apiCall('/api/yt/download', btnDownload, dict.dlBtn || 'Download', { url });
        });
    }

    const btnSync = document.getElementById('btn-sync');
    if (btnSync) {
        btnSync.addEventListener('click', async () => {
            const urlEl = document.getElementById('sync-url');
            const url = urlEl ? urlEl.value : '';

            const intervalEl = document.getElementById('sync-interval');
            const interval = intervalEl ? intervalEl.value : '12';

            const targetEl = document.getElementById('sync-target');
            const target_dir = targetEl && targetEl.value.trim() !== '' ? targetEl.value.trim() : null;

            if (!url) return window.showToast(dict.errLink || "Enter link!", "error");

            await apiCall('/api/yt/sync', btnSync, dict.syncBtn || 'Add schedule', { url, interval_hours: interval, target_dir: target_dir });

            fetchTasks();
            urlEl.value = '';
            if (targetEl) targetEl.value = '';
        });
    }

    const btnForce = document.getElementById('btn-force');
    if (btnForce) {
        btnForce.addEventListener('click', () => {
            apiCall('/api/yt/sync/force', btnForce, dict.forceBtn || 'Sync');
        });
    }

    const tasksTable = document.getElementById('tasks-table');
    const tasksTbody = document.getElementById('tasks-tbody');
    const tasksEmpty = document.getElementById('tasks-empty');
    const tasksLoading = document.getElementById('tasks-loading');

    const fetchTasks = async () => {
        if (!isAuthenticated) return;

        try {
            const res = await fetch('/api/yt/tasks');
            if (!res.ok) throw new Error("Wystąpił błąd podczas pobierania zadań");

            const data = await res.json();

            tasksLoading.style.display = 'none';

            if (data.tasks && data.tasks.length > 0) {
                tasksTbody.innerHTML = '';
                data.tasks.forEach(task => {
                    const tr = document.createElement('tr');
                    tr.className = 'yt-task-row';

                    let displayTitle = task.title;
                    if (!displayTitle || displayTitle === "Unknown Playlist") {
                        displayTitle = task.url.replace(/^https?:\/\/(www\.)?youtube\.com\//, '');
                    }

                    const folderBadge = task.target_dir
                        ? `<span style="font-size: 10px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; margin-left: 8px; color: #a0a0b0;">👤 ${task.target_dir}</span>`
                        : '';

                    tr.innerHTML = `
                        <td class="yt-task-url" title="${task.url}">
                            <a href="${task.url}" target="_blank" class="yt-task-link">${displayTitle}</a>
                            ${folderBadge}
                        </td>
                        <td class="yt-task-interval">${task.interval_hours}h</td>
                        <td class="yt-task-action">
                            <button class="btn btn-secondary btn-delete-task" data-id="${task.id}">
                                ${dict.btnDelete || "Usuń"}
                            </button>
                        </td>
                    `;
                    tasksTbody.appendChild(tr);
                });

                tasksEmpty.style.display = 'none';
                tasksTable.style.display = 'table';

                document.querySelectorAll('.btn-delete-task').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const taskId = e.target.getAttribute('data-id');
                        const originalText = e.target.innerText;
                        toggleButtonLoading(e.target, true);

                        try {
                            const delRes = await fetch(`/api/yt/tasks/${taskId}`, { method: 'DELETE' });
                            if (delRes.ok) {
                                window.showToast("Task removed", "success");
                                fetchTasks();
                            } else {
                                window.showToast("Removal error", "error");
                                toggleButtonLoading(e.target, false, originalText);
                            }
                        } catch (err) {
                            window.showToast("Connection error", "error");
                            toggleButtonLoading(e.target, false, originalText);
                        }
                    });
                });

            } else {
                tasksTable.style.display = 'none';
                tasksEmpty.style.display = 'block';
            }

        } catch (err) {
            tasksLoading.innerText = "Error while loading tasks from Worker.";
            tasksLoading.style.color = "#ff5252";
        }
    };
    fetchTasks();

    const logOutput = document.getElementById('log-output');
    const btnClearLogs = document.getElementById('btn-clear-logs');
    let knownLogsCount = 0;
    let pollTimer = null;
    let isFetching = false;

    const fetchLogs = async () => {
        if (!isAuthenticated) return;
        if (isFetching || document.hidden) return;

        isFetching = true;

        try {
            const res = await fetch('/api/yt/logs');
            if (!res.ok) throw new Error("HTTP Error");
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
                    else line.style.color = '#e0e0e0';

                    line.textContent = logText;
                    logOutput.appendChild(line);
                });

                if (newLogs.length > 0) {
                    knownLogsCount = data.logs.length;
                    logOutput.scrollTop = logOutput.scrollHeight;
                }
            }
        } catch (err) {
            console.warn("Polling error - ignore")
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
        btnClearLogs.addEventListener('click', () => {
            logOutput.innerHTML = '<span class="log-line system">Logs visually cleared...</span>';
        });
    }
});
