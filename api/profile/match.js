import mongoose from 'mongoose';
import { UserProfile, JobRecord } from '../../src/models/models.js';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

let cachedDb = null;
async function connectDB() {
  if (cachedDb) return cachedDb;
  return mongoose.connect(process.env.MONGODB_URI).then(db => {
    cachedDb = db;
    return db;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const userId = ticket.getPayload()['sub'];

    await connectDB();

    const profile = await UserProfile.findOne({ userId }).lean();
    if (!profile) {
      return res.status(200).json({ hasProfile: false, match: null });
    }

    const userSkillsLower = (profile.skills || []).map(s => s.toLowerCase());

    // Get all jobs to analyze skill demand
    const jobs = await JobRecord.find({ userId }).lean();

    // Count how often each skill appears in job listings
    const demandMap = {};
    jobs.forEach(job => {
      const jobText = `${job.title || ''} ${job.company || ''}`.toLowerCase();
      userSkillsLower.forEach(skill => {
        if (jobText.includes(skill)) {
          demandMap[skill] = (demandMap[skill] || 0) + 1;
        }
      });
    });

    // Skills user HAS that market wants (sorted by demand)
    const strengths = Object.entries(demandMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, demandCount: count }));

    // Missing skills (from AI analysis) with market demand check
    const gaps = (profile.missingSkills || []).map(skill => {
      let demandCount = 0;
      jobs.forEach(job => {
        const jobText = `${job.title || ''} ${job.company || ''}`.toLowerCase();
        if (jobText.includes(skill.toLowerCase())) demandCount++;
      });
      return { skill, demandCount };
    }).sort((a, b) => b.demandCount - a.demandCount);

    // Companies hiring for user's skill set
    const companyMap = {};
    jobs.forEach(job => {
      if (job.company) {
        companyMap[job.company] = (companyMap[job.company] || 0) + 1;
      }
    });
    const topCompanies = Object.entries(companyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([company, count]) => ({ company, jobCount: count }));

    res.status(200).json({
      hasProfile: true,
      match: {
        strengths,
        gaps,
        topCompanies,
        totalJobsAnalyzed: jobs.length,
        profileSkillCount: profile.skills.length,
        certCount: (profile.certifications || []).length
      }
    });
  } catch (e) {
    console.error('Profile Match Error:', e.message);
    res.status(500).json({ error: 'Failed to generate match data', details: e.message });
  }
}
