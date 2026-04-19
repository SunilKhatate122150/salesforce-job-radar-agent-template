import { JobRecord } from '../src/models/models.js';
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

export default async function(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  let userId;
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    userId = ticket.getPayload()['sub'];
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  await connectDB();
  try {
    const jobs = await JobRecord.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
    res.status(200).json({ records: jobs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cloud jobs' });
  }
}

