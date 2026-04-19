import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const VERCEL_URL = 'https://salesforce-job-radar-agent-template.vercel.app';

async function migrate() {
  console.log('🚀 Starting Cloud-Bridge Migration with Debugging...');
  console.log(`🔗 Target: ${VERCEL_URL}`);
  
  const cacheFile = path.join(process.cwd(), '.cache', 'study-tracker.json');
  
  if (!fs.existsSync(cacheFile)) {
    console.log('ℹ️ No local study-tracker.json found.');
    process.exit(0);
  }

  try {
    const localData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const sessions = localData.sessions || [];

    console.log(`📊 Found ${sessions.length} sessions to upload.`);

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      process.stdout.write(`📤 Uploading session ${i + 1}/${sessions.length}... `);
      
      const res = await fetch(`${VERCEL_URL}/api/study/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s)
      });

      const responseText = await res.text();

      if (res.ok) {
        console.log('✅ Success');
      } else {
        console.log(`❌ Failed (Status: ${res.status}) - Message: ${responseText}`);
      }
    }

    console.log('\n🏁 Debugging Complete.');
    process.exit(0);

  } catch (err) {
    console.error('❌ Script Error:', err);
    process.exit(1);
  }
}

migrate();
