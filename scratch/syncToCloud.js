import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { JobRecord } from '../src/models/models.js';

async function sync() {
  console.log('🚀 Connecting to MongoDB Atlas...');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!');

    const cachePath = path.join(process.cwd(), '.cache', 'application-tracker.json');
    if (!fs.existsSync(cachePath)) {
      console.error('❌ Local cache not found.');
      process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const jobs = data.records || [];
    console.log(`📦 Found ${jobs.length} local jobs. Uploading...`);

    let count = 0;
    for (const job of jobs) {
      // Ensure job_hash exists for deduplication
      const hash = job.job_hash || Buffer.from(`${job.company}-${job.role}`).toString('base64');
      
      await JobRecord.findOneAndUpdate(
        { job_hash: hash },
        { ...job, job_hash: hash, createdAt: new Date() },
        { upsert: true, new: true }
      );
      count++;
    }

    console.log(`✅ Successfully synced ${count} jobs to the cloud!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
}

sync();
