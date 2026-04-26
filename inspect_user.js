import 'dotenv/config';
import { TursoDB } from './src/db/turso_driver.js';

async function checkUser() {
  const userId = "110350874021920227425";
  console.log(`Checking Turso Profile for: ${userId}`);
  
  const profile = await TursoDB.getProfile(userId);
  if (!profile) {
    console.log('No profile found in Turso.');
  } else {
    console.log('--- Turso Profile ---');
    console.log('User:', profile.userId);
    console.log('Bookmarks:', profile.bookmarks);
    console.log('Completed Tasks:', profile.completedTasks);
  }
  
  process.exit(0);
}

checkUser();
