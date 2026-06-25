// Job Application Timeline Module

export function renderJobTimeline(containerId, jobs = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (jobs.length === 0) {
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--muted); font-size: 0.85rem;">No jobs in your pipeline to show timeline.</div>`;
    return;
  }

  // Sort jobs by last updated
  const sortedJobs = jobs.slice().sort((a, b) => {
    const aDate = new Date(a.updatedAt || a.createdAt || 0);
    const bDate = new Date(b.updatedAt || b.createdAt || 0);
    return bDate - aDate;
  });

  let html = `
    <div class="timeline-container">
      <div class="timeline-line"></div>
  `;

  sortedJobs.forEach((job, index) => {
    const updatedDate = new Date(job.updatedAt || job.createdAt || Date.now());
    const dateStr = updatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const status = (job.status || 'todo').toLowerCase();

    let nodeColorClass = 'timeline-node--todo';
    if (status === 'applied') nodeColorClass = 'timeline-node--applied';
    if (status === 'interview') nodeColorClass = 'timeline-node--interview';
    if (status === 'offer') nodeColorClass = 'timeline-node--offer';
    if (status === 'rejected') nodeColorClass = 'timeline-node--rejected';

    html += `
      <div class="timeline-card-item">
        <div class="timeline-node ${nodeColorClass}"></div>
        <div class="timeline-card-content">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <h4 style="font-size:0.95rem; font-weight:700; margin:0; color:var(--text);">${job.role || job.title}</h4>
              <span style="font-size:0.75rem; color:var(--muted);">${job.company} &bull; ${job.location || 'Remote'}</span>
            </div>
            <span style="font-size:0.65rem; font-family:var(--font-mono); color:var(--muted);">${dateStr}</span>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:12px;">
            <span class="timeline-status-badge timeline-status-badge--${status}">${status.toUpperCase()}</span>
            <span style="font-size:0.72rem; color:var(--blue); font-weight:700;">Score: ${job.score || job.match_score || 0}%</span>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}
