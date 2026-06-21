// Theme System Module (Vite)
export function toggleTheme() {
  const root = document.documentElement;
  const currentTheme = root.getAttribute('data-theme') || 'dark';
  const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
  setSfjrTheme(nextTheme);
}

export function setSfjrTheme(nextTheme) {
  const btn = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const preferenceKey = 'sfjr_theme_v2';
  
  const normalize = function(value) {
    return value === 'light' ? 'light' : 'dark';
  };
  
  const theme = normalize(nextTheme);
  root.setAttribute('data-theme', theme);
  root.classList.toggle('theme-light', theme === 'light');
  root.classList.toggle('theme-dark', theme === 'dark');
  document.body?.classList.toggle('light-theme', theme === 'light');
  document.body?.classList.toggle('dark-theme', theme === 'dark');
  localStorage.setItem(preferenceKey, theme);
  localStorage.setItem('theme', theme);
  
  if (btn) {
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    btn.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0d12' : '#f7f5f1');
}

// Bind to window for backward compatibility and index.html compatibility
if (typeof window !== 'undefined') {
  window.toggleTheme = toggleTheme;
  window.toggleSfjrTheme = toggleTheme;
  window.setSfjrTheme = setSfjrTheme;
  window.SFJR_THEME = { toggleTheme, setSfjrTheme };
}
