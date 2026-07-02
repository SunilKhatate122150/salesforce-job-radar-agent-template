// Router & Navigation Shell Module (Vite)
import { checkAuth, signOut } from './auth.js';
import { SFJR_NAVIGATION } from '../data/navigation.js';

export let isNavigating = false;

if (typeof window !== 'undefined') {
  window.getNavigationLabel = function(id) {
    if (id === 'job_radar') return 'Job Radar';
    for (const group of SFJR_NAVIGATION) {
      const item = group.items.find(i => i.id === id);
      if (item) return item.label;
    }
    return '';
  };
}
let lastSidebarTrigger = null;
const NAV_MOBILE_MAX_WIDTH = 900;

function isMobileNavViewport() {
  return window.innerWidth <= NAV_MOBILE_MAX_WIDTH;
}

export function setIsNavigating(val) {
  isNavigating = val;
  if (typeof window !== 'undefined') {
    window.isNavigating = val;
  }
}

export async function showPage(id) {
  const headerTitle = document.getElementById('headerTitle');
  if (headerTitle) {
    if (id === 'job_radar') {
      headerTitle.textContent = 'Job Radar';
    } else {
      headerTitle.textContent = (window.topicConfig && window.topicConfig[id]?.name) || (typeof window.getNavigationLabel === 'function' ? window.getNavigationLabel(id) : '') || 'SF Prep Guide';
    }
  }
  if (isNavigating && id !== 'topic_viewer') return; 
  setIsNavigating(true);
  
  const navTimeout = setTimeout(() => { setIsNavigating(false); }, 3500);
  console.log(`%c [TAB SWITCH] -> ${id}`, 'background: #3b82f6; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold;');
  try {
    // Ensure the page content is loaded before showing
    if (typeof window.ensurePageLoaded === 'function') {
      await window.ensurePageLoaded(id);
    }

    if (typeof window.setScopedItem === 'function') {
      window.setScopedItem('last_active_tab', id);
    }
    if (typeof window.stopTracking === 'function') {
      await window.stopTracking();
    }
    if (id !== 'job_radar') {
      if (typeof window.closeLogPanel === 'function') {
        window.closeLogPanel();
      }
    }
    
    console.log(`🧹 [NAV] Hiding all .page elements...`);
    document.querySelectorAll('.page').forEach(function(p) { 
      p.classList.remove('active'); 
      p.style.display = 'none';
    });
    
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    
    let page = typeof window.getPageRouteElement === 'function' ? window.getPageRouteElement(id) : document.getElementById(id);
    let isIndustrial = false;
    const hasLoadedPageContent = () => Boolean(
      page &&
      page.id === id &&
      page.innerHTML &&
      page.innerHTML.trim().length > 80
    );

    const DATA_DRIVEN_TOPIC_IDS = new Set([
      'deloitte', 'accenture', 'security_5_layers', 'order_of_execution', 
      'flow_master', 'sales_cloud', 'service_cloud', 'experience_cloud'
    ]);

    if (!hasLoadedPageContent() && DATA_DRIVEN_TOPIC_IDS.has(id)) {
      if (typeof window.renderTopicContent === 'function') {
        isIndustrial = await window.renderTopicContent(id);
        if (isIndustrial) {
          console.log(`🏰 [NAV] Data-driven topic rendered for: ${id}`);
          page = document.getElementById('topic_viewer');
        }
      }
    }

    if (!page || id === 'topic_viewer') {
      if (typeof window.renderTopicContent === 'function') {
        isIndustrial = await window.renderTopicContent(id);
        if (isIndustrial) {
          console.log(`🏰 [NAV] Detected Industrial Content for: ${id}`);
          page = document.getElementById('topic_viewer');
        }
      }
    }

    if (!page && window.topicConfig && window.topicConfig[id]) {
      console.log(`📚 [NAV] Routing to topic_viewer for: ${id}`);
      page = document.getElementById('topic_viewer');
    }

    if (page) { 
      if (window.topicConfig && window.topicConfig[id] && page.id === id && page.innerHTML.trim().length < 40) {
        if (typeof window.renderTopicContent === 'function') {
          const renderedTopic = await window.renderTopicContent(id);
          if (renderedTopic) {
            page = document.getElementById('topic_viewer');
          }
        }
      }

      console.log(` [NAV] ENABLING PAGE: #${page.id}`);
      page.classList.add('active');
      page.style.display = '';
      
      const finalStyle = getComputedStyle(page);
      console.log(`📊 [NAV] #${page.id} COMPUTED STATE:
      - Display: ${finalStyle.display}
      - Visibility: ${finalStyle.visibility}
      - Height: ${finalStyle.height}
      - Opacity: ${finalStyle.opacity}`);
      
      // Init Logic
      if (id === 'schedule') {
        if (typeof window.renderTimetable === 'function') {
          await window.renderTimetable(); 
        }
      }
      if (id === 'study_history') {
        if (typeof window.renderHistory === 'function') {
          await window.renderHistory();
        }
      }
      if (id === 'study_tracker') {
        if (typeof window.getScopedItem === 'function' && typeof window.switchTrackerTab === 'function') {
          const lastTab = window.getScopedItem('last_tracker_tab', 'tab_suggestions', 'last_tracker_tab');
          window.switchTrackerTab(lastTab);
        }
        if (typeof window.updateTrackerUI === 'function') {
          await window.updateTrackerUI(); 
        }
      }
      if (id === 'job_radar') {
        if (typeof window.fetchJobsList === 'function') {
          window.fetchJobsList();
          if (window._jobRadarInterval) clearInterval(window._jobRadarInterval);
          window._jobRadarInterval = setInterval(() => {
            const radarPage = document.getElementById('job_radar');
            if (radarPage && radarPage.classList.contains('active')) {
              window.fetchJobsList();
            } else {
              clearInterval(window._jobRadarInterval);
              window._jobRadarInterval = null;
            }
          }, 5 * 60 * 1000);
        }
      }
      if (id === 'profile_match') { 
        const loadingEl = document.getElementById('profileMatchLoading');
        if (window.cachedUserProfile) {
          if (typeof window.hydratePremiumSetupForm === 'function') window.hydratePremiumSetupForm(window.cachedUserProfile);
          if (typeof window.renderProfileMatchPage === 'function') window.renderProfileMatchPage(window.cachedUserProfile);
          if (typeof window.loadJobIntelligence === 'function') window.loadJobIntelligence();
        } else {
          if (loadingEl) {
            loadingEl.style.display = 'block';
            loadingEl.innerHTML = typeof window.renderSkeletonDashboard === 'function'
              ? window.renderSkeletonDashboard()
              : (typeof window.renderSkeletonProfile === 'function' ? window.renderSkeletonProfile() : '') + (typeof window.renderSkeletonCards === 'function' ? window.renderSkeletonCards(2) : '');
          }
          if (typeof window.loadUserProfile === 'function') {
            window.loadUserProfile().then(() => {
              if (window.cachedUserProfile) {
                if (typeof window.hydratePremiumSetupForm === 'function') window.hydratePremiumSetupForm(window.cachedUserProfile);
                if (typeof window.loadJobIntelligence === 'function') window.loadJobIntelligence();
                return;
              }
              if (typeof window.readPremiumFormProfile === 'function' && typeof window.renderProfileMatchPage === 'function') {
                window.renderProfileMatchPage(window.readPremiumFormProfile());
              }
              if (typeof window.loadJobIntelligence === 'function') window.loadJobIntelligence();
            }).catch(err => {
              console.warn('[PROFILE] Rendering local profile preview:', err.message);
              if (typeof window.readPremiumFormProfile === 'function' && typeof window.renderProfileMatchPage === 'function') {
                window.renderProfileMatchPage(window.readPremiumFormProfile());
              }
              if (typeof window.loadJobIntelligence === 'function') window.loadJobIntelligence();
            }).finally(() => {
              if (loadingEl) loadingEl.style.display = 'none';
            });
          }
        }
      }
      if (id === 'interview_room' || id === 'ai_interview') {
        if (typeof window.hydrateInterviewRoom === 'function') window.hydrateInterviewRoom();
      }
      if (id === 'study_history') {
        if (typeof window.hydrateHistoryFilter === 'function') window.hydrateHistoryFilter();
      }
      if (id === 'salesforce_releases') {
        if (typeof window.loadReleaseCenter === 'function') {
          window.loadReleaseCenter(true).catch(e => {
            console.warn('[RELEASES] Failed to load release center:', e.message);
            const container = document.getElementById('releaseCenterContent');
            if (container) container.innerHTML = '<div class="content-card">Release data is unavailable right now. The curated data files could not be loaded.</div>';
          });
        }
      }
      if (id === 'code_practice') {
        if (window.CodePractice && typeof window.CodePractice.mount === 'function') {
          window.CodePractice.mount();
        }
      }
      if (id === 'bookmarks_page') {
        if (typeof window.showBookmarks === 'function') window.showBookmarks();
      }
    }


    if (location.hash !== `#${id}`) {
      history.replaceState({ page: id }, '', `#${encodeURIComponent(id)}`);
    }
    if (typeof window.trackRecentTopic === 'function') window.trackRecentTopic(id);
    if (typeof window.updateSidebarActiveState === 'function') window.updateSidebarActiveState(id);
    
    const mainEl = document.getElementById('main');
    if (mainEl) mainEl.scrollTop = 0;
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
    if (typeof window.formatIsoTimestampsIn === 'function') {
      window.formatIsoTimestampsIn(page);
      setTimeout(() => window.formatIsoTimestampsIn(page), 250);
    }
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('mobile-open')) toggleMobileSidebar(false);

    const cfg = window.topicConfig ? window.topicConfig[id] : null;
    if (cfg && !cfg.noTimer && typeof window.startTracking === 'function') window.startTracking(id);
    if (typeof window.renderBookmarkButtons === 'function') window.renderBookmarkButtons();

  } catch (err) {
    console.error('[NAV] showPage() error:', err);
  } finally {
    clearTimeout(navTimeout);
    setIsNavigating(false);
  }
}

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (isMobileNavViewport()) {
    toggleMobileSidebar();
    return;
  }
  localStorage.setItem('sfjr_sidebar_user_toggled', 'true');
  const nextCollapsed = !document.body.classList.contains('sidebar-collapsed');
  if (typeof window.setSidebarCollapsedState === 'function') {
    window.setSidebarCollapsedState(nextCollapsed);
  }

  if (typeof window.renderBoard === 'function') window.renderBoard();
}

