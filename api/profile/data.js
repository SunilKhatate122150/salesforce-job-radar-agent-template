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
      return res.status(200).json({ exists: false, profile: null });
    }

    res.status(200).json({ exists: true, profile });
  } catch (e) {
    console.error('Profile Fetch Error:', e.message);
    res.status(500).json({ error: 'Failed to fetch profile', details: e.message });
  }
}
