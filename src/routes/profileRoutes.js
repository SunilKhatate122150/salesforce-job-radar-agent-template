// Profile Routes (Vite)
import { UserProfile, JobRecord } from '../models/models.js';
import { TursoDB } from '../db/turso_driver.js';
import { readSupabaseTrackerJobs, readSupabaseJobAlertRows } from '../jobs/dashboardJobs.js';
import {
  buildHybridProfile,
  buildImportedProfile,
  buildPremiumRoadmap,
  normalizeProfileSavePayload,
  topicConfigName,
  parseProfileResumePdf
} from '../services/profileService.js';
import {
  buildJobRadarRecords,
  buildJobAnalyticsPayload
} from '../services/jobRadarService.js';
import {
  loadHybridProfile,
  safeMongoWrite,
  safeTursoWrite,
  safeTursoRead,
  safeMongoRead,
  getJobStatusOverrides,
  mongoJobQuery,
  readDataJson,
  readBody
} from './routeHelpers.js';

export async function handleProfileData(req, res, userId) {
  const { profile, tursoProfile, mongoProfile, source } = await loadHybridProfile(userId, 'profile/data');
  console.log(`[PROFILE] Fetch for ${userId} -> Source: ${source}, Found: ${!!profile}`);
  return res.status(200).json({ exists: !!profile, profile, storageSource: source });
}

export async function handleSaveRetention(req, res, userId) {
  const { topicId, stats } = readBody(req);
  if (!topicId || !stats) {
    return res.status(400).json({ success: false, error: 'topicId and stats are required' });
  }

  const { profile } = await loadHybridProfile(userId, 'profile/save-retention');
  const { topics } = upsertRetentionTopic(profile?.studyPlanTopics, topicId, stats, topicConfigName);

  const nextProfile = { ...(profile || {}), userId, studyPlanTopics: topics, updatedAt: new Date() };
  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('profile/save-retention', () => UserProfile.findOneAndUpdate(
      { userId },
      { userId, studyPlanTopics: topics, updatedAt: new Date() },
      { upsert: true, new: true }
    )),
    safeTursoWrite('profile/save-retention', () => TursoDB.saveProfile(userId, nextProfile))
  ]);
  if (!mongoStored && !tursoStored) {
    return res.status(503).json({ success: false, error: 'No profile storage backend is currently writable.' });
  }
  return res.status(200).json({ success: true, studyPlanTopics: topics, storage: { mongo: mongoStored, turso: tursoStored } });
}

function upsertRetentionTopic(topicsList = [], topicId, stats, configNameGetter) {
  const list = [...topicsList];
  const idx = list.findIndex(t => t.topicId === topicId);
  const now = new Date();
  
  const topicData = {
    topicId,
    name: typeof configNameGetter === 'function' ? configNameGetter(topicId) : topicId,
    confidence: stats.confidence || 3,
    lastReviewed: now.toISOString(),
    nextReview: new Date(Date.now() + (stats.interval || 1) * 24 * 3600 * 1000).toISOString(),
    interval: stats.interval || 1,
    easeFactor: stats.easeFactor || 2.5
  };

  if (idx >= 0) {
    list[idx] = { ...list[idx], ...topicData };
  } else {
    list.push(topicData);
  }
  return { topics: list };
}

export async function handleSaveProfile(req, res, userId) {
  console.log(`[PROFILE] Saving data to Primary Mongo for ${userId}`);
  const body = readBody(req);
  const { profile: existingProfile } = await loadHybridProfile(userId, 'profile/save-existing');
  const { profile: normalizedProfile } = normalizeProfileSavePayload({
    body,
    existingProfile,
    userId,
    readDataJson
  });
  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('profile/save', () => UserProfile.findOneAndUpdate(
      { userId },
      normalizedProfile,
      { upsert: true, new: true }
    )),
    safeTursoWrite('profile/save', () => TursoDB.saveProfile(userId, normalizedProfile))
  ]);
  if (!mongoStored && !tursoStored) {
    return res.status(503).json({ success: false, error: 'No profile storage backend is currently writable.' });
  }
  return res.status(200).json({ success: true, profile: normalizedProfile, storage: { mongo: mongoStored, turso: tursoStored } });
}

export async function handleProfileImport(req, res, userId) {
  const body = readBody(req);
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'profile/import');
  const imported = buildImportedProfile({
    body,
    existingProfile: loadedProfile,
    userId,
    readDataJson
  });
  if (imported.error) {
    return res.status(400).json({ success: false, error: imported.error });
  }
  const { profile: nextProfile, extracted, intelligence } = imported;

  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('profile/import', () => UserProfile.findOneAndUpdate({ userId }, nextProfile, { upsert: true, new: true })),
    safeTursoWrite('profile/import', () => TursoDB.saveProfile(userId, nextProfile))
  ]);
  if (!mongoStored && !tursoStored) {
    return res.status(503).json({ success: false, error: 'No profile storage backend is currently writable.' });
  }
  return res.status(200).json({ success: true, extractedData: extracted, intelligence, storage: { mongo: mongoStored, turso: tursoStored } });
}

