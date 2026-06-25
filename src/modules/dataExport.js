// Data Export Module

export function exportStudyHistoryToCSV(histories = {}) {
  const headers = ['Date', 'Total Study Seconds', 'Session Count', 'Topics Studied'];
  const rows = [headers];

  const dates = Object.keys(histories).sort().reverse();
  dates.forEach(date => {
    const entry = histories[date] || {};
    const study = entry.study || {};
    const topicBreakdown = study.topicBreakdown || study.breakdown || {};
    const topics = Object.keys(topicBreakdown).join('; ');
    
    rows.push([
      date,
      study.totalSeconds || 0,
      study.sessionCount || 0,
      `"${topics.replace(/"/g, '""')}"`
    ]);
  });

  downloadCSV(rows, 'salesforce_study_history.csv');
}

export function exportJobRadarPipelineToCSV(jobs = []) {
  const headers = ['Company', 'Role Title', 'Location', 'Status', 'Fit Score', 'Salary Range', 'URL', 'Date Updated'];
  const rows = [headers];

  jobs.forEach(job => {
    rows.push([
      `"${(job.company || '').replace(/"/g, '""')}"`,
      `"${(job.role || job.title || '').replace(/"/g, '""')}"`,
      `"${(job.location || '').replace(/"/g, '""')}"`,
      job.status || 'todo',
      job.score || job.match_score || 0,
      `"${(job.salary || '').replace(/"/g, '""')}"`,
      `"${(job.apply_link || job.url || '').replace(/"/g, '""')}"`,
      job.updatedAt || job.createdAt || ''
    ]);
  });

  downloadCSV(rows, 'salesforce_job_pipeline.csv');
}

function downloadCSV(rows, filename) {
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof window.showToast === 'function') {
    window.showToast(`📥 Exported to ${filename} successfully!`, false);
  }
}
