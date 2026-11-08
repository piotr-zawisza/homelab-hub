// Loaded synchronously from <head> so the theme is set before first paint.
(function () {
    const KEY = 'hub-theme';
    const root = document.documentElement;

    function read() {
        try {
            return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
        } catch (e) {
            return 'dark';
        }
    }

    function apply(theme) {
        root.setAttribute('data-theme', theme);
    }

    apply(read());

    document.addEventListener('DOMContentLoaded', function () {
        const btn = document.getElementById('btn-theme-toggle');
        if (!btn) return;
        btn.setAttribute('aria-pressed', String(read() === 'light'));
        btn.addEventListener('click', function () {
            const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            apply(next);
            btn.setAttribute('aria-pressed', String(next === 'light'));
            try {
                localStorage.setItem(KEY, next);
            } catch (e) {
                console.warn('[Theme] Could not persist theme:', e);
            }
        });
    });
})();
