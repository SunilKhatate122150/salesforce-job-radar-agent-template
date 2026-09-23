// macOS 27 Golden Gate Desktop Environment Controller
export function initMacosDesktop() {
  if (typeof window === 'undefined') return;

  setupLiveClock();
  setupDropdownMenus();
  setupControlCenter();
  setupTrafficLights();
  setupDock();
  setupTimerSync();
}

function setupLiveClock() {
  const clockEl = document.getElementById('macosClock');
  if (!clockEl) return;

  function updateTime() {
    const now = new Date();
    const formatted = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    clockEl.textContent = formatted;
  }

  updateTime();
  setInterval(updateTime, 10000);
}

function setupDropdownMenus() {
  const menuButtons = document.querySelectorAll('.menu-bar-item[data-menu]');
  const allDropdowns = document.querySelectorAll('.macos-dropdown-menu');

  menuButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menuId = btn.getAttribute('data-menu');
      const targetDropdown = document.getElementById(menuId);
      const isAlreadyOpen = targetDropdown?.classList.contains('show');

      allDropdowns.forEach(d => d.classList.remove('show'));
      menuButtons.forEach(b => b.classList.remove('is-active'));

      if (!isAlreadyOpen && targetDropdown) {
        targetDropdown.classList.add('show');
        btn.classList.add('is-active');
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.macos-menu-bar')) {
      allDropdowns.forEach(d => d.classList.remove('show'));
      menuButtons.forEach(b => b.classList.remove('is-active'));
    }
  });
}

function setupControlCenter() {
  const ccBtn = document.getElementById('macosCcToggle');
  const ccPanel = document.getElementById('macosControlCenter');
  const glassSlider = document.getElementById('glassIntensitySlider');
  const glassVal = document.getElementById('glassIntensityVal');
  const focusToggle = document.getElementById('focusModeToggle');
  const accentDots = document.querySelectorAll('.accent-dot');

  if (!ccBtn || !ccPanel) return;

  ccBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ccPanel.classList.toggle('show');
    ccBtn.classList.toggle('is-active', ccPanel.classList.contains('show'));
  });

  document.addEventListener('click', (e) => {
    if (!ccPanel.contains(e.target) && e.target !== ccBtn && !ccBtn.contains(e.target)) {
      ccPanel.classList.remove('show');
      ccBtn.classList.remove('is-active');
    }
  });

  // Liquid Glass Slider
  const savedIntensity = localStorage.getItem('sfjr_glass_intensity') || '75';
  if (glassSlider) {
    glassSlider.value = savedIntensity;
    applyGlassIntensity(savedIntensity);

    glassSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      applyGlassIntensity(val);
      localStorage.setItem('sfjr_glass_intensity', val);
    });
  }

  function applyGlassIntensity(val) {
    const num = parseInt(val, 10);
    // Scale blur: 12px to 38px
    const blur = Math.round(12 + (num / 100) * 26);
    // Scale opacity: 0.50 to 0.88
    const opacity = (0.50 + (num / 100) * 0.35).toFixed(2);

    document.documentElement.style.setProperty('--glass-blur', `${blur}px`);
    document.documentElement.style.setProperty('--glass-opacity', opacity);
    if (glassVal) glassVal.textContent = `${val}%`;
  }

  // Accent Color Picker
  accentDots.forEach(dot => {
    dot.addEventListener('click', () => {
      accentDots.forEach(d => d.classList.remove('is-active'));
      dot.classList.add('is-active');
      const color = dot.getAttribute('data-accent-color');
      if (color) {
        document.documentElement.style.setProperty('--color-primary', color);
        document.documentElement.style.setProperty('--blue', color);
        localStorage.setItem('sfjr_accent_color', color);
      }
    });
  });

  const savedAccent = localStorage.getItem('sfjr_accent_color');
  if (savedAccent) {
    document.documentElement.style.setProperty('--color-primary', savedAccent);
    document.documentElement.style.setProperty('--blue', savedAccent);
    accentDots.forEach(dot => {
      dot.classList.toggle('is-active', dot.getAttribute('data-accent-color') === savedAccent);
    });
  }

  // Focus Mode Toggle
  if (focusToggle) {
    focusToggle.addEventListener('change', (e) => {
      document.body.classList.toggle('study-focus-mode', e.target.checked);
    });
  }
}

