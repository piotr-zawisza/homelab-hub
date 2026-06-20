document.addEventListener('DOMContentLoaded', () => {
    const contextData = window.DICT || {};
    const dict = (window.DICT && window.DICT.yt_sync) ? window.DICT.yt_sync : {};
    const isLoggedIn = contextData.isLoggedIn || false;

    const authSection = document.getElementById('auth-section');
    const terminalPanel = document.getElementById('terminal-panel');

    if (isLoggedIn) {
        authSection.style.display = 'none';
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

    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const pwdEl = document.getElementById('admin-pwd');
            if (!pwdEl.value) return window.showToast(dict.errPwd || "Enter password!", "error");

            toggleButtonLoading(btnLogin, true);

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: pwdEl.value })
                });
                const data = await res.json();

                if (res.ok) {
                    window.showToast(data.message, "success");
                    localStorage.setItem('hub_logged_in', 'true');
                    authSection.style.display = 'none';
                    if (terminalPanel) terminalPanel.style.display = 'block';
                    pwdEl.value = '';
                    fetchLogs();
                } else {
                    window.showToast(data.error, "error");
                }
            } catch (err) {
                window.showToast(dict.errLogin || "Login error.", "error");
            } finally {
                toggleButtonLoading(btnLogin, false, dict.loginBtn || "Login");
            }
        });
    }

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
                    localStorage.removeItem('hub_logged_in');
                    authSection.style.display = 'block';
                    if (terminalPanel) terminalPanel.style.display = 'none';
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
        btnSync.addEventListener('click', () => {
            const urlEl = document.getElementById('sync-url');
            const url = urlEl ? urlEl.value : '';
            const intervalEl = document.getElementById('sync-interval');
            const interval = intervalEl ? intervalEl.value : '12';

            if (!url) return window.showToast(dict.errLink || "Enter link!", "error");
            apiCall('/api/yt/sync', btnSync, dict.syncBtn || 'Add schedule', { url, interval_hours: interval });
        });
    }

    const btnForce = document.getElementById('btn-force');
    if (btnForce) {
        btnForce.addEventListener('click', () => {
            apiCall('/api/yt/sync/force', btnForce, dict.forceBtn || 'Sync');
        });
    }

    const logOutput = document.getElementById('log-output');
    const btnClearLogs = document.getElementById('btn-clear-logs');
    let knownLogsCount = 0;
    let pollTimer = null;
    let isFetching = false;

    const fetchLogs = async () => {
        if (localStorage.getItem('hub_logged_in') !== 'true') return;

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
