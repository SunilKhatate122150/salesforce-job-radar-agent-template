import assert from 'node:assert/strict';
import test from 'node:test';
import { exportStudyHistoryToCSV, exportJobRadarPipelineToCSV } from '../src/modules/dataExport.js';

// Mock browser global document/DOM helpers
globalThis.document = {
  createElement: () => ({
    setAttribute: () => {},
    click: () => {},
    style: {}
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};
globalThis.window = {
  showToast: () => {}
};

test('dataExport CSV methods trigger link click download behavior', () => {
  let clicked = false;
  globalThis.document.createElement = () => ({
    setAttribute: (name, val) => {
      if (name === 'href') {
        assert.ok(val.includes('Date'), 'csv must include headers');
      }
    },
    click: () => { clicked = true; }
  });

  const mockHistories = {
    '2026-06-25': {
      study: {
        totalSeconds: 3600,
        sessionCount: 1,
        topicBreakdown: { 'apex': { totalSeconds: 3600 } }
      }
    }
  };

  exportStudyHistoryToCSV(mockHistories);
  assert.equal(clicked, true);
});
