import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const DEFAULT_URL = 'http://127.0.0.1:3000/?verify=responsive';
const VERIFY_URL = process.env.RESPONSIVE_VERIFY_URL || DEFAULT_URL;
const chromeCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium'
].filter(Boolean);

const viewports = [
  { name: 'mobile-320', width: 320, height: 740 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-900', width: 900, height: 900 },
  { name: 'desktop-901', width: 901, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'desktop-1365', width: 1365, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 }
];

function findChrome() {
  const executable = chromeCandidates.find(candidate => existsSync(candidate));
  if (!executable) {
    throw new Error('Chrome executable not found. Set PUPPETEER_EXECUTABLE_PATH to run responsive verification.');
  }
  return executable;
}

async function waitForApp(page) {
  await page.goto(VERIFY_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('job_radar_view', 'kanban');
    localStorage.setItem('job_radar_sidebar_collapsed', 'false');
  });
  await page.waitForSelector('#main, #job_radar, .page', { timeout: 10000 });
  await page.waitForFunction(() => (
    typeof window.toggleMobileSidebar === 'function'
    && typeof window.filterSidebar === 'function'
    && typeof window.showPage === 'function'
  ), { timeout: 10000 });
}

async function hideLoginOverlay(page) {
  await page.evaluate(() => {
    const login = document.getElementById('loginOverlay');
    if (login) {
      login.style.display = 'none';
      login.setAttribute('aria-hidden', 'true');
    }
  });
}

async function verifyLoginOverlay(page) {
  return page.evaluate(() => {
    const login = document.getElementById('loginOverlay');
    if (!login) return { exists: false, fits: true, visible: false };
    login.style.display = 'flex';
    login.setAttribute('aria-hidden', 'false');
    const panel = login.firstElementChild;
    const rect = panel?.getBoundingClientRect();
    const fits = Boolean(rect)
      && rect.width <= innerWidth
      && rect.height <= innerHeight
      && rect.left >= -1
      && rect.right <= innerWidth + 1;
    return {
      exists: true,
      visible: getComputedStyle(login).display !== 'none',
      fits,
      width: Math.round(rect?.width || 0),
      height: Math.round(rect?.height || 0)
    };
  });
}

async function getOverflowReport(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const maxScrollWidth = Math.max(root.scrollWidth, body.scrollWidth);
    const offenders = Array.from(document.querySelectorAll('body *'))
      .filter(el => !el.closest('[aria-hidden="true"], [hidden]'))
      .map(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          selector: el.id ? `#${el.id}` : (el.className ? `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 3).join('.')}` : el.tagName.toLowerCase()),
          width: Math.round(rect.width),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: style.overflowX
        };
      })
      .filter(item => item.scrollWidth > item.clientWidth + 3 && item.overflowX === 'visible')
      .slice(0, 6);
    return {
      innerWidth,
      maxScrollWidth,
      hasHorizontalOverflow: maxScrollWidth > innerWidth + 3,
      offenders
    };
  });
}

async function verifyShellLayout(page, viewport) {
  return page.evaluate(() => {
    const rectFor = selectorOrElement => {
      const el = typeof selectorOrElement === 'string'
        ? document.querySelector(selectorOrElement)
        : selectorOrElement;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity || 1)
      };
    };
    const isVisible = box => Boolean(
      box
      && box.width > 0
      && box.height > 0
      && box.display !== 'none'
      && box.visibility !== 'hidden'
      && box.opacity > 0.01
    );

    const sidebar = rectFor('#sidebar');
    const main = rectFor('#main');
    const header = rectFor('#mainHeader');
    const mobileToggle = rectFor('#mobileToggle');
    const desktopToggle = rectFor('#sidebarToggle, .desktop-sidebar-toggle');
    const bodyPaddingLeft = Number.parseFloat(getComputedStyle(document.body).paddingLeft || '0') || 0;
    const mobileMode = innerWidth <= 900;
    const sidebarClosed = !document.getElementById('sidebar')?.classList.contains('mobile-open');
    const sidebarRight = sidebar ? Math.round(sidebar.right) : 0;

    return {
      bodyPaddingLeft: Math.round(bodyPaddingLeft),
      mainLeft: main?.left ?? null,
      mainWidth: main?.width ?? null,
      headerLeft: header?.left ?? null,
      headerWidth: header?.width ?? null,
      sidebarLeft: sidebar?.left ?? null,
      sidebarRight,
      sidebarWidth: sidebar?.width ?? null,
      mobileToggleVisible: isVisible(mobileToggle),
      desktopToggleVisible: isVisible(desktopToggle),
      mobileDrawerClosedOffCanvas: mobileMode ? sidebarClosed && sidebarRight <= 2 : null,
      contentAlignedToSidebar: !mobileMode && sidebar && main
        ? Math.abs(main.left - sidebar.right) <= 2
        : null,
      headerAlignedToContent: main && header ? Math.abs(header.left - main.left) <= 2 : null
    };
  });
}

