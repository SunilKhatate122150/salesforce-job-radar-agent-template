import 'dotenv/config';
import mongoose from 'mongoose';
import { JobRecord } from './models/models.js';
import { fetchNaukriJobs } from './jobs/fetchNaukri.js';

// Simple keyword-based scoring for cloud environment (No local LLM needed)
function scoreJob(title, skills = []) {
    const keywords = ['Salesforce', 'Apex', 'LWC', 'Flow', 'Aura', 'SFDC', 'Developer', 'Consultant'];
    let score = 20; // Base score
    const t = title.toLowerCase();
    
    keywords.forEach(k => {
        if (t.includes(k.toLowerCase())) score += 10;
    });
    
    return Math.min(score, 100);
}

async function runCloudSync() {
    console.log('☁️  Starting GitHub Cloud Sync...');
    
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI secret missing!');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas');

        console.log('📡 Fetching jobs via Apify...');
        // We use the existing Apify logic
        const jobs = await fetchNaukriJobs(); 
        console.log(`📦 Received ${jobs.length} raw jobs from Apify.`);

        let added = 0;
        for (const job of jobs) {
            const hash = job.job_hash || Buffer.from(`${job.company}-${job.title}`).toString('base64');
            const matchScore = scoreJob(job.title);

            if (matchScore >= 40) { // Only save decent matches
                await JobRecord.findOneAndUpdate(
                    { job_hash: hash },
                    { 
                        ...job, 
                        job_hash: hash, 
                        match_score: matchScore,
                        userId: 'system',
                        status: 'new',
                        createdAt: new Date()
                    },
                    { upsert: true }
                );
                added++;
            }
        }

        console.log(`✅ Cloud Sync Finished. Added/Updated ${added} jobs.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Cloud Sync Failed:', err);
        process.exit(1);
    }
}

runCloudSync();
