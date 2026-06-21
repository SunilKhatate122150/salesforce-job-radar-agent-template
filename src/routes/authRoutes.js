// Auth Routes (Vite)
import { User } from '../models/models.js';
import { TursoDB } from '../db/turso_driver.js';
import { verifyGoogleCredential } from '../auth/session.js';
import { apiError, apiSuccess } from '../api/apiResponse.js';
import { readBody } from './routeHelpers.js';
import mongoose from 'mongoose';

export async function handleGoogleAuth(req, res) {
  try {
    const { token } = readBody(req);
    const { user } = await verifyGoogleCredential(token);
    const userData = { id: user.id, googleId: user.googleId, email: user.email, name: user.name, picture: user.picture };

    try {
      if (mongoose.connection.readyState !== 1) throw new Error('MongoDB not connected');
      await User.findOneAndUpdate(
        { googleId: userData.id },
        {
          googleId: userData.id,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          lastLogin: new Date()
        },
        { upsert: true, new: true }
      );
    } catch (mongoErr) {
      console.error('[AUTH] Mongo user sync failed but continuing:', mongoErr.message);
    }
    
    try {
      await TursoDB.saveUser(userData);
      console.log(`[AUTH] User ${userData.id} synced to Turso tier.`);
    } catch (dbErr) {
      console.error('[AUTH] Turso sync failed but continuing:', dbErr.message);
    }
    
    return res.status(200).json(apiSuccess({ user: userData }));
  } catch (authErr) {
    console.error('[AUTH] Google Verify Failed:', authErr.message);
    return res.status(401).json(apiError('Authentication failed. Check GOOGLE_CLIENT_ID.', {
      status: 401,
      code: 'auth_failed'
    }));
  }
}