async function verifyTouchTargets(page, viewport) {
  if (viewport.width > 640) return { skipped: 'non-phone viewport' };
  return page.evaluate(() => {
    const selectors = [
      '#mobileToggle',
      '#mobileBoardStageSelect',
      '#mobileRadarActionBar button'
    ];
    const targets = selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)));
    const measured = targets
      .filter(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map(el => {
        const rect = el.getBoundingClientRect();
        return {
          selector: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 2).join('.')}`,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          ok: rect.width >= 44 && rect.height >= 44
        };
      });
    return {
      measured,
      failures: measured.filter(item => !item.ok)
    };
  });
}

async function verifySidebar(page, viewport) {
  if (viewport.width < 901) {
    const mobileToggleVisible = await page.$eval('#mobileToggle', el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }).catch(() => false);
    if (!mobileToggleVisible) return { skipped: 'mobile toggle hidden at this breakpoint' };

    await page.evaluate(() => window.toggleMobileSidebar?.(false));
    await page.waitForFunction(() => !document.getElementById('sidebar')?.classList.contains('mobile-open'), { timeout: 4000 });

    await page.click('#mobileToggle');
    await page.waitForFunction(() => document.getElementById('sidebar')?.classList.contains('mobile-open'), { timeout: 4000 });
    await new Promise(resolve => setTimeout(resolve, 80));
    const openState = await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      const active = document.activeElement;
      const overlayRect = overlay?.getBoundingClientRect();
      const overlayStyle = overlay ? getComputedStyle(overlay) : null;
      return {
        open: sidebar?.classList.contains('mobile-open'),
        expanded: document.getElementById('mobileToggle')?.getAttribute('aria-expanded'),
        ariaHidden: sidebar?.getAttribute('aria-hidden'),
        ariaModal: sidebar?.getAttribute('aria-modal'),
        bodyLocked: document.body.classList.contains('nav-open') && getComputedStyle(document.body).overflow === 'hidden',
        focusInside: Boolean(active && sidebar?.contains(active)),
        overlayVisible: Boolean(
          overlay
          && overlayRect
          && overlayRect.width > 0
          && overlayRect.height > 0
          && overlayStyle.display !== 'none'
          && overlayStyle.visibility !== 'hidden'
          && Number(overlayStyle.opacity || 0) > 0.2
        )
      };
    });

    await page.evaluate(() => document.getElementById('sidebarOverlay')?.click());
    await page.waitForFunction(() => !document.getElementById('sidebar')?.classList.contains('mobile-open'), { timeout: 4000 });
    const overlayClosed = await page.evaluate(() => ({
      closed: !document.getElementById('sidebar')?.classList.contains('mobile-open'),
      expanded: document.getElementById('mobileToggle')?.getAttribute('aria-expanded'),
      ariaHidden: document.getElementById('sidebar')?.getAttribute('aria-hidden'),
      bodyUnlocked: !document.body.classList.contains('nav-open') && getComputedStyle(document.body).overflow !== 'hidden',
      focusReturned: document.activeElement?.id === 'mobileToggle'
    }));

    const openedForCloseButton = await page.evaluate(() => {
      window.toggleMobileSidebar?.(true);
      return document.getElementById('sidebar')?.classList.contains('mobile-open') || false;
    });
    if (openedForCloseButton) {
      await page.evaluate(() => document.getElementById('sidebarCloseBtn')?.click());
      await page.waitForFunction(() => !document.getElementById('sidebar')?.classList.contains('mobile-open'), { timeout: 4000 });
    }
    const closeButtonClosed = await page.evaluate(() => !document.getElementById('sidebar')?.classList.contains('mobile-open'));

    const openedForEscape = await page.evaluate(() => {
      window.toggleMobileSidebar?.(true);
      return document.getElementById('sidebar')?.classList.contains('mobile-open') || false;
    });
    if (openedForEscape) {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('sidebar')?.classList.contains('mobile-open'), { timeout: 4000 });
    }
    const escapeClosed = await page.evaluate(() => !document.getElementById('sidebar')?.classList.contains('mobile-open'));

    const openedForNavItem = await page.evaluate(() => {
      window.toggleMobileSidebar?.(true);
      return document.getElementById('sidebar')?.classList.contains('mobile-open') || false;
    });
    if (openedForNavItem) {
      await page.waitForSelector('#sidebar .nav-item[data-page-id]', { timeout: 4000 });
      await page.evaluate(() => document.querySelector('#sidebar .nav-item[data-page-id]')?.click());
      await page.waitForFunction(() => !document.getElementById('sidebar')?.classList.contains('mobile-open'), { timeout: 4000 });
    }
    const navItemClosed = await page.evaluate(() => !document.getElementById('sidebar')?.classList.contains('mobile-open'));

    return {
      ...openState,
      overlayClosed,
      openedForCloseButton,
      closeButtonClosed,
      openedForEscape,
      escapeClosed,
      openedForNavItem,
      navItemClosed
    };
  }

  await page.evaluate(() => document.body.classList.remove('sidebar-collapsed'));
  const canCollapse = await page.$('.desktop-sidebar-toggle');
  if (!canCollapse) return { skipped: 'desktop sidebar toggle not found' };
  const desktopToggleVisible = await page.$eval('.desktop-sidebar-toggle', el => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }).catch(() => false);
  if (!desktopToggleVisible) return { skipped: 'desktop sidebar toggle hidden at this breakpoint' };
  await page.evaluate(() => document.querySelector('.desktop-sidebar-toggle')?.click());
  await page.waitForFunction(() => document.body.classList.contains('sidebar-collapsed'), { timeout: 4000 });
  await new Promise(resolve => setTimeout(resolve, 450));
  const collapsed = await page.evaluate(() => {
    const sidebar = document.getElementById('sidebar');
    const visibleHeaderText = Array.from(document.querySelectorAll('.sidebar-brand-title, .sidebar-brand-subtitle, .sync-status-indicator'))
      .some(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01;
      });
    return {
      collapsed: document.body.classList.contains('sidebar-collapsed'),
      width: Math.round(sidebar?.getBoundingClientRect().width || 0),
      visibleHeaderText
    };
  });
  await page.evaluate(() => document.querySelector('#sidebar .nav-group-toggle')?.click());
  await page.waitForFunction(() => document.getElementById('collapsedNavFlyout')?.classList.contains('is-open'), { timeout: 4000 });
  const flyout = await page.evaluate(() => {
    const el = document.getElementById('collapsedNavFlyout');
    const rect = el?.getBoundingClientRect();
    return {
      open: el?.classList.contains('is-open') || false,
      fitsViewport: Boolean(rect)
        && rect.left >= -1
        && rect.top >= -1
        && rect.right <= innerWidth + 1
        && rect.bottom <= innerHeight + 1,
      width: Math.round(rect?.width || 0),
      height: Math.round(rect?.height || 0),
      left: Math.round(rect?.left || 0),
      top: Math.round(rect?.top || 0)
    };
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('collapsedNavFlyout')?.classList.contains('is-open'), { timeout: 4000 });
  const flyoutClosedByEscape = await page.evaluate(() => !document.getElementById('collapsedNavFlyout')?.classList.contains('is-open'));
  await page.evaluate(() => document.querySelector('.desktop-sidebar-toggle')?.click());
  await page.waitForFunction(() => !document.body.classList.contains('sidebar-collapsed'), { timeout: 4000 });
  return { ...collapsed, flyout, flyoutClosedByEscape };
}

async function verifySidebarSearch(page, viewport) {
  await page.evaluate(() => {
    window.toggleMobileSidebar?.(false);
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    window.filterSidebar?.('');
  });

  const result = await page.evaluate(() => {
    const input = document.getElementById('searchInput');
    const sectionStates = () => Array.from(document.querySelectorAll('#sidebar .nav-parent-section'))
      .filter(section => getComputedStyle(section).display !== 'none')
      .map(section => {
        const toggle = section.querySelector('.nav-group-toggle');
        const panel = section.querySelector('.nav-group-items');
        const expanded = toggle?.getAttribute('aria-expanded') === 'true';
        const hidden = Boolean(panel?.hidden);
        return {
          expanded,
          hidden,
          hasOpenClass: section.classList.contains('is-open'),
          hasClosedClass: section.classList.contains('is-closed')
        };
      });
    const consistent = states => states.every(state => (
      state.expanded === !state.hidden
      && state.hasOpenClass === state.expanded
      && state.hasClosedClass === !state.expanded
    ));

    if (input) input.value = 'zzzz-no-topic-match';
    window.filterSidebar?.(input?.value || '');
    const empty = document.getElementById('sidebarSearchEmpty');
    const emptyStyle = empty ? getComputedStyle(empty) : null;
    const noMatchStates = sectionStates();
    const noMatchVisibleItems = Array.from(document.querySelectorAll('#sidebar .nav-item'))
      .filter(item => getComputedStyle(item).display !== 'none').length;
    const noMatchEmptyVisible = Boolean(
      empty
      && !empty.hidden
      && emptyStyle.display !== 'none'
      && emptyStyle.visibility !== 'hidden'
      && /No matching topics/i.test(empty.textContent || '')
    );

    if (input) input.value = 'apex';
    window.filterSidebar?.(input?.value || '');
    const matchStates = sectionStates();
    const matchVisibleItems = Array.from(document.querySelectorAll('#sidebar .nav-item'))
      .filter(item => getComputedStyle(item).display !== 'none').length;

    if (input) input.value = '';
    window.filterSidebar?.('');
    const resetStates = sectionStates();
    const resetVisibleItems = Array.from(document.querySelectorAll('#sidebar .nav-item'))
      .filter(item => getComputedStyle(item).display !== 'none').length;
    const resetEmpty = document.getElementById('sidebarSearchEmpty');
    const revisionAlerts = document.getElementById('revisionAlerts');

    return {
      noMatchEmptyVisible,
      noMatchVisibleItems,
      noMatchStateConsistent: consistent(noMatchStates),
      matchVisibleItems,
      matchStateConsistent: consistent(matchStates),
      resetVisibleItems,
      resetStateConsistent: consistent(resetStates),
      resetEmptyHidden: !resetEmpty || resetEmpty.hidden,
      revisionAlertsRestored: !revisionAlerts || getComputedStyle(revisionAlerts).display !== 'none'
    };
  });

  if (viewport.width <= 900) {
    await page.evaluate(() => window.toggleMobileSidebar?.(false));
  }
  return result;
}

async function verifyHeaderControls(page, viewport) {
  return page.evaluate(() => {
    const rectFor = selectorOrElement => {
      const el = typeof selectorOrElement === 'string'
        ? document.querySelector(selectorOrElement)
        : selectorOrElement;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible = rect.width > 0
        && rect.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0.01;
      return {
        selector: typeof selectorOrElement === 'string' ? selectorOrElement : (el.id ? `#${el.id}` : el.tagName.toLowerCase()),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible
      };
    };
    const overlap = (a, b) => a.visible && b.visible
      && a.left < b.right - 2
      && a.right > b.left + 2
      && a.top < b.bottom - 2
      && a.bottom > b.top + 2;

    const header = rectFor('#mainHeader');
    const title = rectFor('#headerTitle');
    const mobileToggle = rectFor('#mobileToggle');
    const themeToggle = rectFor('#themeToggleBtn');
    const uiModeToggle = rectFor('#uiModeToggle');
    const profile = rectFor('.floating-profile');
    const controls = [mobileToggle, title, themeToggle, uiModeToggle, profile].filter(Boolean);
    const overlaps = [];
    for (let i = 0; i < controls.length; i += 1) {
      for (let j = i + 1; j < controls.length; j += 1) {
        if (overlap(controls[i], controls[j])) overlaps.push(`${controls[i].selector}/${controls[j].selector}`);
      }
    }

    const menu = document.getElementById('floatDropdownMenu');
    if (menu) {
      menu.style.display = 'flex';
      menu.setAttribute('aria-hidden', 'false');
      window.syncFloatingDropdownViewport?.(menu);
    }
    const dropdown = rectFor('#floatDropdownMenu');
    if (menu) {
      menu.style.display = 'none';
      menu.setAttribute('aria-hidden', 'true');
    }

    return {
      headerFits: Boolean(header)
        && header.left >= -1
        && header.right <= innerWidth + 1
        && header.width <= innerWidth + 1,
      overlaps,
      dropdownFits: !dropdown?.visible || (
        dropdown.left >= -1
        && dropdown.right <= innerWidth + 1
        && dropdown.top >= -1
        && dropdown.bottom <= innerHeight + 1
      ),
      dropdown
    };
  });
}

