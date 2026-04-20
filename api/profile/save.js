import mongoose from 'mongoose';
import { UserProfile } from '../../src/models/models.js';
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
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const userId = ticket.getPayload()['sub'];

    await connectDB();

    const {
      platform,
      skills = [],
      experienceYears,
      currentRole,
      targetRole,
      certifications = [],
      missingSkills = [],
      studyPlan,
      studyPlanTopics = []
    } = req.body;

    // Fetch existing profile for merging
    let existing = await UserProfile.findOne({ userId }).lean();

    // Merge skills and certifications from both platforms
    let mergedSkills = existing ? [...new Set([...existing.skills, ...skills])] : skills;
    let mergedCerts = existing ? [...new Set([...existing.certifications, ...certifications])] : certifications;
    let mergedMissing = existing ? [...new Set([...existing.missingSkills, ...missingSkills])] : missingSkills;

    // Build raw extraction log for audit
    let rawExtraction = existing?.rawExtraction || {};
    if (platform === 'LinkedIn') {
      rawExtraction.linkedinSkills = skills;
      rawExtraction.linkedinCerts = certifications;
    } else if (platform === 'Naukri') {
      rawExtraction.naukriSkills = skills;
      rawExtraction.naukriCerts = certifications;
    }

    // Build platform sync timestamps
    let platforms = existing?.platforms || {};
    if (platform === 'LinkedIn') {
      platforms.linkedin = { synced: true, lastSync: new Date() };
    } else if (platform === 'Naukri') {
      platforms.naukri = { synced: true, lastSync: new Date() };
    }

    // Use the highest experience years from either platform
    const bestExp = existing?.experienceYears
      ? Math.max(existing.experienceYears, experienceYears || 0)
      : experienceYears;

    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      {
        userId,
        platforms,
        skills: mergedSkills,
        experienceYears: bestExp,
        currentRole: currentRole || existing?.currentRole,
        targetRole: targetRole || existing?.targetRole,
        certifications: mergedCerts,
        missingSkills: mergedMissing,
        studyPlan: studyPlan || existing?.studyPlan,
        studyPlanTopics: studyPlanTopics.length > 0 ? studyPlanTopics : (existing?.studyPlanTopics || []),
        rawExtraction
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, profile });
  } catch (e) {
    console.error('Profile Save Error:', e.message);
    res.status(500).json({ error: 'Failed to save profile', details: e.message });
  }
}
