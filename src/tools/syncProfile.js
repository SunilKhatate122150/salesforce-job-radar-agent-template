import puppeteer from 'puppeteer-core';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const ENV_PATH = path.resolve(process.cwd(), '.env');

async function askGemma(prompt) {
  const payload = {
    model: "gemma4:e4b",
    prompt: prompt,
    stream: false,
    options: { temperature: 0.2 }
  };
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    return data.response;
  } catch (e) {
    console.error("❌ Failed to reach local Gemma engine. Ensure Ollama is running.");
    process.exit(1);
  }
}

async function scrapeProfile(platform) {
  console.log(`\n🚀 Launching Auto-Sync for ${platform}...`);
  
  const homeDir = os.homedir();
  let chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
     chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  }
  const AGENT_PROFILE_DIR = path.resolve(process.cwd(), '.agent_profile');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      executablePath: chromePath,
      userDataDir: AGENT_PROFILE_DIR,
      defaultViewport: null
    });
  } catch (e) {
    console.error(`❌ Chrome failed to launch. Error: ${e.message}`);
    process.exit(1);
  }

  const page = await browser.newPage();
  
  try {
    let url = platform === 'LinkedIn' ? 'https://www.linkedin.com/in/me/' : 'https://www.naukri.com/mnjuser/profile';
    console.log(`➡️ Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Auto scroll to load dynamic content
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 300;
        let timer = setInterval(() => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if(totalHeight >= scrollHeight - window.innerHeight){
            clearInterval(timer);
            resolve();
          }
        }, 300);
      });
    });

    // Extract all meaningful text
    const profileText = await page.evaluate(() => {
      return document.body.innerText.replace(/\s+/g, ' ').trim();
    });

    console.log(`✅ Extracted ${profileText.length} characters of profile data.`);
    await browser.close();
    return profileText;
  } catch (err) {
    console.error(`❌ Scraping failed: ${err.message}`);
    await browser.close();
    process.exit(1);
  }
}

async function pushToCloud(profileData) {
  // Read the Google auth token from localStorage backup or .env
  const token = process.env.GOOGLE_AUTH_TOKEN;
  const apiBase = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';

  if (!token) {
    console.log('⚠️  No GOOGLE_AUTH_TOKEN in .env. Cloud sync skipped (data saved locally only).');
    console.log('   Tip: The dashboard will push your profile to the cloud when you click Sync there.');
    return false;
  }

  try {
    const res = await fetch(`${apiBase}/api/profile/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileData)
    });
    const data = await res.json();
    if (data.success) {
      console.log('☁️  Profile data synced to cloud database!');
      return true;
    } else {
      console.log('⚠️  Cloud sync response:', data.error);
      return false;
    }
  } catch (e) {
    console.log('⚠️  Cloud sync unavailable (offline mode). Data saved locally.');
    return false;
  }
}

