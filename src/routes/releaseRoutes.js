// Release Routes (Vite)
import { UserProfile } from '../models/models.js';
import { TursoDB } from '../db/turso_driver.js';
import { readReleaseCenterPayload, selectPersonalizedReleaseItems } from '../releases/releaseCenter.js';
import { buildPremiumRoadmap } from '../services/profileService.js';
import { buildReleaseStudyActions } from '../services/dashboardSummary.js';
import {
  loadHybridProfile,
  safeMongoWrite,
  safeTursoWrite,
  readDataJson
} from './routeHelpers.js';

export async function handleReleasesLatest(req, res, userId) {
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'releases/current');
  const profile = loadedProfile || {};
  const intelligence = buildPremiumRoadmap(profile, readDataJson);
  const fallbackReleases = readDataJson('salesforce-releases.json', { activeRelease: {}, items: [] });
  const allReleases = await readReleaseCenterPayload(fallbackReleases);
  return res.status(200).json({
    success: true,
    sourceMode: allReleases.sourceMode || 'bundled-fallback',
    generatedAt: allReleases.generatedAt || null,
    activeRelease: allReleases.activeRelease || {},
    items: allReleases.items || [],
    personalizedItems: selectPersonalizedReleaseItems(allReleases.items || [], intelligence),
    experienceYears: intelligence.experienceYears,
    designation: intelligence.designation
  });
}

export async function handleReleasesStudyActions(req, res, userId) {
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'releases/study-actions');
  const intelligence = buildPremiumRoadmap(loadedProfile || {}, readDataJson);
  const fallbackReleases = readDataJson('salesforce-releases.json', { activeRelease: {}, items: [] });
  const allReleases = await readReleaseCenterPayload(fallbackReleases);
  const payload = {
    ...allReleases,
    personalizedItems: selectPersonalizedReleaseItems(allReleases.items || [], intelligence)
  };
  const studyActions = buildReleaseStudyActions(payload);
  await Promise.all([
    safeMongoWrite('releases/study-actions', () => UserProfile.findOneAndUpdate(
      { userId },
      { userId, releaseStudyActions: studyActions, updatedAt: new Date() },
      { upsert: true, new: true }
    )),
    safeTursoWrite('releases/study-actions', async () => {
      const { profile } = await loadHybridProfile(userId, 'releases/study-actions-write');
      return TursoDB.saveProfile(userId, { ...(profile || {}), userId, releaseStudyActions: studyActions, updatedAt: new Date() });
    })
  ]);
  return res.status(200).json({ success: true, generatedAt: new Date().toISOString(), studyActions });
}
