import fs from 'fs';
import path from 'path';

export function verifyVercelConfig() {
  const root = process.cwd();
  const configPath = path.join(root, 'vercel.json');
  const routerPath = path.join(root, 'api', 'router.js');

  if (!fs.existsSync(configPath)) {
    throw new Error('vercel.json is missing in project root.');
  }

  if (!fs.existsSync(routerPath)) {
    throw new Error('api/router.js serverless entrypoint is missing.');
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    throw new Error(`vercel.json is not valid JSON: ${err.message}`);
  }

  // 1. Verify Headers
  if (!Array.isArray(config.headers)) {
    throw new Error('vercel.json missing "headers" array.');
  }
  const globalHeadersEntry = config.headers.find(h => h.source === '/(.*)');
  if (!globalHeadersEntry) {
    throw new Error('vercel.json missing global "/(.*)" headers rule.');
  }

  const cspHeader = globalHeadersEntry.headers.find(h => h.key === 'Content-Security-Policy');
  if (!cspHeader || !cspHeader.value) {
    throw new Error('vercel.json missing Content-Security-Policy header.');
  }

  // 2. Verify Functions
  if (!config.functions || !config.functions['api/router.js']) {
    throw new Error('vercel.json missing functions configuration for "api/router.js".');
  }

  const includeFiles = config.functions['api/router.js'].includeFiles;
  if (!includeFiles || !includeFiles.includes('data')) {
    throw new Error('vercel.json functions.api/router.js must include "data/**" files.');
  }

  // 3. Verify Rewrites
  if (!Array.isArray(config.rewrites)) {
    throw new Error('vercel.json missing "rewrites" array.');
  }

  const apiRewrite = config.rewrites.find(r => r.source === '/api/(.*)');
  if (!apiRewrite || !apiRewrite.destination.includes('/api/router.js')) {
    throw new Error('vercel.json missing rewrite rule for /api/(.*) -> /api/router.js.');
  }

  return {
    success: true,
    headersCount: config.headers.length,
    rewritesCount: config.rewrites.length,
    includeFiles,
    cspVerified: true
  };
}

const isDirectRun = Boolean(process.argv[1] && process.argv[1].endsWith('verifyVercelConfig.js'));

if (isDirectRun) {
  try {
    const result = verifyVercelConfig();
    console.log('✅ Vercel Configuration Verification Passed!');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('❌ Vercel Configuration Verification Failed:', err.message);
    process.exitCode = 1;
  }
}
