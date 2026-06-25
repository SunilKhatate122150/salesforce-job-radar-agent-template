// Skill Gap Heatmap Module

export const SF_SKILLS_LIST = [
  { id: 'apex_core', name: 'Apex Fundamentals', category: 'Apex' },
  { id: 'soql', name: 'SOQL & SOSL', category: 'Database' },
  { id: 'triggers', name: 'Triggers & Order', category: 'Apex' },
  { id: 'async', name: 'Async Apex', category: 'Apex' },
  { id: 'lwc', name: 'LWC Core', category: 'LWC' },
  { id: 'lwc_comm', name: 'LWC Communication', category: 'LWC' },
  { id: 'integration', name: 'REST & SOAP API', category: 'Integration' },
  { id: 'security', name: 'Security & Sharing', category: 'Security' },
  { id: 'flows', name: 'Record-Triggered Flows', category: 'Automation' },
  { id: 'datacloud', name: 'Data Cloud Streams', category: 'Data Cloud' },
  { id: 'agentforce', name: 'Agentforce Actions', category: 'AI' },
  { id: 'prompts', name: 'Prompt Templates', category: 'AI' },
  { id: 'trustlayer', name: 'Einstein Trust Layer', category: 'AI' },
  { id: 'rag', name: 'RAG & Grounding', category: 'AI' },
  { id: 'identity', name: 'Identity Resolution', category: 'Data Cloud' },
  { id: 'lds', name: 'LDS & @wire', category: 'LWC' },
  { id: 'lms', name: 'Lightning Message Service', category: 'LWC' },
  { id: 'gov_limits', name: 'Governor Limits', category: 'Apex' },
  { id: 'batch_apex', name: 'Batch & Schedulable', category: 'Apex' },
  { id: 'platform_events', name: 'Platform Events', category: 'Integration' },
  { id: 'testing', name: 'Unit Testing & Mocking', category: 'Apex' },
  { id: 'credentials', name: 'Named Credentials', category: 'Integration' },
  { id: 'cdc', name: 'Change Data Capture', category: 'Integration' },
  { id: 'bulk_api', name: 'Bulk API 2.0', category: 'Integration' },
  { id: 'sharing_rules', name: 'OWD & Sharing Rules', category: 'Security' },
  { id: 'cpu_limit', name: 'Apex CPU Tuning', category: 'Apex' },
  { id: 'exceptions', name: 'Exception Handling', category: 'Apex' },
  { id: 'deployment', name: 'Metadata & CI/CD', category: 'DevOps' }
];

export function calculateSkillScores(studyData = {}, profile = {}, jobRecords = []) {
  const missingSkills = (profile.missingSkills || []).map(s => s.toLowerCase());
  const knownSkills = (profile.skills || []).map(s => s.toLowerCase());

  // Aggregate job missing skills demand
  const jobDemand = {};
  jobRecords.forEach(job => {
    const gaps = job.missing_skills || job.missingSkills || [];
    gaps.forEach(gap => {
      const gLower = gap.toLowerCase();
      jobDemand[gLower] = (jobDemand[gLower] || 0) + 1;
    });
  });

  // Calculate study hours from breakdown
  const studyBreakdown = studyData.breakdown || studyData.topicBreakdown || {};
  
  return SF_SKILLS_LIST.map(skill => {
    const nameLower = skill.name.toLowerCase();
    
    // 1. Base study hours contribution
    // Map skill ID/name to potential topic keys
    let studySeconds = 0;
    Object.keys(studyBreakdown).forEach(topicId => {
      if (topicId.includes(skill.id) || skill.name.toLowerCase().includes(topicId) || topicId.includes(skill.category.toLowerCase())) {
        studySeconds += studyBreakdown[topicId].totalSeconds || 0;
      }
    });
    const studyHours = studySeconds / 3600;

    // 2. Profile matching
    const isMissing = missingSkills.some(s => s.includes(nameLower) || nameLower.includes(s));
    const isKnown = knownSkills.some(s => s.includes(nameLower) || nameLower.includes(s));

    // 3. Job market demand weight
    let demandCount = 0;
    Object.keys(jobDemand).forEach(g => {
      if (g.includes(nameLower) || nameLower.includes(g)) {
        demandCount += jobDemand[g];
      }
    });

    // Compute Strength Score (0 to 100)
    let score = 30; // Default baseline
    if (isKnown) score += 30;
    if (isMissing) score -= 20;
    
    // Add points based on study time
    score += Math.min(40, studyHours * 10);
    
    // Clamp score
    score = Math.max(5, Math.min(100, Math.round(score)));

    // Recommendation
    let recommendation = 'Start reading fundamentals.';
    if (score < 40) {
      recommendation = `High Gap! Study ${skill.name} to address profile issues.`;
    } else if (score < 75) {
      recommendation = `Medium fit. Solve a mock coding scenario or practice LWC.`;
    } else {
      recommendation = `Strong fit. Keep memory fresh with spacing retention.`;
    }

    return {
      ...skill,
      score,
      studyHours: studyHours.toFixed(1),
      demandCount,
      recommendation
    };
  });
}

export function renderSkillHeatmap(containerId, studyData, profile, jobRecords) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const skillsWithScores = calculateSkillScores(studyData, profile, jobRecords);
  
  let html = `
    <div class="heatmap-header">
      <div class="heatmap-legend">
        <span>Weak (0-40)</span>
        <div class="legend-bar"></div>
        <span>Strong (80-100)</span>
      </div>
    </div>
    <div class="heatmap-grid">
  `;

  skillsWithScores.forEach(skill => {
    // Determine color intensity based on score
    let colorClass = 'heatmap-cell--weak';
    if (skill.score > 40 && skill.score < 75) {
      colorClass = 'heatmap-cell--medium';
    } else if (skill.score >= 75) {
      colorClass = 'heatmap-cell--strong';
    }

    // Set custom CSS variables for exact color mapping
    // Green hue: 140, Red hue: 0, transition from red to green
    const hue = Math.round((skill.score / 100) * 120); // 0 (red) to 120 (green)
    const colorStyle = `background-color: hsla(${hue}, 70%, 45%, 0.18); border-color: hsla(${hue}, 70%, 45%, 0.4);`;

    html += `
      <div class="heatmap-cell ${colorClass}" style="${colorStyle}" tabindex="0" onclick="showPage('schedule')">
        <div class="heatmap-cell-name">${skill.name}</div>
        <div class="heatmap-cell-score">${skill.score}%</div>
        <div class="heatmap-tooltip" role="tooltip">
          <strong>${skill.name}</strong>
          <div>Confidence: ${skill.score}%</div>
          <div>Studied: ${skill.studyHours} hrs</div>
          <div>Job Demand: Found in ${skill.demandCount} jobs</div>
          <div class="heatmap-tooltip-rec">${skill.recommendation}</div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}
