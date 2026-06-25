// Study Streak Engine (v1340)

export function getStreakKey(userId = 'guest') {
  return `sfjr:${userId}:streak`;
}

export function loadStreak(userId = 'guest') {
  try {
    const data = localStorage.getItem(getStreakKey(userId));
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[STREAK] Failed to load streak from localStorage', e);
  }
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: '',
    totalDaysStudied: 0,
    weeklyGoal: 5
  };
}

export function saveStreak(streak, userId = 'guest') {
  try {
    localStorage.setItem(getStreakKey(userId), JSON.stringify(streak));
  } catch (e) {
    console.error('[STREAK] Failed to save streak to localStorage', e);
  }
}

export function checkAndUpdateStreak(userId = 'guest') {
  const streak = loadStreak(userId);
  const now = new Date();
  
  // Format dates: YYYY-MM-DD
  const today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = yesterdayDate.getFullYear() + '-' + String(yesterdayDate.getMonth()+1).padStart(2,'0') + '-' + String(yesterdayDate.getDate()).padStart(2,'0');

  if (streak.lastStudyDate === today) {
    return streak; // Already studied today
  }

  if (streak.lastStudyDate === yesterday) {
    streak.currentStreak += 1;
  } else {
    // If not studied yesterday, streak is broken, reset to 1
    streak.currentStreak = 1;
  }

  if (streak.currentStreak > streak.longestStreak) {
    streak.longestStreak = streak.currentStreak;
  }

  streak.lastStudyDate = today;
  streak.totalDaysStudied += 1;
  
  saveStreak(streak, userId);

  // Trigger milestone alerts/toasts
  const milestones = [7, 14, 30, 60, 100];
  if (milestones.includes(streak.currentStreak)) {
    setTimeout(() => {
      if (typeof window.showToast === 'function') {
        window.showToast(`🎉 Incredible! You've reached a ${streak.currentStreak}-day Study Streak! 🔥`, false);
      }
    }, 1000);
  }

  return streak;
}
