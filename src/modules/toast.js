// Toast Notifications Module (Vite)
export function showToast(msg, typeHint) {
  const container = document.getElementById('toastContainer') || (() => {
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();

  const text = String(msg || '');
  let type = /fail|failed|error|required|empty|paste|fill|invalid|cannot|unavailable|try again|sign in/i.test(text) ? 'error' : 'success';
  if (typeHint === true || typeHint === 'red' || typeHint === 'error') type = 'error';
  else if (typeHint === 'warning' || typeHint === 'amber') type = 'warning';
  else if (typeHint === 'blue' || typeHint === 'info') type = 'info';
  else if (typeHint === 'green' || typeHint === 'success') type = 'success';

  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
  };

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  
  // Custom escapeHtml function for toast msg safety
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${escapedText}</span>
    <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Dismiss">&times;</button>
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-show'));

  const duration = type === 'error' ? 6000 : type === 'warning' ? 5000 : 3500;
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 400);
  }, duration);

  const items = container.querySelectorAll('.toast-item');
  if (items.length > 4) items[0].remove();

  const legacyToast = document.getElementById('toast');
  if (legacyToast) {
    legacyToast.classList.remove('show');
    legacyToast.textContent = '';
  }
}

// Bind to window for global access
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
