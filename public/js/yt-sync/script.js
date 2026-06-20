document.addEventListener('DOMContentLoaded', () => {
    const dict = (window.DICT && window.DICT.yt_sync) ? window.DICT.yt_sync : {};

    const authSection = document.getElementById('auth-section');

    if (localStorage.getItem('hub_logged_in') === 'true') {
        authSection.style.display = 'none';
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
                    pwdEl.value = '';
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
});
