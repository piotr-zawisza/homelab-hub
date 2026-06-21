document.addEventListener('DOMContentLoaded', () => {
    const dict = window.DICT || {};

    document.getElementById('btn-refresh-cache').addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-cache');
    const originalText = btn.innerHTML;
    btn.innerHTML = '...';
    btn.disabled = true;

    let isReloading = false;

    try {
        const res = await fetch('/api/refresh-cache', {
            method: 'POST'
        });

        if (res.ok) {
            isReloading = true;
            window.location.reload();
        } else if (res.status === 401) {
            alert(dict.unauthorized || 'Brak uprawnień. Zaloguj się w centralnym panelu.');
        } else if (res.status === 429) {
            alert(dict.refreshRateLimit || 'Zbyt wiele prób. Spróbuj ponownie później.');
        } else {
            alert(dict.refreshError || 'Wystąpił błąd podczas odświeżania.');
        }
    } catch (err) {
        alert(dict.refreshError || 'Błąd połączenia z serwerem.');
    } finally {
        if (!isReloading) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
});

    document.addEventListener('click', async function (e) {
        const button = e.target.closest('.server-ip');
        if (!button) return;

        const ip = button.getAttribute('data-ip');
        if (!ip) return;

        const textSpan = button.querySelector('.copy-text');
        const originalText = textSpan.innerText;
        let success = false;

        const fallbackCopy = (text) => {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.top = "-999px";
            textArea.style.left = "-999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                return document.execCommand('copy');
            } catch (err) {
                return false;
            } finally {
                document.body.removeChild(textArea);
            }
        };

        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(ip);
                success = true;
            } catch (err) {
                success = fallbackCopy(ip);
            }
        } else {
            success = fallbackCopy(ip);
        }

        if (success) {
            textSpan.innerText = dict.copied || 'Copied!';
            button.classList.add('copied');

            setTimeout(() => {
                textSpan.innerText = originalText;
                button.classList.remove('copied');
            }, 2000);
        } else {
            textSpan.innerText = dict.errorCopy || 'Error :(';
            setTimeout(() => { textSpan.innerText = originalText; }, 2000);
        }
    });
});