function setupTrafficLights() {
  const closeBtn = document.getElementById('trafficLightClose');
  const minBtn = document.getElementById('trafficLightMin');
  const zoomBtn = document.getElementById('trafficLightZoom');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (confirm('Sign out of SF Radar Golden Gate workstation?')) {
        window.signOut?.();
      }
    });
  }

  if (minBtn) {
    minBtn.addEventListener('click', () => {
      window.toggleSidebar?.();
    });
  }

  if (zoomBtn) {
    zoomBtn.addEventListener('click', () => {
      const isFull = document.fullscreenElement || document.webkitFullscreenElement;
      if (!isFull) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    });
  }
}

function setupDock() {
  const dockItems = document.querySelectorAll('.dock-item[data-page]');

  dockItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.getAttribute('data-page');
      if (pageId) {
        if (typeof window.showPage === 'function') {
          window.showPage(pageId);
        } else {
          window.location.hash = pageId;
        }
        updateActiveDockItem(pageId);
      }
    });
  });

  // Settings item in dock opens control center
  const dockSettings = document.getElementById('dockItemSettings');
  if (dockSettings) {
    dockSettings.addEventListener('click', () => {
      const ccBtn = document.getElementById('macosCcToggle');
      ccBtn?.click();
    });
  }

  // Sync dock item on hashchange
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) updateActiveDockItem(hash);
  });

  // Initial sync from hash
  const initialHash = window.location.hash.replace(/^#/, '');
  if (initialHash) updateActiveDockItem(initialHash);

  // Hook window.showPage to keep dock active indicator in sync
  hookShowPage();
  setTimeout(hookShowPage, 500);
}

function hookShowPage() {
  if (typeof window.showPage === 'function' && !window.showPage.__macosDockHooked) {
    const originalShowPage = window.showPage;
    window.showPage = function(pageId, ...args) {
      const res = originalShowPage.apply(this, [pageId, ...args]);
      updateActiveDockItem(pageId);
      return res;
    };
    window.showPage.__macosDockHooked = true;
  }
}

function updateActiveDockItem(pageId) {
  const dockItems = document.querySelectorAll('.dock-item[data-page]');
  dockItems.forEach(item => {
    item.classList.toggle('is-active', item.getAttribute('data-page') === pageId);
  });
}

window.updateActiveDockItem = updateActiveDockItem;

function setupTimerSync() {
  const menuTimer = document.getElementById('menuBarTimer');
  const ftTime = document.getElementById('ftTime');
  const menuStreak = document.getElementById('menuBarStreak');
  const floatStreak = document.getElementById('floatStreakVal');
  const dashStreak = document.getElementById('dashStreakVal');

  if (menuTimer && ftTime) {
    const observer = new MutationObserver(() => {
      menuTimer.textContent = ftTime.textContent || '00:00';
    });
    observer.observe(ftTime, { childList: true, characterData: true, subtree: true });
    menuTimer.textContent = ftTime.textContent || '00:00';
  }

  function syncStreak() {
    if (!menuStreak) return;
    const val = floatStreak?.textContent?.trim() || dashStreak?.textContent?.trim() || localStorage.getItem('sfjr_streak') || '0';
    if (val) menuStreak.textContent = val;
  }

  syncStreak();
  if (floatStreak) {
    new MutationObserver(syncStreak).observe(floatStreak, { childList: true, characterData: true, subtree: true });
  }
  if (dashStreak) {
    new MutationObserver(syncStreak).observe(dashStreak, { childList: true, characterData: true, subtree: true });
  }
}

// Auto-run if DOM already loaded or on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMacosDesktop);
  } else {
    initMacosDesktop();
  }
}
