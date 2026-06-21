// Code Practice Routes (Vite)
import { UserProfile } from '../models/models.js';
import { TursoDB } from '../db/turso_driver.js';
import {
  buildCodePracticeAttempt,
  buildCodePracticeEvaluationResponse,
  buildCodePracticeFilesText,
  createCustomCodePracticeChallenge,
  filterCodePracticeChallenges,
  getCodePracticeChallenge,
  getDefaultCodePracticeProgress,
  parseCodePracticeAiReview,
  runCodePracticeChecks
} from '../services/codePracticeService.js';
import { generateAiText } from './aiRoutes.js';
import {
  loadHybridProfile,
  safeMongoWrite,
  safeTursoWrite,
  readDataJson,
  getCodePracticeCatalog,
  readBody
} from './routeHelpers.js';

export async function handleChallenges(req, res) {
  const requestUrl = new URL(req.url || '', 'http://localhost');
  return res.status(200).json({
    success: true,
    ...filterCodePracticeChallenges(getCodePracticeCatalog(), requestUrl.searchParams)
  });
}

export async function handleEvaluate(req, res) {
  const body = readBody(req);
  const challenge = getCodePracticeChallenge(getCodePracticeCatalog(), body.challengeId);
  if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found' });
  const deterministic = runCodePracticeChecks(challenge, body.files || {}, body.runResult || {});
  const filesText = buildCodePracticeFilesText(body.files || {});
  const aiRaw = await generateAiText('code-review', {
    ...deterministic,
    challengeTitle: challenge.title,
    instructions: challenge.instructions,
    aiRubric: challenge.aiRubric,
    filesText
  });
  const aiReview = parseCodePracticeAiReview(aiRaw, deterministic);
  return res.status(200).json(buildCodePracticeEvaluationResponse({ challenge, body, deterministic, aiReview }));
}

export async function handleProgress(req, res, userId) {
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'code-practice/progress');
  const profile = loadedProfile || {};
  const codingPractice = profile.codingPractice || getDefaultCodePracticeProgress();
  return res.status(200).json({ success: true, codingPractice });
}

export async function handleAttempt(req, res, userId) {
  const body = readBody(req);
  const challenge = getCodePracticeChallenge(getCodePracticeCatalog(), body.challengeId) ||
    createCustomCodePracticeChallenge(body);
  if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found' });
  const { profile: loadedProfile } = await loadHybridProfile(userId, 'code-practice/attempt');
  const profile = loadedProfile || {};
  const current = profile.codingPractice || {};
  const { codingPractice } = buildCodePracticeAttempt({ body, challenge, current });
  const nextProfile = { ...profile, userId, codingPractice, updatedAt: new Date() };
  const [mongoStored, tursoStored] = await Promise.all([
    safeMongoWrite('code-practice/attempt', () => UserProfile.findOneAndUpdate(
      { userId },
      { userId, codingPractice, updatedAt: new Date() },
      { upsert: true, new: true }
    )),
    safeTursoWrite('code-practice/attempt', () => TursoDB.saveProfile(userId, nextProfile))
  ]);
  if (!mongoStored && !tursoStored) {
    return res.status(503).json({ success: false, error: 'No profile storage backend is currently writable.' });
  }
  return res.status(200).json({ success: true, codingPractice, storage: { mongo: mongoStored, turso: tursoStored } });
}