async function seedJobRadarBoard(page) {
  await page.evaluate(() => {
    const now = Date.now();
    const statuses = ['todo', 'applied', 'interview', 'offer', 'rejected'];
    const jobs = [];
    for (let index = 0; index < 9; index += 1) {
      jobs.push({
        id: `qa-todo-${index}`,
        job_hash: `qa-todo-hash-${index}`,
        company: index === 7 ? 'Apex Cloud QA Target' : `Apex Cloud ${index + 1}`,
        role: index % 2 === 0 ? 'Salesforce Developer' : 'Salesforce FDE Consultant',
        title: index % 2 === 0 ? 'Salesforce Developer' : 'Salesforce FDE Consultant',
        status: 'todo',
        location: 'Remote India',
        score: index < 5 ? 92 - index : 58 + index,
        prob: index < 5 ? 'high' : 'medium',
        probability: index < 5 ? 'high' : 'medium',
        matched_skills: ['Apex', 'LWC', 'Integration'],
        missing_skills: ['Data Cloud'],
        why_apply: 'QA seeded role for responsive verification.',
        apply_link: '#',
        updatedAt: new Date(now - index * 3600000).toISOString()
      });
    }
    statuses.slice(1).forEach((status, index) => {
      jobs.push({
        id: `qa-${status}`,
        job_hash: `qa-${status}-hash`,
        company: `${status[0].toUpperCase()}${status.slice(1)} Systems`,
        role: 'Salesforce Platform Engineer',
        title: 'Salesforce Platform Engineer',
        status,
        location: 'Pune / Remote',
        score: 84 - index,
        prob: 'high',
        probability: 'high',
        matched_skills: ['Flow', 'Security', 'Agentforce'],
        missing_skills: ['Data Cloud'],
        why_apply: `QA seeded ${status} role.`,
        apply_link: '#',
        updatedAt: new Date(now - (index + 10) * 3600000).toISOString()
      });
    });
    window.pipelineJobs = jobs;
    window.jobRadarLoading = false;
    window.currentBoardFilter = 'all';
    window.currentBoardSearch = '';
    window.currentMobileBoardStage = 'todo';
    window.radarBoardPages = { todo: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
    const input = document.getElementById('boardSearch');
    if (input) input.value = '';
    if (typeof window.renderBoard === 'function') window.renderBoard();
  });
}

async function verifyJobRadar(page, viewport) {
  await page.evaluate(() => {
    if (typeof window.showPage === 'function') window.showPage('job_radar');
    const login = document.getElementById('loginOverlay');
    if (login) login.style.display = 'none';
  });
  await page.waitForSelector('#job_radar', { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('#job_radar .kanban-board-v3'), { timeout: 10000 });
  await seedJobRadarBoard(page);
  await page.waitForSelector('#job_radar .jcard-v3[data-job-id]', { timeout: 10000 });

  const interaction = await page.evaluate(() => {
    const initialCards = document.querySelectorAll('#job_radar .jcard-v3[data-job-id]').length;
    const initialColumns = document.querySelectorAll('#job_radar .kanban-col-v3').length;

    const firstCard = document.querySelector('#job_radar .jcard-v3[data-job-id]');
    firstCard?.click();
    const flyoutOpen = document.getElementById('jobDetailsFlyout')?.classList.contains('open') || false;
    window.closeJobDetailsFlyout?.();

    const searchInput = document.getElementById('boardSearch');
    if (searchInput) searchInput.value = 'Apex Cloud QA Target';
    window.doBoardSearch?.();
    const searchCards = document.querySelectorAll('#job_radar .jcard-v3[data-job-id]').length;
    const searchMatched = Array.from(document.querySelectorAll('#job_radar .jcard-company'))
      .some(el => /Apex Cloud QA Target/i.test(el.textContent || ''));

    if (searchInput) searchInput.value = '';
    window.currentBoardSearch = '';
    window.setBoardFilter?.('high');
    const highFilterCount = window.getBoardColumnJobs ? window.getBoardColumnJobs('todo').length : 0;
    const highFilterAllHigh = window.getBoardColumnJobs
      ? window.getBoardColumnJobs('todo').every(job => String(job.prob || job.probability || '').toLowerCase() === 'high' || Number(job.score || 0) >= 75)
      : false;

    window.setBoardFilter?.('all');
    window.setBoardPage?.('todo', 1);
    const pageAfterNext = window.radarBoardPages?.todo || 0;
    window.setBoardPage?.('todo', -1);
    const pageAfterPrev = window.radarBoardPages?.todo || 0;

    return {
      initialCards,
      initialColumns,
      flyoutOpen,
      searchCards,
      searchMatched,
      highFilterCount,
      highFilterAllHigh,
      pageAfterNext,
      pageAfterPrev
    };
  });

  const header = await page.evaluate(() => {
    const rectFor = el => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        selector: el.id ? `#${el.id}` : `.${Array.from(el.classList || []).join('.')}`,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity || 1)
      };
    };
    const visible = box => Boolean(
      box
      && box.width > 0
      && box.height > 0
      && box.display !== 'none'
      && box.visibility !== 'hidden'
      && box.opacity > 0.01
    );
    const overlapPairs = elements => {
      const boxes = elements.map(rectFor).filter(visible);
      const overlaps = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const horizontal = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const vertical = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (horizontal > 1 && vertical > 1) overlaps.push(`${a.selector} over ${b.selector}`);
        }
      }
      return overlaps;
    };

    const shellHeader = document.getElementById('mainHeader');
    const shellTitle = document.getElementById('headerTitle');
    const radarHeader = document.querySelector('#job_radar .radar-v3-header');
    const shellHeaderRect = shellHeader?.getBoundingClientRect();
    const radarHeaderRect = radarHeader?.getBoundingClientRect();
    const shellTitleBox = rectFor(shellTitle);
    const directChildren = Array.from(radarHeader?.children || []);
    const pstats = Array.from(document.querySelectorAll('#job_radar .pipe-stats > .pstat'));
    const actionButtons = Array.from(document.querySelectorAll('#job_radar .radar-header-actions > *'));
    const overlaps = [
      ...overlapPairs(directChildren),
      ...overlapPairs(pstats),
      ...overlapPairs(actionButtons)
    ];

    return {
      radarHeaderFits: Boolean(radarHeader)
        && radarHeader.scrollWidth <= radarHeader.clientWidth + 2
        && radarHeaderRect.left >= -1
        && radarHeaderRect.right <= innerWidth + 1,
      overlaps,
      mobileTopGap: shellHeaderRect && radarHeaderRect
        ? Math.round(radarHeaderRect.top - shellHeaderRect.bottom)
        : null,
      shellTitleText: shellTitle?.textContent?.trim() || '',
      shellTitleVisible: visible(shellTitleBox)
        && /job radar/i.test(shellTitle?.textContent || '')
    };
  });

  if (viewport.width <= 640) {
    await page.waitForSelector('#mobileBoardStageSelect', { timeout: 10000 });
    await page.select('#mobileBoardStageSelect', 'applied');
    return page.evaluate(() => {
      const select = document.getElementById('mobileBoardStageSelect');
      const visibleColumns = Array.from(document.querySelectorAll('#job_radar .kanban-col-v3'))
        .filter(el => getComputedStyle(el).display !== 'none')
        .map(el => el.id);
      return {
        hasMobileStageSelect: Boolean(select),
        selectedStage: select?.value || '',
        optionCount: select?.options.length || 0,
        visibleColumns,
        interaction: window.__lastRadarInteraction || null
      };
    }).then(result => ({ ...result, header, interaction }));
  }

  return page.evaluate(() => ({
    hasBoard: Boolean(document.querySelector('#job_radar .kanban-board-v3')),
    columns: document.querySelectorAll('#job_radar .kanban-col-v3').length,
    stageNavHidden: getComputedStyle(document.getElementById('mobileBoardStageNav') || document.body).display === 'none'
  })).then(result => ({ ...result, header, interaction }));
}