export function toggleMobileSidebar(forceOpen) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const toggle = document.getElementById('mobileToggle');
  if (!sidebar) return;
  
  if (isMobileNavViewport()) {
    if (typeof window.closeCollapsedNavFlyout === 'function') window.closeCollapsedNavFlyout();
    document.body.classList.remove('sidebar-rail-active');
    sidebar.classList.remove('nav-rail-active');
    document.body.classList.remove('sidebar-collapsed');
    sidebar.classList.remove('collapsed');
  }
  
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !sidebar.classList.contains('mobile-open');
  const syncA11y = open => {
    const isMobile = isMobileNavViewport();
    sidebar.setAttribute('role', isMobile ? 'dialog' : 'navigation');
    sidebar.setAttribute('aria-modal', String(isMobile && open));
    sidebar.setAttribute('aria-hidden', String(isMobile && !open));
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    }
    if (overlay) overlay.setAttribute('aria-hidden', String(!open));
  };

  if (!shouldOpen) {
    sidebar.classList.remove('mobile-open');
    document.body.classList.remove('nav-open');
    syncA11y(false);
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
    document.body.style.overflow = '';
    if (lastSidebarTrigger && typeof lastSidebarTrigger.focus === 'function') {
      lastSidebarTrigger.focus();
      lastSidebarTrigger = null;
    }
  } else {
    lastSidebarTrigger = document.activeElement;
    sidebar.classList.add('mobile-open');
    document.body.classList.add('nav-open');
    syncA11y(true);
    if (typeof window.syncSidebarStickyOffset === 'function') {
      window.syncSidebarStickyOffset();
      setTimeout(window.syncSidebarStickyOffset, 50);
    }
    if (overlay) {
      overlay.style.display = 'block';
      requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    }
    document.body.style.overflow = 'hidden';
    const focusTarget = sidebar.querySelector('#sidebarCloseBtn, #searchInput, .nav-item, button');
    const moveFocusIntoDrawer = () => {
      if (!sidebar.classList.contains('mobile-open')) return;
      try {
        focusTarget?.focus?.({ preventScroll: true });
      } catch (e) {
        focusTarget?.focus?.();
      }
      if (!sidebar.contains(document.activeElement)) {
        if (!sidebar.hasAttribute('tabindex')) sidebar.setAttribute('tabindex', '-1');
        try {
          sidebar.focus({ preventScroll: true });
        } catch (e) {
          sidebar.focus();
        }
      }
    };
    setTimeout(moveFocusIntoDrawer, 200);
  }
}

export function toggleQA(el) { 
  const isOpen = el.parentElement.classList.toggle('open'); 
  if (isOpen && window.currentTrackedPage) {
    if (typeof window.setScopedItem === 'function') {
      window.setScopedItem('last_q_' + window.currentTrackedPage, el.querySelector('.qa-q-text').textContent);
    }
  }
}

export function toggleStar(el) { 
  el.parentElement.classList.toggle('open'); 
}

// Bind to window for HTML event handlers and backward compatibility
if (typeof window !== 'undefined') {
  window.showPage = showPage;
  window.toggleSidebar = toggleSidebar;
  window.toggleMobileSidebar = toggleMobileSidebar;
  window.toggleQA = toggleQA;
  window.toggleStar = toggleStar;
  window.isNavigating = isNavigating;
  window.SFJR_ROUTER = { showPage, isNavigating, toggleSidebar, toggleMobileSidebar };
  
  window.addEventListener('hashchange', () => {
    const pageId = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (pageId) showPage(pageId);
  });
}
