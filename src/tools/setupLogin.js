import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const AGENT_PROFILE_DIR = path.resolve(process.cwd(), '.agent_profile');

async function main() {
  console.log(`\n=== AGENT LOGIN SETUP ===`);
  console.log(`We are creating an isolated, dedicated browser profile for the Job Radar Agent.`);
  console.log(`This ensures the agent can sync your profiles and scrape jobs without interfering with your main Chrome browser.\n`);

  if (!fs.existsSync(AGENT_PROFILE_DIR)) {
    fs.mkdirSync(AGENT_PROFILE_DIR, { recursive: true });
  }

  let chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
     chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  }

  console.log(`🚀 Launching Agent Browser...`);
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    userDataDir: AGENT_PROFILE_DIR,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  
  console.log(`\n➡️  ACTION REQUIRED:`);
  console.log(`1. Please log into LinkedIn in the browser window.`);
  console.log(`2. Once logged in, navigate to Naukri and log in there as well.`);
  console.log(`3. Solve any CAPTCHAs or OTPs required.`);
  console.log(`4. Simply CLOSE the browser window when you are completely done.\n`);
  
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });

  // Wait until the browser is disconnected (i.e. user closed it)
  await new Promise(resolve => browser.on('disconnected', resolve));

  console.log(`✅ Login Setup Complete! The Agent securely saved your session.`);
  console.log(`You can now run 'npm run sync:linkedin' or 'npm run sync:naukri' without closing your main Chrome browser!\n`);
}

main().catch(e => {
  console.error("❌ Setup failed:", e);
  process.exit(1);
});
