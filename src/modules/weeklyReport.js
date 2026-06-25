// Weekly Progress Report Module

export function generateWeeklyReport(studySessions = [], profile = {}, jobRecords = [], streak = 0, readiness = 0) {
  const now = new Date();
  
  // Calculate start of this week and last week
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  let thisWeekSecs = 0;
  let lastWeekSecs = 0;
  const topicsMap = {};

  studySessions.forEach(session => {
    const sessionDate = new Date(session.timestamp || session.date);
    if (isNaN(sessionDate.getTime())) return;
    
    const duration = Number(session.duration || session.totalSeconds || 0);

    if (sessionDate >= startOfThisWeek) {
      thisWeekSecs += duration;
      const topicName = session.topicName || session.topic || 'General';
      topicsMap[topicName] = (topicsMap[topicName] || 0) + duration;
    } else if (sessionDate >= startOfLastWeek) {
      lastWeekSecs += duration;
    }
  });

  const thisWeekHrs = (thisWeekSecs / 3600).toFixed(1);
  const lastWeekHrs = (lastWeekSecs / 3600).toFixed(1);
  
  // Calculate trend
  let trendDirection = 'up';
  let trendPercentage = 0;
  if (lastWeekSecs > 0) {
    trendPercentage = Math.round(((thisWeekSecs - lastWeekSecs) / lastWeekSecs) * 100);
    if (trendPercentage < 0) {
      trendDirection = 'down';
      trendPercentage = Math.abs(trendPercentage);
    }
  } else if (thisWeekSecs > 0) {
    trendPercentage = 100;
  }

  // Get top topics
  const topTopics = Object.keys(topicsMap)
    .map(name => ({ name, hours: (topicsMap[name] / 3600).toFixed(1) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 3);

  // Application count
  const appliedCount = jobRecords.filter(job => {
    const status = (job.status || '').toLowerCase();
    const updated = new Date(job.updatedAt || job.dateApplied || job.createdAt);
    return status === 'applied' && updated >= startOfThisWeek;
  }).length;

  return {
    thisWeekHrs,
    lastWeekHrs,
    trendDirection,
    trendPercentage,
    topTopics,
    appliedCount,
    streak,
    readiness,
    targetRole: profile.targetDesignation || profile.targetRole || 'Salesforce Developer',
    generatedAt: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  };
}

export function copyWeeklyReportToClipboard(report) {
  const text = `📊 Salesforce Job Radar — Weekly Impact Report (${report.generatedAt})
  
🔥 Study Streak: ${report.streak} days
🎯 Readiness Score: ${report.readiness}%
💼 Target Role: ${report.targetRole}

📖 Study Time: ${report.thisWeekHrs} hours completed this week
📈 Trend: ${report.trendDirection === 'up' ? '▲' : '▼'} ${report.trendPercentage}% change from last week

📚 Top Topics Studied:
${report.topTopics.map((t, idx) => `  ${idx + 1}. ${t.name} (${t.hours} hrs)`).join('\n') || '  None recorded yet.'}

💼 Job Applications:
  * ${report.appliedCount} new application(s) submitted this week

🚀 Built with Salesforce Job Radar AI.
  `;
  navigator.clipboard.writeText(text).then(() => {
    if (typeof window.showToast === 'function') {
      window.showToast('📋 Weekly report copied as text to clipboard!', false);
    }
  });
}

export function renderWeeklyReport(containerId, studySessions, profile, jobRecords, streak, readiness) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const report = generateWeeklyReport(studySessions, profile, jobRecords, streak, readiness);

  container.innerHTML = `
    <div style="background:linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08)); border:1px solid rgba(99,102,241,0.15); border-radius:18px; padding:2rem; position:relative; overflow:hidden;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem;">
        <div>
          <span style="font-size:0.65rem; font-weight:700; color:var(--blue); text-transform:uppercase; letter-spacing:1px;">Weekly Review</span>
          <h3 style="font-size:1.5rem; margin:4px 0 0 0; font-weight:700; color:var(--text);">Weekly Impact Report</h3>
        </div>
        <span style="font-size:0.75rem; color:var(--muted); font-family:var(--font-mono);">${report.generatedAt}</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:2rem;">
        <div style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:1.25rem; text-align:center;">
          <div style="font-size:0.72rem; text-transform:uppercase; color:var(--muted); font-weight:600; letter-spacing:0.5px; margin-bottom:8px;">Study Volume</div>
          <div style="font-size:2.25rem; font-weight:800; color:var(--text);">${report.thisWeekHrs} <span style="font-size:0.95rem; font-weight:500; color:var(--muted);">hrs</span></div>
          <div style="font-size:0.72rem; color:${report.trendDirection === 'up' ? 'var(--green)' : 'var(--red)'}; font-weight:600; margin-top:6px;">
            ${report.trendDirection === 'up' ? '▲' : '▼'} ${report.trendPercentage}% vs last week
          </div>
        </div>

        <div style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:1.25rem; text-align:center;">
          <div style="font-size:0.72rem; text-transform:uppercase; color:var(--muted); font-weight:600; letter-spacing:0.5px; margin-bottom:8px;">Applications Sent</div>
          <div style="font-size:2.25rem; font-weight:800; color:var(--text);">${report.appliedCount}</div>
          <div style="font-size:0.72rem; color:var(--muted); font-weight:600; margin-top:6px;">Submitted this week</div>
        </div>
      </div>

      <div style="margin-bottom:2rem;">
        <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--muted); font-weight:700; letter-spacing:0.5px; margin-bottom:0.75rem;">Top Topics Studied</h4>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${report.topTopics.map(t => `
            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:10px 14px; border-radius:10px;">
              <span style="font-size:0.85rem; font-weight:600; color:var(--text);">${t.name}</span>
              <span style="font-size:0.78rem; font-weight:700; color:var(--blue);">${t.hours} hrs</span>
            </div>
          `).join('') || '<div style="color:var(--muted); font-size:0.8rem; font-style:italic;">No topics studied this week.</div>'}
        </div>
      </div>

      <div style="display:flex; gap:12px;">
        <button id="copyReportBtn" style="background:var(--blue); color:white; border:none; padding:12px 24px; border-radius:12px; font-weight:700; font-size:0.85rem; cursor:pointer; flex:1; display:inline-flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 15px rgba(59,130,246,0.3);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copy shareable text
        </button>
      </div>
    </div>
  `;

  // Attach listener
  const copyBtn = document.getElementById('copyReportBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => copyWeeklyReportToClipboard(report));
  }
}
