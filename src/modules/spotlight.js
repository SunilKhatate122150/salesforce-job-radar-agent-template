// macOS 27 Spotlight "Search or Ask" Module (Cmd+K)
export function initSpotlight() {
  if (typeof window === 'undefined') return;

  const spotlightBackdrop = document.getElementById('macosSpotlightModal');
  const spotlightInput = document.getElementById('macosSpotlightInput');
  const spotlightResults = document.getElementById('macosSpotlightResults');
  const spotlightBtn = document.getElementById('macosSpotlightBtn');

  if (!spotlightBackdrop || !spotlightInput || !spotlightResults) return;

  let selectedIndex = 0;
  let currentResults = [];

  // Open / Close Spotlight
  function openSpotlight() {
    spotlightBackdrop.classList.add('show');
    spotlightInput.value = '';
    renderResults(getDefaultItems());
    setTimeout(() => spotlightInput.focus(), 50);
  }

  function closeSpotlight() {
    spotlightBackdrop.classList.remove('show');
  }

  window.openSpotlight = openSpotlight;
  window.closeSpotlight = closeSpotlight;

  // Bind Openers
  spotlightBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    openSpotlight();
  });

  // Global Keyboard Shortcuts: Cmd+K / Ctrl+K & Escape
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (spotlightBackdrop.classList.contains('show')) {
        closeSpotlight();
      } else {
        openSpotlight();
      }
    } else if (e.key === 'Escape' && spotlightBackdrop.classList.contains('show')) {
      closeSpotlight();
    }
  });

  // Close when clicking outside modal window
  spotlightBackdrop.addEventListener('click', (e) => {
    if (e.target === spotlightBackdrop) {
      closeSpotlight();
    }
  });

  // Search input handler
  spotlightInput.addEventListener('input', () => {
    const query = spotlightInput.value.trim().toLowerCase();
    if (!query) {
      renderResults(getDefaultItems());
      return;
    }
    const filtered = searchCatalog(query);
    renderResults(filtered);
  });

  // Keyboard navigation within results
  spotlightInput.addEventListener('keydown', (e) => {
    if (!currentResults.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % currentResults.length;
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
      updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentResults[selectedIndex]) {
        executeItem(currentResults[selectedIndex]);
      }
    }
  });

  function updateSelection() {
    const items = spotlightResults.querySelectorAll('.spotlight-item');
    items.forEach((el, i) => {
      el.classList.toggle('is-selected', i === selectedIndex);
      if (i === selectedIndex) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function executeItem(item) {
    closeSpotlight();
    if (item.action) {
      item.action();
    } else if (item.id && typeof window.showPage === 'function') {
      window.showPage(item.id);
    }
  }

  function renderResults(items) {
    currentResults = items;
    selectedIndex = 0;
    spotlightResults.innerHTML = '';

    if (!items.length) {
      spotlightResults.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--color-text-muted, #94a3b8); font-size: 13px;">
          No matching Salesforce topics or commands found.
        </div>
      `;
      return;
    }

    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = `spotlight-item ${index === 0 ? 'is-selected' : ''}`;
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
          <span style="font-size: 16px;">${item.icon || '📄'}</span>
          <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <div style="font-weight: 600; font-size: 13.5px;">${item.label}</div>
            ${item.desc ? `<div style="font-size: 11px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis;">${item.desc}</div>` : ''}
          </div>
        </div>
        <span class="spotlight-cat">${item.category || 'Topic'}</span>
      `;
      row.addEventListener('click', () => executeItem(item));
      spotlightResults.appendChild(row);
    });
  }
}

function getDefaultItems() {
  return [
    { id: 'dashboard_home', label: 'Dashboard Home', desc: 'Readiness & daily stats overview', category: 'Workspace', icon: '📊' },
    { id: 'job_radar', label: 'Job Radar Dashboard', desc: 'Scan active Salesforce opportunities & hiring posts', category: 'Radar', icon: '📡' },
    { id: 'study_tracker', label: 'Study Progress Tracker', desc: 'Track topics, streak, and daily preparation', category: 'Study', icon: '📚' },
    { id: 'code_practice', label: 'Code Practice Lab', desc: 'Interactive Apex, LWC, and trigger drills', category: 'Lab', icon: '⚡' },
    { id: 'ai_interview', label: 'AI Mock Interview Coach', desc: 'Simulated Salesforce behavioral & technical interview', category: 'Coach', icon: '🎙️' },
    { id: 'sc_agentforce', label: 'Agentforce & AI Architecture', desc: 'Topics on autonomous agents and Atlas reasoning', category: 'AI', icon: '🤖' },
    { id: 'adv_apex', label: 'Advanced Apex & Frameworks', desc: 'Trigger frameworks, bulkification, and governor limits', category: 'Apex', icon: '⚙️' },
    { id: 'adv_lwc', label: 'Advanced LWC & State Management', desc: 'LMS, reactive wires, custom events, and DOM stability', category: 'LWC', icon: '⚡' },
    { id: 'profile_match', label: 'Agent Dashboard & ATS Profile', desc: 'Manage skills, certifications, and resume matches', category: 'Profile', icon: '👤' }
  ];
}

function searchCatalog(query) {
  const allItems = [
    ...getDefaultItems(),
    { id: 'soql', label: 'SOQL & Query Performance', desc: 'Indexed fields, selectivity, relationship queries', category: 'Apex', icon: '🔍' },
    { id: 'triggers', label: 'Triggers & Order of Execution', desc: 'Before/after events, recursion handling', category: 'Apex', icon: '⚡' },
    { id: 'async', label: 'Asynchronous Apex', desc: 'Queueable, Batch, Future, Scheduled Apex', category: 'Apex', icon: '⏳' },
    { id: 'integration', label: 'Salesforce Integrations & REST', desc: 'Named Credentials, OAuth, Platform Events', category: 'Integration', icon: '🔗' },
    { id: 'security_full', label: 'Salesforce Security Architecture', desc: 'FLS, Sharing Rules, with sharing vs without sharing', category: 'Security', icon: '🛡️' },
    { id: 'flows_guide', label: 'Flow Builder Architecture', desc: 'Record-triggered flows, subflows, governance', category: 'Flows', icon: '🌊' },
    { id: 'sc_objects', label: 'Complex Data Modeling Scenarios', desc: 'Junction objects, lookup vs master-detail', category: 'Scenarios', icon: '📑' },
    { id: 'company_interviews', label: 'Top Company Interview Questions', desc: 'PwC, Deloitte, Accenture, Mobigic scenario questions', category: 'Interviews', icon: '💼' }
  ];

  return allItems.filter(item => {
    const text = `${item.label} ${item.desc || ''} ${item.category || ''} ${item.id}`.toLowerCase();
    return text.includes(query);
  });
}

// Auto-initialize
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSpotlight);
  } else {
    initSpotlight();
  }
}
