import mongoose from 'mongoose';
import { User } from '../../src/models/models.js';
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
  
  try {
    await connectDB();
    const { token } = req.body;
    
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const googleId = payload['sub'];
    
    const user = await User.findOneAndUpdate(
      { googleId },
      { 
        googleId,
        email: payload['email'],
        name: payload['name'],
        picture: payload['picture'],
        lastLogin: new Date()
      },
      { upsert: true, new: true }
    );
    
    res.status(200).json({ success: true, user });
  } catch (e) {
    console.error('Auth Error:', e);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
}
