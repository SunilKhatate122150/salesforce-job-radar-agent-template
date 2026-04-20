import { UserProfile, JobRecord, StudySession } from '../src/models/models.js';
import mongoose from 'mongoose';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

let cachedDb = null;
async function connectDB() {
  if (cachedDb) return cachedDb;
  const db = await mongoose.connect(process.env.MONGODB_URI);
  cachedDb = db;
  return db;
}

async function getUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    return ticket.getPayload()['sub'];
  } catch (e) {
    return null;
  }
}

export default async function(req, res) {
  let { slug } = req.query;
  let path = '';
  if (slug && Array.isArray(slug)) {
    path = slug.join('/');
  } else {
    path = req.url.replace('/api/', '').split('?')[0];
  }
  
  await connectDB();

  try {
    // 1. AUTH ENDPOINT
    if (path === 'auth/google' && req.method === 'POST') {
      const { token } = req.body;
      const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      return res.status(200).json({ success: true, user: { name: payload.name, email: payload.email, picture: payload.picture } });
    }

    // --- REQUIRE AUTH FOR ALL OTHER ROUTES ---
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // 2. PROFILE ENDPOINTS
    if (path === 'profile/data') {
      const profile = await UserProfile.findOne({ userId }).lean();
      return res.status(200).json({ exists: !!profile, profile });
    }
    if (path === 'profile/save' && req.method === 'POST') {
      const result = await UserProfile.findOneAndUpdate({ userId }, { $set: { ...req.body, lastUpdated: new Date() } }, { upsert: true, new: true });
      return res.status(200).json({ success: true, profile: result });
    }
    if (path === 'profile/match') {
      const profile = await UserProfile.findOne({ userId }).lean();
      const latestJobs = await JobRecord.find({}).sort({ fetched_at: -1 }).limit(50).lean();
      const filtered = latestJobs.filter(j => (j.match_score || 0) >= 60);
      const topMatchedSkills = {};
      const topMissingSkills = {};
      filtered.forEach(j => {
        if (j.matched_skills) j.matched_skills.forEach(s => topMatchedSkills[s] = (topMatchedSkills[s] || 0) + 1);
        if (j.missing_skills) j.missing_skills.forEach(s => topMissingSkills[s] = (topMissingSkills[s] || 0) + 1);
      });
      const sortSkills = (obj) => Object.entries(obj).sort((a,b) => b[1] - a[1]).slice(0, 10).map(([k,v]) => ({ _id: k, count: v }));
      return res.status(200).json({ exists: !!profile, profile, matched_skills: sortSkills(topMatchedSkills), missing_skills: sortSkills(topMissingSkills) });
    }

    // 3. STUDY ENDPOINTS
    if (path === 'study/history') {
      const sessions = await StudySession.find({ userId }).sort({ startTime: -1 }).limit(100).lean();
      return res.status(200).json(sessions);
    }
    if (path === 'study/session' && req.method === 'POST') {
      const newSession = new StudySession({ ...req.body, userId });
      await newSession.save();
      return res.status(200).json({ success: true });
    }
    if (path === 'study/tasks') {
      const profile = await UserProfile.findOne({ userId }).lean();
      return res.status(200).json({ completedTasks: profile?.completedTasks || [] });
    }
    if (path === 'study/toggle-task' && req.method === 'POST') {
      const { taskId, completed } = req.body;
      const op = completed ? '$addToSet' : '$pull';
      await UserProfile.findOneAndUpdate({ userId }, { [op]: { completedTasks: taskId } }, { upsert: true });
      return res.status(200).json({ success: true });
    }
    if (path === 'study/leaderboard') {
      const leaderboard = await StudySession.aggregate([{ $group: { _id: "$userId", totalSeconds: { $sum: "$duration" }, sessions: { $count: {} } } }, { $sort: { totalSeconds: -1 } }, { $limit: 10 }]);
      return res.status(200).json(leaderboard);
    }

    // 4. SUMMARY ENDPOINTS
    if (path === 'summary/daily' || path === 'summary/all') {
      const sessions = await StudySession.find({ userId }).sort({ startTime: -1 }).limit(100).lean();
      const todayStr = new Date().toISOString().split('T')[0];
      const todaySessions = sessions.filter(s => s.date === todayStr);
      const totalSec = todaySessions.reduce((acc, s) => acc + (s.duration || 0), 0);
      const summary = {
        date: todayStr,
        study: { totalSeconds: totalSec, topTopic: todaySessions[0]?.topicName || 'None' },
        jobs: { newCount: 0, topMatches: [] },
        history: sessions.slice(0, 5) // For 'all' endpoint compatibility
      };
      return res.status(200).json(path === 'summary/all' ? [summary] : summary);
    }

    // 5. JOBS ENDPOINTS
    if (path === 'jobs') {
      const jobs = await JobRecord.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
      return res.status(200).json({ records: jobs });
    }
    if (path === 'jobs/analytics') {
      const latestJobs = await JobRecord.find({}).sort({ fetched_at: -1 }).limit(200).lean();
      // Simple aggregation for analytics
      return res.status(200).json({ total: latestJobs.length, matches: latestJobs.filter(j => j.match_score > 70).length });
    }
    if (path === 'jobs/status') {
      return res.status(200).json({ status: 'active', lastScan: new Date() });
    }

    // 6. AUTOMATION (Local only info)
    if (path === 'profile/sync' || path === 'jobs/scan' || path === 'jobs/apply') {
      return res.status(200).json({ success: false, error: 'This action must be performed via the local agent. Please ensure your local server is running at http://localhost:3000' });
    }

    return res.status(404).json({ error: `Path not found: ${path}` });
  } catch (err) {
    console.error('Master API Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
