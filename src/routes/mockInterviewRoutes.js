// Mock Interview Routes (Vite)
import { UserProfile } from '../models/models.js';
import { TursoDB } from '../db/turso_driver.js';
import { createMockInterviewSession } from '../services/dashboardSummary.js';
import {
  loadHybridProfile,
  safeMongoWrite,
  safeTursoWrite,
  readBody
} from './routeHelpers.js';

export async function handleGetSessions(req, res, userId) {
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'mock-interview/session');
  const sessions = Array.isArray(loadedProfile?.mockInterviewSessions) ? loadedProfile.mockInterviewSessions : [];
  return res.status(200).json({ success: true, sessions: sessions.slice(0, 50) });
}

export async function handleSaveSession(req, res, userId) {
  const body = readBody(req);
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'mock-interview/session');
  const profile = loadedProfile || {};
  const session = createMockInterviewSession(body, userId);
  const mockInterviewSessions = [session, ...(profile.mockInterviewSessions || [])].slice(0, 50);
  const nextProfile = { ...profile, userId, mockInterviewSessions, updatedAt: new Date() };
  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('mock-interview/session', () => UserProfile.findOneAndUpdate(
      { userId },
      { userId, mockInterviewSessions, updatedAt: new Date() },
      { upsert: true, new: true }
    )),
    safeTursoWrite('mock-interview/session', () => TursoDB.saveProfile(userId, nextProfile))
  ]);
  if (!mongoStored && !tursoStored) {
    return res.status(503).json({ success: false, error: 'No profile storage backend is currently writable.' });
  }
  return res.status(200).json({ success: true, session, sessions: mockInterviewSessions, storage: { mongo: mongoStored, turso: tursoStored } });
}
