import mongoose from 'mongoose';
import { JobRecord } from '../../src/models/models.js';
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
    
    // Aggregate Top Missing Skills (Skills the user needs to learn)
    const missingSkillsAgg = await JobRecord.aggregate([
      { $match: { userId } },
      { $unwind: "$missing_skills" },
      { $group: { _id: "$missing_skills", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Aggregate Top Matched Skills (Skills the market wants that the user has)
    const matchedSkillsAgg = await JobRecord.aggregate([
      { $match: { userId } },
      { $unwind: "$matched_skills" },
      { $group: { _id: "$matched_skills", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Aggregate Hiring Companies
    const topCompanies = await JobRecord.aggregate([
      { $match: { userId } },
      { $group: { _id: "$company", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.status(200).json({ 
      missing_skills: missingSkillsAgg,
      matched_skills: matchedSkillsAgg,
      top_companies: topCompanies
    });
    
  } catch (e) {
    console.error('Analytics Error:', e.message);
    res.status(500).json({ error: 'Failed to generate analytics', details: e.message });
  }
}
