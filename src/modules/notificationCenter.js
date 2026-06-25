// Notification Center Module

export function getNotificationsKey(userId = 'guest') {
  return `sfjr:${userId}:notifications`;
}

export function loadNotifications(userId = 'guest') {
  try {
    const data = localStorage.getItem(getNotificationsKey(userId));
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('[NOTIFICATIONS] Failed to load from localStorage', e);
  }
  
  // Default welcome notification
  return [
    {
      id: 'welcome_' + Date.now(),
      title: 'Welcome to Job Radar AI Premium',
      text: 'Start by updating your designation/experience on the setup page, and then scan matching roles.',
      timestamp: new Date().toISOString(),
      unread: true,
      type: 'info'
    }
  ];
}

export function saveNotifications(notifications, userId = 'guest') {
  try {
    localStorage.setItem(getNotificationsKey(userId), JSON.stringify(notifications));
  } catch (e) {
    console.error('[NOTIFICATIONS] Failed to save to localStorage', e);
  }
}

export function addNotification(title, text, type = 'info', userId = 'guest') {
  const notifications = loadNotifications(userId);
  notifications.unshift({
    id: 'notif_' + Math.random().toString(36).substr(2, 9),
    title,
    text,
    timestamp: new Date().toISOString(),
    unread: true,
    type
  });
  // Cap at 20 notifications
  if (notifications.length > 20) notifications.pop();
  saveNotifications(notifications, userId);
  
  renderNotificationBadge(userId);
  renderNotificationList(userId);
  
  // Fire browser toast as well
  if (typeof window.showToast === 'function') {
    window.showToast(`🔔 ${title}`, type === 'error');
  }
}

export function getUnreadCount(userId = 'guest') {
  return loadNotifications(userId).filter(n => n.unread).length;
}

export function markAllAsRead(userId = 'guest') {
  const notifications = loadNotifications(userId);
  notifications.forEach(n => n.unread = false);
  saveNotifications(notifications, userId);
  renderNotificationBadge(userId);
  renderNotificationList(userId);
}

export function renderNotificationBadge(userId = 'guest') {
  const badgeEl = document.getElementById('notifBadge');
  if (!badgeEl) return;
  const count = getUnreadCount(userId);
  badgeEl.textContent = count;
  badgeEl.style.display = count > 0 ? 'flex' : 'none';
}

export function renderNotificationList(userId = 'guest') {
  const container = document.getElementById('notifDropdownList');
  if (!container) return;

  const notifications = loadNotifications(userId);
  
  if (notifications.length === 0) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 0.8rem;">All caught up! No notifications.</div>`;
    return;
  }

  container.innerHTML = notifications.map(n => {
    const timeStr = new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isUnreadStyle = n.unread ? 'background: rgba(59, 130, 246, 0.04); font-weight: 600;' : '';
    
    // Choose icon based on type
    let icon = '🔔';
    if (n.type === 'job') icon = '💼';
    if (n.type === 'streak' || n.type === 'milestone') icon = '🔥';
    if (n.type === 'success') icon = '✅';
    if (n.type === 'error') icon = '⚠️';

    return `
      <div class="notif-item" style="padding: 12px 16px; border-bottom: 1px solid var(--border); transition: background 0.2s; ${isUnreadStyle}">
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <span style="font-size: 1.1rem; flex-shrink: 0; margin-top: 2px;">${icon}</span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 0.8rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px;">${n.title}</div>
            <div style="font-size: 0.72rem; color: var(--muted); line-height: 1.3;">${n.text}</div>
            <div style="font-size: 0.6rem; color: var(--muted); margin-top: 4px; font-family: var(--font-mono);">${timeStr}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function initNotificationCenter(userId = 'guest') {
  const trigger = document.getElementById('notifBellBtn');
  const panel = document.getElementById('notifDropdownPanel');
  
  if (trigger && panel) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = panel.style.display === 'block';
      panel.style.display = isActive ? 'none' : 'block';
      if (!isActive) {
        // Mark all as read when user opens the panel
        markAllAsRead(userId);
      }
    });

    document.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    panel.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  renderNotificationBadge(userId);
  renderNotificationList(userId);
}