async function verifyAgentDashboard(page, viewport) {
  await page.evaluate(() => {
    if (typeof window.showPage === 'function') window.showPage('profile_match');
    const login = document.getElementById('loginOverlay');
    if (login) login.style.display = 'none';
    window.pipelineJobs = [
      {
        id: 'qa-agent-role-1',
        company: 'Apex Cloud',
        role: 'Salesforce Developer',
        status: 'todo',
        score: 90,
        prob: 'high',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'qa-agent-role-2',
        company: 'FlowWorks',
        role: 'Salesforce Admin Developer',
        status: 'todo',
        score: 78,
        prob: 'high',
        updatedAt: new Date().toISOString()
      }
    ];
    window.jobRadarCloudState = { status: 'idle', message: 'Ready', detail: '' };
    if (typeof window.renderProfileMatchPage === 'function') {
      window.renderProfileMatchPage({
        name: 'QA User',
        currentDesignation: 'Salesforce Developer',
        targetDesignation: 'Salesforce Developer',
        experienceYears: 1,
        skills: ['Apex', 'LWC', 'Flow', 'SOQL', 'Automation Engineering'],
        missingSkills: [],
        certifications: [],
        platforms: {}
      });
    }
    document.getElementById('premiumOnboardingPanel')?.style.setProperty('display', 'none');
  });
  await page.waitForSelector('#profile_match .career-os-grid', { timeout: 10000 });
  await page.waitForSelector('#profile_match .action-queue', { timeout: 10000 });

  return page.evaluate(() => {
    const rectFor = selectorOrElement => {
      const el = typeof selectorOrElement === 'string'
        ? document.querySelector(selectorOrElement)
        : selectorOrElement;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };
    const actionQueueEl = document.querySelector('#profile_match .action-queue');
    const gridEl = actionQueueEl?.closest('.career-os-grid') || document.querySelector('#profile_match .career-os-grid');
    const grid = gridEl ? rectFor(gridEl) : null;
    const actionQueue = actionQueueEl ? rectFor(actionQueueEl) : null;
    const actionItems = Array.from(document.querySelectorAll('#profile_match .career-os-action-item'))
      .map(el => Math.round(el.getBoundingClientRect().width));
    const roadmapCards = Array.from(document.querySelectorAll('#profile_match .roadmap-topic-card'));
    const roadmapMeta = roadmapCards.map(card => {
      const cardRect = card.getBoundingClientRect();
      const meta = card.querySelector('.topic-meta');
      const est = card.querySelector('.est-time');
      const prep = card.querySelector('.start-prep');
      const metaRect = meta?.getBoundingClientRect();
      const estRect = est?.getBoundingClientRect();
      const prepRect = prep?.getBoundingClientRect();
      const prepStyle = prep ? getComputedStyle(prep) : null;
      const estStyle = est ? getComputedStyle(est) : null;
      return {
        hasMeta: Boolean(meta),
        hasEst: Boolean(est),
        hasPrep: Boolean(prep),
        cardWidth: Math.round(cardRect.width),
        metaHeight: metaRect ? Math.round(metaRect.height) : 0,
        estWidth: estRect ? Math.round(estRect.width) : 0,
        estHeight: estRect ? Math.round(estRect.height) : 0,
        prepWidth: prepRect ? Math.round(prepRect.width) : 0,
        prepHeight: prepRect ? Math.round(prepRect.height) : 0,
        prepWhiteSpace: prepStyle?.whiteSpace || '',
        estWhiteSpace: estStyle?.whiteSpace || '',
        fitsCard: Boolean(metaRect)
          && metaRect.left >= cardRect.left - 1
          && metaRect.right <= cardRect.right + 1
          && metaRect.bottom <= cardRect.bottom + 1
      };
    });
    const roadmapMetaStable = roadmapMeta.length > 0 && roadmapMeta.every(item => (
      item.hasMeta
      && item.hasEst
      && item.hasPrep
      && item.fitsCard
      && item.estHeight <= 28
      && item.prepHeight <= 28
      && item.estWidth >= 46
      && item.prepWidth >= 64
      && item.estWhiteSpace === 'nowrap'
      && item.prepWhiteSpace === 'nowrap'
    ));
    const visiblePanels = Array.from(document.querySelectorAll('#profile_match .career-os-grid > .career-os-panel'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none';
      }).length;
    const actionList = document.querySelector('#profile_match .career-os-action-list');
    return {
      visiblePanels,
      grid,
      actionQueue,
      actionListColumns: actionList ? getComputedStyle(actionList).gridTemplateColumns : '',
      actionItems,
      roadmapCardsVisible: roadmapCards.length,
      roadmapMeta,
      roadmapMetaStable,
      actionQueueFullWidth: grid && actionQueue
        ? Math.abs(actionQueue.left - grid.left) <= 2 && actionQueue.width >= grid.width - 4
        : false,
      minActionItemWidth: actionItems.length ? Math.min(...actionItems) : 0
    };
  });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const failures = [];
  const results = [];

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage();
      const consoleErrors = [];
      page.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error' && !/accounts\.google\.com|GSI_LOGGER|Failed to load resource/.test(text)) {
          consoleErrors.push(text);
        }
      });
      await page.setViewport(viewport);
      await waitForApp(page);
      const login = await verifyLoginOverlay(page);
      await hideLoginOverlay(page);

      const overflow = await getOverflowReport(page);
      const shell = await verifyShellLayout(page, viewport);
      const sidebar = await verifySidebar(page, viewport);
      const sidebarSearch = await verifySidebarSearch(page, viewport);
      const headerControls = await verifyHeaderControls(page, viewport);
      const radar = await verifyJobRadar(page, viewport);
      const touchTargets = await verifyTouchTargets(page, viewport);
      const postRadarOverflow = await getOverflowReport(page);
      const agentDashboard = await verifyAgentDashboard(page, viewport);

      const result = {
        viewport,
        login,
        overflow,
        shell,
        sidebar,
        sidebarSearch,
        headerControls,
        radar,
        agentDashboard,
        touchTargets,
        postRadarOverflow,
        consoleErrors
      };
      results.push(result);

      if (viewport.width <= 320 && (!login.exists || !login.fits)) {
        failures.push(`${viewport.name}: login overlay does not fit 320px viewport`);
      }
      if (overflow.hasHorizontalOverflow || postRadarOverflow.hasHorizontalOverflow) {
        failures.push(`${viewport.name}: horizontal overflow detected`);
      }
      if (viewport.width <= 900) {
        if (!shell.mobileToggleVisible) {
          failures.push(`${viewport.name}: mobile navigation toggle hidden`);
        }
        if (shell.bodyPaddingLeft > 1 || Math.abs(shell.mainLeft || 0) > 1 || Math.abs(shell.headerLeft || 0) > 1) {
          failures.push(`${viewport.name}: content is pushed by the mobile drawer`);
        }
        if (!shell.mobileDrawerClosedOffCanvas) {
          failures.push(`${viewport.name}: mobile drawer is visible before opening`);
        }
        if (
          !sidebar.open
          || sidebar.expanded !== 'true'
          || sidebar.ariaHidden !== 'false'
          || sidebar.ariaModal !== 'true'
          || !sidebar.bodyLocked
          || !sidebar.focusInside
          || !sidebar.overlayVisible
          || !sidebar.overlayClosed?.closed
          || sidebar.overlayClosed?.expanded !== 'false'
          || sidebar.overlayClosed?.ariaHidden !== 'true'
          || !sidebar.overlayClosed?.bodyUnlocked
          || !sidebar.overlayClosed?.focusReturned
          || !sidebar.openedForCloseButton
          || !sidebar.closeButtonClosed
          || !sidebar.openedForEscape
          || !sidebar.escapeClosed
          || !sidebar.openedForNavItem
          || !sidebar.navItemClosed
        ) {
          failures.push(`${viewport.name}: mobile drawer open/close state is not synchronized`);
        }
      } else {
        if (shell.mobileToggleVisible) {
          failures.push(`${viewport.name}: mobile toggle visible on desktop`);
        }
        if (!shell.desktopToggleVisible) {
          failures.push(`${viewport.name}: desktop sidebar toggle hidden`);
        }
        if (!shell.contentAlignedToSidebar || !shell.headerAlignedToContent) {
          failures.push(`${viewport.name}: sidebar, header, and content are misaligned`);
        }
        if (sidebar.collapsed && (!sidebar.flyout?.open || !sidebar.flyout?.fitsViewport || !sidebar.flyoutClosedByEscape)) {
          failures.push(`${viewport.name}: collapsed sidebar flyout does not fit or close correctly`);
        }
      }
      if (!sidebarSearch.noMatchEmptyVisible || sidebarSearch.noMatchVisibleItems !== 0) {
        failures.push(`${viewport.name}: sidebar search empty state did not appear for no-result query`);
      }
      if (
        !sidebarSearch.noMatchStateConsistent
        || !sidebarSearch.matchStateConsistent
        || !sidebarSearch.resetStateConsistent
        || !sidebarSearch.resetEmptyHidden
        || !sidebarSearch.revisionAlertsRestored
        || sidebarSearch.matchVisibleItems < 1
        || sidebarSearch.resetVisibleItems < sidebarSearch.matchVisibleItems
      ) {
        failures.push(`${viewport.name}: sidebar search did not keep accordion state synchronized`);
      }
      if (!headerControls.headerFits || headerControls.overlaps.length || !headerControls.dropdownFits) {
        failures.push(`${viewport.name}: header controls or profile dropdown overlap/outgrow viewport`);
      }
      if (!radar.header?.radarHeaderFits || radar.header?.overlaps?.length) {
        failures.push(`${viewport.name}: Job Radar header controls overlap`);
      }
      if (viewport.width <= 900 && (!radar.header?.shellTitleVisible || Math.abs(radar.header?.mobileTopGap || 0) > 8)) {
        failures.push(`${viewport.name}: Job Radar mobile shell title or top spacing is broken`);
      }
      if (viewport.width <= 640) {
        if (!radar.hasMobileStageSelect || radar.optionCount < 5 || radar.visibleColumns.length !== 1 || radar.selectedStage !== 'applied') {
          failures.push(`${viewport.name}: mobile Job Radar stage selector is not controlling one visible column`);
        }
        if (touchTargets.failures?.length) {
          failures.push(`${viewport.name}: touch targets below 44px: ${touchTargets.failures.map(item => item.selector).join(', ')}`);
        }
      }
      if (viewport.width >= 1024 && sidebar.collapsed && (sidebar.width > 96 || sidebar.visibleHeaderText)) {
        failures.push(`${viewport.name}: collapsed sidebar leaked text or exceeded compact width`);
      }
      if (!radar.interaction?.flyoutOpen) {
        failures.push(`${viewport.name}: job card detail flyout did not open`);
      }
      if (!agentDashboard.visiblePanels || !agentDashboard.actionQueueFullWidth) {
        failures.push(`${viewport.name}: Agent Dashboard action queue is squeezed into a narrow column`);
      }
      if (viewport.width >= 1024 && agentDashboard.minActionItemWidth < 260) {
        failures.push(`${viewport.name}: Agent Dashboard action cards are too narrow`);
      }
      if (!agentDashboard.roadmapCardsVisible || !agentDashboard.roadmapMetaStable) {
        failures.push(`${viewport.name}: roadmap action labels collapse or overflow`);
      }
      if (!radar.interaction?.searchMatched || radar.interaction.searchCards < 1) {
        failures.push(`${viewport.name}: job board search did not return seeded role`);
      }
      if (!radar.interaction?.highFilterAllHigh || radar.interaction.highFilterCount < 1) {
        failures.push(`${viewport.name}: high-fit filter did not return high-fit seeded roles`);
      }
      if (radar.interaction?.pageAfterNext !== 1 || radar.interaction?.pageAfterPrev !== 0) {
        failures.push(`${viewport.name}: job board pagination did not move forward/back`);
      }
      if (consoleErrors.length) {
        failures.push(`${viewport.name}: console errors: ${consoleErrors.slice(0, 2).join(' | ')}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ url: VERIFY_URL, results, failures }, null, 2));
  if (failures.length) process.exit(1);
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
