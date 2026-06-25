import assert from 'node:assert/strict';
import test from 'node:test';
import { generateWeeklyReport } from '../src/modules/weeklyReport.js';

test('generateWeeklyReport aggregates study time and calculates correct trends', () => {
  const now = new Date();
  const sessions = [
    {
      topicName: 'LWC Core',
      duration: 3600,
      timestamp: now.toISOString()
    },
    {
      topicName: 'REST & SOAP API',
      duration: 7200,
      timestamp: now.toISOString()
    }
  ];

  const profile = { skills: [] };
  const jobs = [{ status: 'applied', updatedAt: now.toISOString() }];

  const report = generateWeeklyReport(sessions, profile, jobs, 3, 45);

  assert.equal(report.thisWeekHrs, '3.0');
  assert.equal(report.appliedCount, 1);
  assert.ok(report.topTopics.length > 0);
  assert.equal(report.topTopics[0].name, 'REST & SOAP API');
});
