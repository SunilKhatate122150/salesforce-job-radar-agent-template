// Study Routes (Vite)
import { User, UserProfile, StudySession, TaskStatus } from '../models/models.js';
import { TursoDB } from '../db/turso_driver.js';
import {
  buildStudyStats,
  mergeCompletedTasks,
  mergeStudyHistory,
  normalizeStudyTaskIndex
} from '../services/studyService.js';
import {
  safeTursoRead,
  safeMongoRead,
  safeMongoWrite,
  safeTursoWrite,
  readBody
} from './routeHelpers.js';

export async function handleStudyHistory(req, res, userId) {
  const tursoSessions = await safeTursoRead('study/history', () => TursoDB.getStudyHistory(userId), []);
  const mongoSessions = await safeMongoRead(
    'study/history',
    () => StudySession.find({ userId }).sort({ startTime: -1 }).limit(100).lean(),
    []
  );
  const combined = mergeStudyHistory(tursoSessions, mongoSessions, 100);
  console.log(`[STUDY] History Fetch -> Turso: ${tursoSessions.length}, Mongo: ${mongoSessions.length}`);
  return res.status(200).json(combined);
}

export async function handleStudySession(req, res, userId) {
  console.log(`[STUDY] Saving session to hybrid stores for ${userId}`);
  const sessionPayload = { ...readBody(req), userId };
  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('study/session', async () => {
      const session = new StudySession(sessionPayload);
      await session.save();
    }),
    safeTursoWrite('study/session', () => TursoDB.saveStudySession(userId, sessionPayload))
  ]);
  if (!mongoStored && !tursoStored) {
    return res.status(503).json({ success: false, error: 'No study storage backend is currently writable.' });
  }
  return res.status(200).json({ success: true, storage: { mongo: mongoStored, turso: tursoStored } });
}

export async function handleStudyStats(req, res, userId) {
  const [tursoSessions, mongoSessions] = await Promise.all([
    safeTursoRead('study/stats turso', () => TursoDB.getFullHistory(userId), []),
    safeMongoRead('study/stats mongo', () => StudySession.find({ userId }).lean(), [])
  ]);
  return res.status(200).json(buildStudyStats([...tursoSessions, ...mongoSessions]));
}

export async function handleStudyTasks(req, res, userId) {
  const tursoProfile = await safeTursoRead('study/tasks profile', () => TursoDB.getProfile(userId), null);
  const mongoTasks = await safeMongoRead('study/tasks mongo', () => TaskStatus.find({ userId, completed: true }).lean(), []);
  const combinedTasks = mergeCompletedTasks({ tursoProfile, mongoTasks });
  console.log(`[TASKS] Hybrid Loading: ${combinedTasks.length} total completed tasks`);
  return res.status(200).json({ completedTasks: combinedTasks });
}

export async function handleToggleTask(req, res, userId) {
  const body = readBody(req);
  const taskIndex = normalizeStudyTaskIndex(body);
  if (taskIndex === null) {
    return res.status(400).json({ success: false, error: 'index or taskId is required' });
  }

  const existing = await safeMongoRead('study/toggle-task existing', () => TaskStatus.findOne({ userId, index: taskIndex }).lean(), null);
  const nextCompleted = typeof body.completed === 'boolean' ? body.completed : !existing?.completed;
  console.log(`[TASK] Toggling task ${taskIndex} in hybrid stores for ${userId} -> ${nextCompleted}`);

  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('study/toggle-task', () => TaskStatus.findOneAndUpdate(
      { userId, index: taskIndex },
      { userId, index: taskIndex, completed: nextCompleted, updatedAt: new Date() },
      { upsert: true, new: true }
    )),
    safeTursoWrite('study/toggle-task', () => TursoDB.toggleTask(userId, taskIndex, nextCompleted))
  ]);
  if (!mongoStored && !tursoStored) {
    return res.status(503).json({ success: false, error: 'No task storage backend is currently writable.' });
  }

  const tursoProfile = await safeTursoRead('study/toggle-task profile', () => TursoDB.getProfile(userId), null);
  const mongoTasks = await safeMongoRead('study/toggle-task tasks', () => TaskStatus.find({ userId, completed: true }).lean(), []);
  const completedTasks = mergeCompletedTasks({ tursoProfile, mongoTasks });
  return res.status(200).json({ success: true, completedTasks, storage: { mongo: mongoStored, turso: tursoStored } });
}

export async function handleStudyReset(req, res, userId) {
  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('study/reset', async () => {
      await StudySession.deleteMany({ userId });
      await TaskStatus.deleteMany({ userId });
      await UserProfile.findOneAndUpdate(
        { userId },
        { userId, studyPlanTopics: [], studyStreak: { current: 0, best: 0, lastDate: '' }, updatedAt: new Date() },
        { upsert: true }
      );
    }),
    safeTursoWrite('study/reset', () => TursoDB.resetStudyData(userId))
  ]);
  return res.status(200).json({ success: true, completedTasks: [], sessions: [], storage: { mongo: mongoStored, turso: tursoStored } });
}

export async function handleStudyLeaderboard(req, res, userId) {
  const rows = await safeMongoRead('study/leaderboard rows', () => StudySession.aggregate([
    { $match: { userId } },
    { $group: { _id: '$userId', totalSeconds: { $sum: '$duration' }, sessions: { $sum: 1 }, lastStudy: { $max: '$endTime' } } }
  ]), []);
  const users = await safeMongoRead('study/leaderboard users', () => User.find({ googleId: userId }).lean(), []);
  const userMap = new Map(users.map(u => [u.googleId, u]));
  const leaderboard = rows.map(row => {
    const user = userMap.get(row._id) || {};
    return {
      userId: row._id,
      name: user.name || 'Anonymous Scholar',
      picture: user.picture || '',
      totalHours: Math.round((row.totalSeconds || 0) / 36) / 100,
      sessions: row.sessions || 0,
      lastStudy: row.lastStudy
    };
  });
  return res.status(200).json({ success: true, leaderboard });
}