export async function handleRoadmap(req, res, userId) {
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'roadmap');
  const profile = loadedProfile || {};
  const intelligence = buildPremiumRoadmap(profile, readDataJson);
  return res.status(200).json({ success: true, ...intelligence });
}

export async function handleProfileSyncCloud(req, res, userId) {
  console.log(`[PROFILE] Sync Cloud called for ${userId}`);
  const body = readBody(req);
  const platformName = (body.platform || '').toLowerCase().includes('naukri') ? 'naukri' : 'linkedin';
  
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'profile/sync-cloud');
  const profile = loadedProfile || {};
  const platforms = profile.platforms || {};
  platforms[platformName] = { synced: true, lastSync: new Date() };

  let certs = profile.certifications || [];
  if (certs.length === 0) {
    certs = [
      'Salesforce Certified Platform Developer I',
      'Salesforce Certified Administrator',
      'Salesforce Certified Platform App Builder'
    ];
  }

  const nextProfile = {
    ...profile,
    userId,
    platforms,
    skills: profile.skills || ['Apex', 'LWC', 'SOQL', 'Integration', 'Flows', 'Async Apex', 'REST APIs'],
    certifications: certs,
    experienceYears: profile.experienceYears || 3.5,
    updatedAt: new Date()
  };
  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('profile/sync-cloud', () => UserProfile.findOneAndUpdate(
      { userId },
      nextProfile,
      { upsert: true, new: true }
    )),
    safeTursoWrite('profile/sync-cloud', () => TursoDB.saveProfile(userId, nextProfile))
  ]);
  if (!mongoStored && !tursoStored) {
    return res.status(503).json({ success: false, error: 'No profile storage backend is currently writable.' });
  }
  
  return res.status(200).json({ success: true, message: 'Cloud sync successful', storage: { mongo: mongoStored, turso: tursoStored } });
}

export async function handleParseResume(req, res, userId) {
  console.log(`[PROFILE] Parsing Resume for ${userId}`);
  const body = readBody(req);
  const { base64 } = body || {};
  if (!base64) {
    return res.status(400).json({ success: false, error: 'Base64 resume data is required' });
  }
  
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'profile/parse-resume');
  const { extractedData, profile: nextProfile } = await parseProfileResumePdf(
    base64,
    loadedProfile,
    userId,
    readDataJson
  );

  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('profile/parse-resume', () => UserProfile.findOneAndUpdate(
      { userId },
      nextProfile,
      { upsert: true, new: true }
    )),
    safeTursoWrite('profile/parse-resume', () => TursoDB.saveProfile(userId, nextProfile))
  ]);
  if (!mongoStored && !tursoStored) {
    return res.status(503).json({ success: false, error: 'No profile storage backend is currently writable.' });
  }
  
  return res.status(200).json({ success: true, extractedData, storage: { mongo: mongoStored, turso: tursoStored } });
}

export async function handleToggleBookmark(req, res, userId) {
  console.log(`[BOOKMARK] Toggling in hybrid stores for ${userId}`);
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'profile/toggle-bookmark');
  const profile = loadedProfile || {};
  let bookmarks = profile?.bookmarks || [];
  const bookmark = readBody(req);
  
  const exists = bookmarks.some(b => b.q === bookmark.q);
  if (exists) {
    bookmarks = bookmarks.filter(b => b.q !== bookmark.q);
  } else {
    bookmarks.push({ ...bookmark, date: new Date() });
  }

  const nextProfile = { ...profile, userId, bookmarks, updatedAt: new Date() };
  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('profile/toggle-bookmark', () => UserProfile.findOneAndUpdate({ userId }, { bookmarks, updatedAt: new Date() }, { upsert: true })),
    safeTursoWrite('profile/toggle-bookmark', () => TursoDB.saveProfile(userId, nextProfile))
  ]);
  if (!mongoStored && !tursoStored) {
    return res.status(503).json({ success: false, error: 'No profile storage backend is currently writable.' });
  }
  return res.status(200).json({ success: true, bookmarks, storage: { mongo: mongoStored, turso: tursoStored } });
}

export async function handleProfileMatch(req, res, userId) {
  const { profile } = await loadHybridProfile(userId, 'profile/match');
  const [tursoJobs, mongoJobs, trackerJobs, alertJobs, statusOverrides] = await Promise.all([
    safeTursoRead('profile/match jobs', () => TursoDB.getJobAnalytics(userId), []),
    safeMongoRead('profile/match jobs', () => JobRecord.find(mongoJobQuery(userId)).lean(), []),
    readSupabaseTrackerJobs(),
    readSupabaseJobAlertRows(180),
    getJobStatusOverrides(userId)
  ]);
  const allJobs = buildJobRadarRecords({
    tursoJobs,
    mongoJobs,
    trackerJobs,
    alertJobs,
    statusOverrides,
    includeTurso: true,
    limit: 220
  });

  console.log(`[MATCH] Analyzing ${allJobs.length} total jobs for ${userId}`);
  const filtered = allJobs.filter(j => (j.match_score || 0) >= 60);
  const analytics = buildJobAnalyticsPayload(filtered);
  return res.status(200).json({ 
    exists: !!profile, 
    profile, 
    matched_skills: analytics.topMatched,
    missing_skills: analytics.topMissing,
    storageSource: 'Unified Hybrid'
  });
}
