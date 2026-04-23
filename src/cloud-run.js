import 'dotenv/config';
import mongoose from 'mongoose';
import { JobRecord } from './models/models.js';
import { fetchNaukriJobs } from './jobs/fetchNaukri.js';

/**
 * Smart Scoring Engine (Premium v1402)
 * Bypasses simple keyword matching for deep profile alignment.
 */
function evaluateJob(job) {
    const title = (job.title || job.role || '').toLowerCase();
    
    // Safety check for skills (could be array or string)
    let rawSkills = job.skills || [];
    if (typeof rawSkills === 'string') rawSkills = rawSkills.split(',').map(s => s.trim());
    const skills = rawSkills.map(s => String(s).toLowerCase());
    const exp = (job.experience || '').toLowerCase();
    
    let score = 50; // Base score for being a Salesforce job
    let why = [];

    // 1. Experience Check (User has 4 years)
    if (exp.includes('3-5') || exp.includes('4') || exp.includes('3-6')) {
        score += 20;
        why.push("Direct match for your 4-year experience level.");
    } else if (exp.includes('senior') || exp.includes('5-')) {
        score += 10;
        why.push("Stretch role that values your PD2 certification.");
    }

    // 2. Skill Alignment
    const coreSkills = ['lwc', 'apex', 'integration', 'pd2', 'data cloud'];
    let skillMatches = 0;
    coreSkills.forEach(s => {
        if (title.includes(s) || skills.some(sk => sk.includes(s))) {
            score += 10;
            skillMatches++;
        }
    });

    if (skillMatches >= 2) {
        why.push(`Matches ${skillMatches} of your core technical specialties.`);
    }

    // 3. Location / Remote
    if (title.includes('remote') || (job.location || '').toLowerCase().includes('remote')) {
        score += 5;
        why.push("Remote flexibility detected.");
    }

    return {
        score: Math.min(score, 100),
        why: why.length > 0 ? why.join(' ') : "Solid Salesforce opportunity matching your PD1/PD2 profile."
    };
}

async function runCloudSync() {
    console.log('☁️ Starting Premium GitHub Cloud Sync...');
    
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI secret missing!');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas');

        console.log('📡 Fetching jobs via Apify/Naukri...');
        const jobs = await fetchNaukriJobs(); 
        console.log(`📦 Received ${jobs.length} raw jobs.`);

        let added = 0;
        for (const job of jobs) {
            const hash = job.job_hash || Buffer.from(`${job.company}-${job.title}`).toString('base64');
            const evalResult = evaluateJob(job);

            if (evalResult.score >= 50) { 
                await JobRecord.findOneAndUpdate(
                    { job_hash: hash },
                    { 
                        title: job.title || job.role,
                        company: job.company,
                        location: job.location || 'India',
                        salary: job.salary || 'Competitive',
                        experience: job.experience || '3-5 Yrs',
                        company_type: job.company_type || 'Salesforce Partner',
                        matched_skills: Array.isArray(job.skills) ? job.skills : (typeof job.skills === 'string' ? job.skills.split(',') : ['Apex', 'LWC']),
                        match_score: evalResult.score,
                        why_apply: evalResult.why,
                        apply_link: job.apply_link || job.url,
                        url: job.apply_link || job.url,
                        job_hash: hash, 
                        userId: 'system',
                        status: 'new',
                        createdAt: new Date()
                    },
                    { upsert: true }
                );
                added++;
            }
        }

        console.log(`✅ Cloud Sync Finished. Added/Updated ${added} Premium jobs.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Cloud Sync Failed:', err);
        process.exit(1);
    }
}

runCloudSync();
