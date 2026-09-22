import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyVercelConfig } from '../src/tools/verifyVercelConfig.js';

test('verifyVercelConfig validates vercel.json structure, headers, rewrites, and file inclusions', () => {
  const result = verifyVercelConfig();
  assert.equal(result.success, true);
  assert.equal(result.cspVerified, true);
  assert.equal(result.includeFiles, 'data/**');
  assert.ok(result.headersCount >= 4);
  assert.ok(result.rewritesCount >= 1);
});
