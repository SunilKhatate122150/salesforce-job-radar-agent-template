// Keyboard Shortcuts Module

const SHORTCUTS = [
  { keys: '⌘/Ctrl + D', desc: 'Navigate to Dashboard Home' },
  { keys: '⌘/Ctrl + J', desc: 'Navigate to Job Radar Dashboard' },
  { keys: '⌘/Ctrl + S', desc: 'Navigate to Study Plan Schedule' },
  { keys: '⌘/Ctrl + P', desc: 'Navigate to Profile / Career Setup' },
  { keys: '⌘/Ctrl + K', desc: 'Focus sidebar search input' },
  { keys: '⌘/Ctrl + /', desc: 'Show shortcuts checklist help' },
  { keys: 'Escape', desc: 'Close any active modal or panel' }
];

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier) {
      const key = e.key.toLowerCase();
      
      switch (key) {
        case 'd':
          e.preventDefault();
          if (typeof window.showPage === 'function') window.showPage('dashboard_home');
          break;
        case 'j':
          e.preventDefault();
          if (typeof window.showPage === 'function') window.showPage('job_radar');
          break;
        case 's':
          e.preventDefault();
          if (typeof window.showPage === 'function') window.showPage('schedule');
          break;
        case 'p':
          e.preventDefault();
          if (typeof window.showPage === 'function') window.showPage('profile_match');
          break;
        case 'k':
          e.preventDefault();
          const searchInput = document.getElementById('searchInput');
          if (searchInput) searchInput.focus();
          break;
        case '/':
          e.preventDefault();
          toggleShortcutsModal();
          break;
      }
    } else if (e.key === 'Escape') {
      // Close active modals
      const activeModals = document.querySelectorAll('.modal-overlay, #syncModal, #shortcutsModal');
      activeModals.forEach(m => {
        m.style.display = 'none';
        m.classList.remove('active');
      });
      // Close side panels
      const activePanels = document.querySelectorAll('.activity-log-panel, #notifDropdownPanel');
      activePanels.forEach(p => {
        p.style.display = 'none';
        p.setAttribute('hidden', 'true');
      });
    }
  });

  injectShortcutsModal();
}

function injectShortcutsModal() {
  if (document.getElementById('shortcutsModal')) return;

  const modal = document.createElement('div');
  modal.id = 'shortcutsModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(10px);
    z-index: 12000;
    align-items: center;
    justify-content: center;
  `;

  modal.innerHTML = `
    <div style="background: var(--surface, #111827); border: 1px solid var(--border, rgba(255,255,255,0.08)); width: 90%; max-width: 440px; border-radius: 20px; padding: 2rem; position: relative; box-shadow: var(--shadow-lg);">
      <button onclick="document.getElementById('shortcutsModal').style.display='none'" style="position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--muted, #64748b); font-size: 1.5rem; cursor: pointer;">&times;</button>
      <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text, #f8fafc); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;">
        ⌨️ Keyboard Shortcuts
      </h3>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${SHORTCUTS.map(s => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));">
            <span style="font-size: 0.82rem; color: var(--text, #f8fafc);">${s.desc}</span>
            <kbd style="background: rgba(255,255,255,0.05); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 4px; padding: 3px 6px; font-size: 0.72rem; font-family: var(--font-mono, monospace); color: var(--blue, #3b82f6);">${s.keys}</kbd>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

export function toggleShortcutsModal() {
  const modal = document.getElementById('shortcutsModal');
  if (modal) {
    const isVisible = modal.style.display === 'flex';
    modal.style.display = isVisible ? 'none' : 'flex';
  }
}
