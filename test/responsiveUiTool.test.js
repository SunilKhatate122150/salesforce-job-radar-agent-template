import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('responsive verification tool is available and covers key breakpoints', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['responsive:verify'], 'node src/tools/verifyResponsiveUi.js');

  const script = fs.readFileSync('src/tools/verifyResponsiveUi.js', 'utf8');
  ['mobile-320', 'mobile-390', 'mobile-430', 'tablet-768', 'tablet-900', 'desktop-901', 'tablet-1024', 'desktop-1365', 'desktop-1440'].forEach(name => {
    assert.match(script, new RegExp(name));
  });
  assert.match(script, /mobileBoardStageSelect/);
  assert.match(script, /mobile drawer open\/close state is not synchronized/);
  assert.match(script, /sidebar search empty state did not appear/);
  assert.match(script, /sidebar search did not keep accordion state synchronized/);
  assert.match(script, /header controls or profile dropdown overlap/);
  assert.match(script, /Job Radar header controls overlap/);
  assert.match(script, /Job Radar mobile shell title or top spacing is broken/);
  assert.match(script, /collapsed sidebar flyout does not fit or close correctly/);
  assert.match(script, /job card detail flyout did not open/);
  assert.match(script, /touch targets below 44px/);
  assert.match(script, /horizontal overflow detected/);
  assert.match(script, /mobile toggle visible on desktop/);
  assert.match(script, /content is pushed by the mobile drawer/);
  assert.match(script, /verifyAgentDashboard/);
  assert.match(script, /Agent Dashboard action queue is squeezed into a narrow column/);
  assert.match(script, /roadmap action labels collapse or overflow/);
});
