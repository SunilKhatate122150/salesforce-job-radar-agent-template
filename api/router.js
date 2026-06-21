import { applyRateLimit } from '../src/api/rateLimit.js';
import { parseJsonBody, sanitizeApiBody } from '../src/api/requestSanitizer.js';
import { unauthorizedResponse } from '../src/api/apiResponse.js';
import { getAuthenticatedUserId } from '../src/auth/session.js';
import { buildClientConfig, buildHealthPayload } from '../src/api/radarContract.js';

// Route helper dependencies
import { connectDB, isMongoConnected, buildConnectivityDetails } from '../src/routes/routeHelpers.js';

// Feature Routes
import { handleGoogleAuth } from '../src/routes/authRoutes.js';
import {
  handleJobs,
  handleJobsScan,
  handleJobsAnalytics,
  handleJobsList,
  handleJobStatusUpdate
} from '../src/routes/jobRoutes.js';
import {
  handleProfileData,
  handleSaveRetention,
  handleSaveProfile,
  handleProfileImport,
  handleRoadmap,
  handleProfileSyncCloud,
  handleParseResume,
  handleToggleBookmark,
  handleProfileMatch
} from '../src/routes/profileRoutes.js';
import {
  handleStudyHistory,
  handleStudySession,
  handleStudyStats,
  handleStudyTasks,
  handleToggleTask,
  handleStudyReset,
  handleStudyLeaderboard
} from '../src/routes/studyRoutes.js';
import { handleAiRequest } from '../src/routes/aiRoutes.js';
import { handleDashboardSummary, handleSummary } from '../src/routes/dashboardRoutes.js';
import { handleReleasesLatest, handleReleasesStudyActions } from '../src/routes/releaseRoutes.js';
import {
  handleChallenges,
  handleEvaluate,
  handleProgress,
  handleAttempt
} from '../src/routes/codePracticeRoutes.js';
import { handleGetSessions, handleSaveSession } from '../src/routes/mockInterviewRoutes.js';
import { handleKnowledge } from '../src/routes/knowledgeRoutes.js';

