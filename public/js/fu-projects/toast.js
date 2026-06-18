export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message; 

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fadeOut');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}