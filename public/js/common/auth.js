document.addEventListener('DOMContentLoaded', () => {
    const dict = window.DICT || {};
    const tAuth = dict.auth || {};

    const btnToggle = document.getElementById('btn-global-auth-toggle');
    const overlay = document.getElementById('auth-modal-overlay');
    const btnClose = document.getElementById('auth-modal-close');

    const btnLoginSubmit = document.getElementById('btn-global-login-submit');
    const btnLogoutSubmit = document.getElementById('btn-global-logout-submit');
    const pwdInput = document.getElementById('global-admin-pwd');

    if (btnToggle && overlay && btnClose) {
        btnToggle.addEventListener('click', () => {
            overlay.classList.add('active');
            if (pwdInput) pwdInput.focus();
        });

        const closeModal = () => overlay.classList.remove('active');

        btnClose.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) closeModal();
        });
    }

    if (btnLoginSubmit && pwdInput) {
        const attemptLogin = async () => {
            const pwd = pwdInput.value;
            if (!pwd) return alert(tAuth.err_empty || 'Enter password!');

            btnLoginSubmit.innerText = '...';
            btnLoginSubmit.disabled = true;

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: pwd })
                });

                if (res.ok) {
                    window.location.reload();
                } else {
                    const data = await res.json();
                    alert(tAuth.err_invalid || data.error || 'Signing in error');
                }
            } catch (err) {
                alert(tAuth.err_conn || 'Connection error.');
            } finally {
                btnLoginSubmit.innerText = tAuth.btn_login || 'Sign in';
                btnLoginSubmit.disabled = false;
            }
        };

        btnLoginSubmit.addEventListener('click', attemptLogin);
        pwdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') attemptLogin();
        });
    }

    if (btnLogoutSubmit) {
        btnLogoutSubmit.addEventListener('click', async () => {
            btnLogoutSubmit.innerText = '...';
            btnLogoutSubmit.disabled = true;
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.reload();
            } catch (err) {
                console.error('Logout error', err);
                btnLogoutSubmit.disabled = false;
            }
        });
    }
});