export default async function(req, res) {
  // CORS preflight handling for cross-origin requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  try {
    let { slug } = req.query || {};
    let path = '';
    if (slug) {
      path = Array.isArray(slug) ? slug.join('/') : slug;
    } else {
      path = (req.url || '').replace('/api/', '').split('?')[0];
    }
    path = path.replace(/^\/+/, '').replace(/\/+$/, '');

    if (!await applyRateLimit(req, res, path)) return;

    // Connect to database
    await connectDB();

    // GLOBAL BODY PARSER + SANITIZER
    if ((req.method === 'POST' || req.method === 'PATCH') && req.body) {
      req.body = typeof req.body === 'string' || Buffer.isBuffer(req.body)
        ? parseJsonBody(req.body)
        : sanitizeApiBody(req.body);
    }

    // 1. PUBLIC ENDPOINTS
    if (path === 'auth/google' && req.method === 'POST') {
      return await handleGoogleAuth(req, res);
    }

    if (path === 'code-practice/challenges' && req.method === 'GET') {
      return await handleChallenges(req, res);
    }

    if (path === 'health' && req.method === 'GET') {
      return res.status(200).json({
        ...buildHealthPayload({
          env: process.env,
          mongoConnected: isMongoConnected(),
          runtime: process.env.VERCEL ? 'vercel' : 'local'
        }),
        connectivity: await buildConnectivityDetails()
      });
    }

    if (path === 'client-config' && req.method === 'GET') {
      return res.status(200).json(buildClientConfig(process.env));
    }

    // --- REQUIRE AUTH FOR PRIVATE DATA ROUTES ---
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json(unauthorizedResponse());

    // 2. JOBS ENDPOINTS
    if (path === 'jobs') {
      return await handleJobs(req, res, userId);
    }
    if (path === 'jobs/scan' && req.method === 'POST') {
      return await handleJobsScan(req, res, userId);
    }
    if (path === 'jobs/analytics') {
      return await handleJobsAnalytics(req, res, userId);
    }
    if (path === 'jobs/list') {
      return await handleJobsList(req, res, userId);
    }
    const jobStatusRoute = path.match(/^jobs\/([^/]+)\/status$/);
    if (jobStatusRoute && req.method === 'PATCH') {
      const routeId = decodeURIComponent(jobStatusRoute[1] || '');
      return await handleJobStatusUpdate(req, res, userId, routeId);
    }
    if (path === 'jobs/apply' && req.method === 'POST') {
      return res.status(409).json({
        success: false,
        error: 'Auto Apply is only available from the local desktop server because it needs a browser session on this machine.'
      });
    }

    // 3. PROFILE ENDPOINTS
    if (path === 'profile/data') {
      return await handleProfileData(req, res, userId);
    }
    if (path === 'profile/save-retention' && req.method === 'POST') {
      return await handleSaveRetention(req, res, userId);
    }
    if (path === 'profile/save' && req.method === 'POST') {
      return await handleSaveProfile(req, res, userId);
    }
    if (path === 'profile/import' && req.method === 'POST') {
      return await handleProfileImport(req, res, userId);
    }
    if (path === 'profile/sync-cloud' && req.method === 'POST') {
      return await handleProfileSyncCloud(req, res, userId);
    }
    if (path === 'profile/parse-resume' && req.method === 'POST') {
      return await handleParseResume(req, res, userId);
    }
    if (path === 'profile/toggle-bookmark' && req.method === 'POST') {
      return await handleToggleBookmark(req, res, userId);
    }
    if (path === 'profile/match') {
      return await handleProfileMatch(req, res, userId);
    }
    if (path === 'roadmap') {
      return await handleRoadmap(req, res, userId);
    }

    // 4. STUDY ENDPOINTS
    if (path === 'study/history') {
      return await handleStudyHistory(req, res, userId);
    }
    if (path === 'study/session' && req.method === 'POST') {
      return await handleStudySession(req, res, userId);
    }
    if (path === 'study/stats') {
      return await handleStudyStats(req, res, userId);
    }
    if (path === 'study/tasks') {
      return await handleStudyTasks(req, res, userId);
    }
    if (path === 'study/toggle-task' && req.method === 'POST') {
      return await handleToggleTask(req, res, userId);
    }
    if (path === 'study/reset' && req.method === 'POST') {
      return await handleStudyReset(req, res, userId);
    }
    if (path === 'study/leaderboard') {
      return await handleStudyLeaderboard(req, res, userId);
    }

    // 5. DASHBOARD & SUMMARY ENDPOINTS
    if (path === 'dashboard/summary' && req.method === 'GET') {
      return await handleDashboardSummary(req, res, userId);
    }
    if (path === 'summary/daily' || path === 'summary/all') {
      return await handleSummary(req, res, userId, path);
    }

    // 6. RELEASES ENDPOINTS
    if (path === 'releases/latest' || path === 'releases/current') {
      return await handleReleasesLatest(req, res, userId);
    }
    if (path === 'releases/study-actions' && req.method === 'GET') {
      return await handleReleasesStudyActions(req, res, userId);
    }

    // 7. CODE PRACTICE ENDPOINTS
    if (path === 'code-practice/evaluate' && req.method === 'POST') {
      return await handleEvaluate(req, res);
    }
    if (path === 'code-practice/progress' && req.method === 'GET') {
      return await handleProgress(req, res, userId);
    }
    if (path === 'code-practice/attempt' && req.method === 'POST') {
      return await handleAttempt(req, res, userId);
    }

    // 8. MOCK INTERVIEW ENDPOINTS
    if (path === 'mock-interview/session' && req.method === 'GET') {
      return await handleGetSessions(req, res, userId);
    }
    if (path === 'mock-interview/session' && req.method === 'POST') {
      return await handleSaveSession(req, res, userId);
    }

    // 9. AI ENDPOINTS
    if (path.startsWith('ai/') && req.method === 'POST') {
      const kind = path.replace('ai/', '');
      return await handleAiRequest(req, res, userId, kind);
    }

    // 10. KNOWLEDGE & TOPICS
    if (path.startsWith('knowledge/')) {
      return await handleKnowledge(req, res, path);
    }

    return res.status(404).json({ error: 'Route not found' });

  } catch (e) {
    console.error('Hybrid API Error:', e);
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    const payload = {
      success: false, 
      error: isProduction ? 'An internal error occurred. Please try again later.' : e.message,
      hint: isProduction ? undefined : 'This error is coming from the Vercel Serverless Function.'
    };
    if (!isProduction) payload.stack = e.stack;
    return res.status(500).json(payload);
  }
}
