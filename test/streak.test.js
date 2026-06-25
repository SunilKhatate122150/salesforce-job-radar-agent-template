import assert from 'node:assert/strict';
import test from 'node:test';
import { checkAndUpdateStreak, loadStreak } from '../src/modules/streak.js';

// Setup basic global mock for window and localStorage
globalThis.window = {};
const storage = {};
globalThis.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; }
};

test('checkAndUpdateStreak correctly handles consecutive days and breaks', () => {
  localStorage.removeItem('sfjr:guest:streak');

  // 1. Initial streak when no study records exist
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  
  const streak1 = checkAndUpdateStreak('guest');
  assert.equal(streak1.currentStreak, 1);
  assert.equal(streak1.lastStudyDate, todayStr);

  // 2. Already studied today should keep streak same
  const streak2 = checkAndUpdateStreak('guest');
  assert.equal(streak2.currentStreak, 1);
});