async function main() {
  console.log("=== JOB RADAR CLOUD SYNC ===");
  const target = process.argv[2] || 'LinkedIn';
  
  const rawText = await scrapeProfile(target);

  // ===== STEP 1: Extract skills, experience, certifications, and role =====
  console.log(`\n🤖 Sending ${target} profile to local Gemma 4 for AI extraction...`);
  const extractionPrompt = `
  Analyze this raw ${target} profile text carefully.
  Extract ALL of the following information:
  1. Technical skills (programming languages, platforms, tools, frameworks)
  2. Total years of professional experience
  3. Current job title / role
  4. Professional certifications (e.g., Salesforce PD1, Admin, AWS, etc.)
  
  Return EXACTLY in this JSON format and nothing else:
  {
    "skills": ["skill1", "skill2"],
    "experienceYears": 3,
    "currentRole": "Job Title",
    "certifications": ["cert1", "cert2"]
  }
  Do not include markdown blocks, explanations, or any other text. ONLY the JSON object.
  Profile: ${rawText.substring(0, 15000)}
  `;

  let jsonResult;
  try {
    const aiResponse = await askGemma(extractionPrompt);
    const cleanJsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    // Find the JSON object in the response
    const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
    jsonResult = JSON.parse(jsonMatch ? jsonMatch[0] : cleanJsonStr);
  } catch (e) {
    console.error("❌ Failed to parse Gemma response as JSON:", e.message);
    process.exit(1);
  }

  console.log("\n✅ AI Extraction Successful!");
  console.log(`🧠 Skills: ${jsonResult.skills.join(', ')}`);
  console.log(`⏳ Experience: ${jsonResult.experienceYears} Years`);
  console.log(`💼 Role: ${jsonResult.currentRole || 'Not detected'}`);
  console.log(`🏅 Certifications: ${(jsonResult.certifications || []).join(', ') || 'None detected'}`);

  // ===== STEP 2: Update local .env =====
  let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
  const skillsStr = jsonResult.skills.join(', ');
  
  if (envContent.includes('RESUME_SKILLS=')) {
    envContent = envContent.replace(/RESUME_SKILLS=.*/g, `RESUME_SKILLS="${skillsStr}"`);
  } else {
    envContent += `\nRESUME_SKILLS="${skillsStr}"`;
  }

  if (envContent.includes('RESUME_EXPERIENCE_YEARS=')) {
    envContent = envContent.replace(/RESUME_EXPERIENCE_YEARS=.*/g, `RESUME_EXPERIENCE_YEARS=${jsonResult.experienceYears}`);
  } else {
    envContent += `\nRESUME_EXPERIENCE_YEARS=${jsonResult.experienceYears}`;
  }

  fs.writeFileSync(ENV_PATH, envContent);
  console.log(`\n⚙️ Agent .env updated for ${target} profile.`);

  // ===== STEP 3: Generate study plan with structured topics =====
  console.log(`\n📚 Generating Tailored Study Plan with structured topics...`);
  const studyPrompt = `
  You are an expert Salesforce Career Coach.
  The user has these skills: ${skillsStr}.
  They have ${jsonResult.experienceYears} years of experience.
  Their current role is: ${jsonResult.currentRole || 'Salesforce Developer'}.
  Their certifications: ${(jsonResult.certifications || []).join(', ') || 'None'}.
  
  TASK 1: Identify 5 critical missing skills or areas they need to study.
  TASK 2: For each missing skill, provide a structured study topic.
  TASK 3: Write a comprehensive markdown study plan.
  
  Return EXACTLY in this JSON format:
  {
    "missingSkills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
    "targetRole": "Senior Salesforce Developer",
    "studyPlanTopics": [
      {
        "topicId": "fde_dc_concept",
        "topic": "Data Cloud",
        "priority": "critical",
        "reason": "Required for FDE certification and high-paying roles",
        "estimatedHours": 10
      }
    ],
    "studyPlanMarkdown": "## Your Personalized Study Plan\\n..."
  }
  
  IMPORTANT for topicId: Use these IDs to connect to the existing study tracker:
  apex, soql, async, triggers, lwc, aura, integration, security, domain, scenario, design, adv_apex, admin,
  fde_ag_concept, fde_atlas, fde_trust, fde_dc_concept, fde_dc_adv, fde_cheat,
  intro, behavioral, speaking, comm, vocab, salary, mock
  If the topic doesn't match any existing ID, use a short snake_case ID like "data_cloud_new".
  
  Do not include markdown code blocks around the JSON. ONLY the JSON object.
  `;

  let studyResult;
  try {
    const studyResponse = await askGemma(studyPrompt);
    const cleanStudy = studyResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const studyMatch = cleanStudy.match(/\{[\s\S]*\}/);
    studyResult = JSON.parse(studyMatch ? studyMatch[0] : cleanStudy);
  } catch (e) {
    console.error("⚠️ Structured study plan parse failed. Falling back to markdown-only.");
    // Fallback: just generate a markdown plan
    const fallbackPlan = await askGemma(`
      You are a Salesforce Career Coach. The user has skills: ${skillsStr}, ${jsonResult.experienceYears} years experience.
      Write a short, actionable study plan in clean markdown format. Identify 5 missing skills.
    `);
    studyResult = {
      missingSkills: [],
      targetRole: "Senior Salesforce Developer",
      studyPlanTopics: [],
      studyPlanMarkdown: fallbackPlan
    };
  }

  // Save study plan locally
  const studyPath = path.resolve(process.cwd(), 'TAILORED_STUDY_PLAN.md');
  fs.writeFileSync(studyPath, studyResult.studyPlanMarkdown || '# Study Plan\nSync your profile to generate.');
  console.log(`\n🎉 Study Plan saved to: TAILORED_STUDY_PLAN.md`);

  console.log(`\n📋 Missing Skills: ${(studyResult.missingSkills || []).join(', ')}`);
  console.log(`🎯 Target Role: ${studyResult.targetRole || 'Senior Salesforce Developer'}`);
  if (studyResult.studyPlanTopics && studyResult.studyPlanTopics.length > 0) {
    console.log(`\n📖 Study Topics (connected to timer):`);
    studyResult.studyPlanTopics.forEach((t, i) => {
      console.log(`   ${i+1}. [${t.priority.toUpperCase()}] ${t.topic} — ${t.estimatedHours}h — ${t.reason}`);
    });
  }

  // ===== STEP 4: Push everything to cloud =====
  console.log(`\n☁️ Pushing profile data to cloud database...`);
  const profilePayload = {
    platform: target,
    skills: jsonResult.skills,
    experienceYears: jsonResult.experienceYears,
    currentRole: jsonResult.currentRole,
    targetRole: studyResult.targetRole,
    certifications: jsonResult.certifications || [],
    missingSkills: studyResult.missingSkills || [],
    studyPlan: studyResult.studyPlanMarkdown || '',
    studyPlanTopics: studyResult.studyPlanTopics || []
  };

  await pushToCloud(profilePayload);

  // Also save the full payload locally for the dashboard to read
  const profileCachePath = path.resolve(process.cwd(), '.cache', 'profile-sync.json');
  fs.mkdirSync(path.dirname(profileCachePath), { recursive: true });
  fs.writeFileSync(profileCachePath, JSON.stringify(profilePayload, null, 2));
  console.log(`\n✅ Profile data cached locally at .cache/profile-sync.json`);

  console.log(`\n🎉 === SYNC COMPLETE === 🎉\n`);
  console.log(studyResult.studyPlanMarkdown || '');
}

main();
