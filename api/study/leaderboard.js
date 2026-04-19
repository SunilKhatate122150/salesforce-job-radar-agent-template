import mongoose from 'mongoose';
import { StudySession, User } from '../../src/models/models.js';

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
  
  try {
    await connectDB();
    
    // Aggregate total study time per user
    const leaderboard = await StudySession.aggregate([
      { $group: { _id: "$userId", totalSeconds: { $sum: "$duration" } } },
      { $sort: { totalSeconds: -1 } },
      { $limit: 10 }
    ]);

    // Populate user details manually since userId is a string matching googleId
    const userIds = leaderboard.map(l => l._id);
    const users = await User.find({ googleId: { $in: userIds } }).lean();
    
    const userMap = {};
    users.forEach(u => userMap[u.googleId] = u);

    const enrichedLeaderboard = leaderboard.map(entry => {
      const user = userMap[entry._id] || { name: 'Anonymous Scholar', picture: '' };
      return {
        name: user.name,
        picture: user.picture,
        totalHours: (entry.totalSeconds / 3600).toFixed(1)
      };
    });

    res.status(200).json({ leaderboard: enrichedLeaderboard });
  } catch (e) {
    console.error('Leaderboard Error:', e.message);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}
