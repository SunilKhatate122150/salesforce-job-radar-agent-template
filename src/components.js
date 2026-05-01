/**
 * 🧱 INDUSTRIAL COMPONENT REGISTRY (v1412)
 * ---------------------------------------
 * This file contains all UI template logic. 
 * Decoupling presentation from logic allows for better performance 
 * and a modular "Generic Solution" architecture.
 */

function renderUserProfile(user) {
  if (!user) return;
  const container = document.getElementById('floatingProfileContainer');
  const avatarImg = document.getElementById('floatAvatarImg');
  const dropName = document.getElementById('floatFullTitle');
  const dropEmail = document.getElementById('floatEmailTitle');
  const sidebarPic = document.getElementById('userPicture');
  const sidebarName = document.getElementById('userName');
  const sidebarEmail = document.getElementById('userEmail');
  const sidebarWrap = document.getElementById('userProfile');

  let profilePic = user.picture;
  if (profilePic && profilePic.includes('googleusercontent.com')) {
    profilePic = profilePic.replace(/=s\d+-c/, '=s120-c');
  }

  if (container) container.style.display = 'block';
  if (avatarImg) {
    avatarImg.src = profilePic || generateInitialsAvatar(user.name);
    avatarImg.onerror = function() { this.src = generateInitialsAvatar(user.name); };
  }
  if (dropName) dropName.textContent = user.name;
  if (dropEmail) dropEmail.textContent = user.email;
  if (sidebarWrap) sidebarWrap.style.display = 'flex';
  if (sidebarPic) sidebarPic.src = profilePic || generateInitialsAvatar(user.name);
  if (sidebarName) sidebarName.textContent = user.name;
  if (sidebarEmail) sidebarEmail.textContent = user.email;
}

function renderProfileMatchPage(profile) {
  const contentDiv = document.getElementById('profileMatchContent');
  const syncCta = document.getElementById('syncCtaCards');
  const sourceHeading = document.getElementById('profileSourceHeading');
  const loadingEl = document.getElementById('profileMatchLoading');
  if (!contentDiv) return;

  if (loadingEl) loadingEl.style.display = 'none';
  updateSidebarProfileStatus(profile);
  updateSyncModalUI(profile);

  const showProfileSources = !(profile.skills && profile.skills.length > 0);
  if (syncCta) syncCta.style.display = showProfileSources ? 'grid' : 'none';
  if (sourceHeading) sourceHeading.style.display = showProfileSources ? 'flex' : 'none';

  const skills = profile.skills || [];
  const certs = profile.certifications || [];
  const missing = profile.missingSkills || [];
  const topics = profile.studyPlanTopics || [];
  const platforms = profile.platforms || {};
  const strength = updateProfileStrengthMeter(skills.length, missing.length, profile);

  let syncBadges = '';
  if (platforms.linkedin && platforms.linkedin.synced) {
    syncBadges += '<span class="badge badge-linkedin">LinkedIn Synced</span> ';
  }
  if (platforms.naukri && platforms.naukri.synced) {
    syncBadges += '<span class="badge badge-naukri">Naukri Synced</span>';
  }

  let html = `<div class="content-card unified-career-intelligence">
    <div class="career-summary-card">
      <div class="card-icon-bg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3"></path><path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5"></path></svg>
      </div>
      <div class="card-header-row">
        <div>
          <div class="eyebrow">CAREER PROFILE SUMMARY</div>
          <div class="headline-sm">Career Readiness: ${strength > 80 ? 'Exceptional' : strength > 50 ? 'Strong' : 'Developing'}</div>
        </div>
        <button onclick="document.getElementById('syncCtaCards').style.display='grid';document.getElementById('profileSourceHeading').style.display='flex'" class="btn-ghost-sm">Update Profile</button>
      </div>
      <p class="card-desc">
        Your profile successfully aggregates data from <b>${Object.values(platforms || {}).filter(p => p.synced).length}</b> platforms. 
        We have identified <b>${skills.length} core competencies</b> and <b>${missing.length} strategic gaps</b>. 
      </p>
    </div>

    <div class="profile-grid profile-metrics-grid">
      <div class="metric-card">
        <div class="progress-ring">
          <svg viewBox="0 0 36 36"><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3" /><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--blue)" stroke-width="3" stroke-dasharray="${strength}, 100" /></svg>
          <div class="progress-val">${strength}%</div>
        </div>
        <div>
          <div class="card-title-sm">Ready for ${profile.targetRole || 'Salesforce Developer'}</div>
          <div class="card-sub-xs">Target Achievement</div>
        </div>
      </div>
      
      <div class="metric-card jc-sb">
        <div class="min-w-0">
          <div class="card-title-lg truncate">${profile.currentRole || 'Salesforce Professional'}</div>
          <div class="card-sub-sm">${profile.experienceYears || 0} Years Exp &bull; ${certs.length} Certs</div>
        </div>
        <div class="badge-stack">
          ${syncBadges}
        </div>
      </div>
    </div>`;

  if (certs && certs.length > 0) {
    html += `<div class="section-block">
      <div class="section-title-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#facc15;"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg> Achievements & Certifications</div>
      <div class="tag-cloud">${certs.map(c => `<span class="tag tag-gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> ${c}</span>`).join('')}</div>
    </div>`;
  }

  html += `<div class="section-block">
    <div class="section-title-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--pink);"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.04-2.44V7.5A2.5 2.5 0 0 1 7.5 5h2z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.04-2.44V7.5A2.5 2.5 0 0 0 16.5 5h-2z"></path></svg> Your Skills (${skills.length})</div>
    <div class="tag-cloud">${skills.map(s => `<span class="tag tag-blue">${s}</span>`).join('')}</div>
  </div>`;

  if (missing.length > 0) {
    html += `<div class="section-block">
      <div class="section-title-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--amber);"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg> Identified Skill Gaps (${missing.length})</div>
      <div class="tag-cloud">${missing.map(s => `<span class="tag tag-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"></polyline></svg> ${s}</span>`).join('')}</div>
    </div>`;
  }

  if (topics.length > 0) {
    html += `<div class="section-block">
      <div class="section-title-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--blue);"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 20H20v2H6.5A2.5 2.5 0 0 1 4 17.5v-15A2.5 2.5 0 0 1 6.5 0z"></path></svg> AI Recommended Study Topics</div>
      <div class="universal-grid">`;
    topics.forEach(t => {
      const topicName = extractIndustrialTopicName(t) || 'Career Specialization';
      const rawPriority = (t.priority || 'medium').toLowerCase();
      const topicId = t.topicId || topicName.toLowerCase().replace(/\s+/g, '_');
      html += `<div onclick="showPage('${topicId}')" class="roadmap-topic-card" data-priority="${rawPriority}">
        <div class="topic-card-head">
          <span class="topic-name">${topicName}</span>
          <span class="priority-badge">${rawPriority}</span>
        </div>
        <div class="topic-reason">${t.reason || ''}</div>
        <div class="topic-meta">
          <span class="est-time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${t.estimatedHours || 0}h est</span>
          <span class="start-prep">Start Prep <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></span>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  }

  if (profile.studyPlan) {
    html += `<div class="study-plan-block">
      <div class="plan-header">
        <div class="plan-title-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
          <span class="plan-title">Dynamic AI Study Roadmap</span>
          <span class="ai-pill">AI</span>
        </div>
      </div>
      <div class="plan-content">${window.marked ? marked.parse(profile.studyPlan) : profile.studyPlan}</div>
      <div class="plan-refinement">
        <div class="refine-title">🎯 Refine Your Roadmap</div>
        <div class="refine-row">
          <input type="text" id="aiRoadmapTarget" placeholder="e.g. Senior LWC Developer with Data Cloud">
          <button id="btnRegenerateRoadmap" onclick="regenerateAIStudyPlan()" class="btn-primary-sm">Generate New Plan</button>
        </div>
      </div>
    </div>`;
  }

  html += '<div id="premiumRoadmapMount" class="premium-roadmap-mount"><div class="premium-loading">Loading premium roadmap and release focus...</div></div>';
  html += '</div>';
  contentDiv.innerHTML = html;
  hydratePremiumSetupForm(profile);
  bindPremiumPreviewControls();
  applyUiMode(profile.uiMode || currentUiMode || 'modern');
  
  loadPremiumRoadmap(true).then(data => {
    const mount = document.getElementById('premiumRoadmapMount');
    if (mount && data) {
        mount.innerHTML = renderPremiumRoadmapSection(data) + renderPremiumReleaseFocusSection(data);
    }
  }).catch(err => {
    console.error('[ROADMAP] Mount failure:', err);
    const mount = document.getElementById('premiumRoadmapMount');
    if (mount) mount.innerHTML = '<div class="premium-empty">Roadmap preview is unavailable right now.</div>';
  });
}

function extractIndustrialTopicName(topic) {
  if (typeof topic === 'string') return topic;
  if (topic.name) return topic.name;
  if (topic.topicId) {
     return topic.topicId.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return 'Study Topic';
}

function renderPremiumRoadmapSection(data) {
  const roadmap = data.roadmap || {};
  const topics = roadmap.topics || [];
  const designation = data.designation?.label || 'Salesforce Developer';
  const exp = data.experienceYears || 1;

  return `
    <div class="premium-roadmap-shell">
      <div class="premium-roadmap-hero">
        <div>
          <div class="premium-eyebrow">Curated Career Roadmap</div>
          <h3>${roadmap.roadmapName || 'Industry Standard'}</h3>
          <p>Optimized for ${exp} year experience in ${designation}.</p>
        </div>
        ${data.previewMode ? '<span class="premium-badge">Curated Preview</span>' : ''}
      </div>
      <div class="premium-roadmap-grid">
        ${topics.map((t, idx) => `
          <div class="premium-roadmap-node ${t.status || 'upcoming'}">
            <div class="node-index">${idx + 1}</div>
            <div class="node-content">
              <h4>${t.name}</h4>
              <p>${t.desc}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderPremiumReleaseFocusSection(data) {
  const focus = data.releaseFocus || {};
  const items = focus.items || [];
  
  if (items.length === 0) return '';

  return `
    <div class="premium-release-focus">
      <div class="premium-eyebrow">Strategic Release Focus</div>
      <h3>${focus.focusTitle || 'Current Market Impact'}</h3>
      <div class="premium-release-grid">
        ${items.map(item => `
          <article class="premium-release-card personalized">
            <span class="premium-release-cat">${item.category}</span>
            <h4>${item.title}</h4>
            <p>${item.whyMatters}</p>
            <div class="premium-release-meta">
              <button onclick="showPage('${item.topicId || 'salesforce_releases'}')" class="btn-ghost-xs">Study Details</button>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderReleaseCenterPage(data) {
  const container = document.getElementById('releaseCenterContent');
  if (!container) return;
  const active = data?.activeRelease || {};
  const personalized = data?.personalizedItems || [];
  const allItems = data?.items || [];
  const exp = data?.experienceYears || 1;
  const designation = data?.designation?.label || 'Salesforce Developer';
  const categories = Array.from(new Set(allItems.map(item => item.category))).filter(Boolean);

  container.innerHTML = `
    <div class="premium-release-hero">
      <div>
        <div class="premium-eyebrow">Always-On Release Intelligence</div>
        <h2>${active.releaseName || 'Current Release'}</h2>
        <p>Personalized for ${exp} year experience and ${designation}. Last checked: ${active.lastChecked || 'Not available'}.</p>
      </div>
      <div class="premium-release-source-list">
        ${data?.previewMode ? '<span class="premium-badge">Curated Preview</span>' : ''}
        ${(active.sources || []).map(url => `<a href="${url}" target="_blank" rel="noopener noreferrer">Official source</a>`).join('')}
      </div>
    </div>
    <div class="premium-mini-panel" style="margin-bottom:16px;">
      <div class="premium-eyebrow">Your Priority Updates</div>
      <div class="premium-release-grid">
        ${personalized.map(item => renderReleaseCard(item, true)).join('') || '<p class="premium-empty">Complete profile setup to personalize release focus.</p>'}
      </div>
    </div>
    ${categories.map(category => `
      <section class="premium-release-category">
        <h3>${category}</h3>
        <div class="premium-release-grid">
          ${allItems.filter(item => item.category === category).map(item => renderReleaseCard(item, false)).join('')}
        </div>
      </section>
    `).join('')}
  `;
}

function renderReleaseCard(item, personalized) {
  const levels = (item.experienceLevels || []).join(', ') || 'all';
  const relevance = personalized
    ? 'High for your selected experience/designation'
    : `Relevant for ${levels} year profiles`;
  return `
    <article class="premium-release-card ${personalized ? 'personalized' : ''}">
      <span class="premium-release-cat">${item.category} · ${item.releaseName}</span>
      <h4>${item.title}</h4>
      <p>${item.whatChanged}</p>
      <div class="premium-release-detail"><strong>Why it matters:</strong> ${item.whyMatters}</div>
      <div class="premium-release-detail"><strong>Interview angle:</strong> ${item.interviewAngle}</div>
      <div class="premium-release-detail"><strong>Relevance:</strong> ${relevance}</div>
      <div class="premium-release-meta">
        <span>Last checked: ${item.lastChecked || 'Not available'}</span>
        <a href="${item.source}" target="_blank" rel="noopener noreferrer">Source</a>
      </div>
      <button onclick="showPage('${item.topicId || 'salesforce_releases'}')">Study topic</button>
    </article>
  `;
}

function renderJobIntelligence(data) {
  const matchedSkills = data.matched_skills || [];
  const missingSkills = data.missing_skills || [];

  if (matchedSkills.length === 0 && missingSkills.length === 0) {
    return `
      <div style="text-align:center; padding:20px; color:var(--muted); font-size:0.82rem;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px;margin-bottom:10px;opacity:0.4;">
          <circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <div>No job scan data available yet. Run a Global Job Scan to see market intelligence.</div>
      </div>`;
  }

  let html = '<div style="margin-bottom:20px;">';
  html += '<div style="font-size:0.75rem; color:var(--muted); margin-bottom:12px; text-transform:uppercase; letter-spacing:1px; font-weight:700;">Market Alignment Heatmap</div>';
  
  const topSkills = [...matchedSkills.slice(0,4).map(s => ({...s, type: 'match'})), ...missingSkills.slice(0,4).map(s => ({...s, type: 'gap'}))]
    .sort((a, b) => b.count - a.count);
    
  topSkills.forEach(s => {
    const name = s._id || s;
    const count = s.count || 1;
    const isMatch = s.type === 'match';
    const maxCount = topSkills[0]?.count || 10;
    const widthPercent = Math.max(15, Math.min(100, (count / maxCount) * 100));
    
    const barColor = isMatch ? 'linear-gradient(90deg, rgba(16,185,129,0.2), rgba(16,185,129,0.8))' : 'linear-gradient(90deg, rgba(245,158,11,0.2), rgba(245,158,11,0.8))';
    const textColor = isMatch ? '#34d399' : '#fbbf24';
    const icon = isMatch 
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:12px;height:12px;"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:12px;height:12px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>';

    html += `
      <div style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:4px; font-weight:600;">
          <span style="color:${textColor}; display:flex; align-items:center; gap:6px;">${icon} ${name}</span>
          <span style="color:var(--muted); font-family:'IBM Plex Mono'; font-size:0.7rem;">${count} Jobs</span>
        </div>
        <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden;">
          <div style="height:100%; width:${widthPercent}%; background:${barColor}; border-radius:10px; transition:width 1s ease-in-out;"></div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';

  const topGap = missingSkills[0]?._id || 'specialized skills';
  const topMatch = matchedSkills[0]?._id || 'core competencies';
  html += `<div style="margin-top:16px; padding:12px 16px; background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.12); border-radius:10px; font-size:0.78rem; color:rgba(255,255,255,0.7); line-height:1.6;">
    <strong style="color:var(--text);">AI Insight:</strong> Your strongest market match is <strong style="color:#10b981;">${topMatch}</strong>.
    The highest-impact skill to develop is <strong style="color:#fbbf24;">${topGap}</strong> — it appears in ${missingSkills[0]?.count || 'multiple'} job listings you're being matched against.
  </div>`;

  return html;
}

function renderBoard() {
  const cols = ['todo', 'applied', 'interview', 'offer', 'rejected'];
  const searchTerm = (document.getElementById("boardSearch")?.value || '').toLowerCase();
  const filter = window.currentBoardFilter || 'all';
  const pageSize = window.JOB_BOARD_PAGE_SIZE || 10;

  cols.forEach(col => {
    const list = document.getElementById(`list-${col}`);
    const count = document.getElementById(`count-${col}`);
    if (!list) return;

    const filtered = (window.pipelineJobs || [])
      .filter(j => j.status === col)
      .filter(j => filter === 'all' || j.prob === filter)
      .filter(j => !searchTerm || j.company.toLowerCase().includes(searchTerm) || j.role.toLowerCase().includes(searchTerm))
      .sort((a, b) => new Date(b.dateAdded || b.createdAt) - new Date(a.dateAdded || a.createdAt));

    if (count) count.textContent = filtered.length;

    const pages = window.radarBoardPages || { todo: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
    const page = pages[col] || 0;
    const maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
    const start = Math.min(page, maxPage) * pageSize;
    const displayJobs = filtered.slice(start, start + pageSize);

    list.innerHTML = displayJobs.length === 0 ? 
      `<div class="radar-empty-state">No matching roles in this stage.</div>` :
      displayJobs.map(job => renderJobCard(job)).join('');
      
    const pager = document.getElementById(`pager-${col}`);
    if (pager) {
      pager.innerHTML = renderPager(filtered.length, page, pageSize, `setBoardPage('${col}', -1)`, `setBoardPage('${col}', 1)`, true);
    }
  });
}

function getFollowUpStatus(job) {
  if (job.status !== 'applied') return null;
  const lastContact = job.lastContact ? new Date(job.lastContact) : new Date(job.dateAdded);
  const diffDays = Math.floor((new Date() - lastContact) / (1000 * 60 * 60 * 24));
  
  if (diffDays >= 7) return { label: '7d+ No Response', class: 'critical' };
  if (diffDays >= 3) return { label: '3d+ Since Contact', class: 'warning' };
  return null;
}

function renderJobCard(job) {
  const followUp = getFollowUpStatus(job);
  const matchedSkills = job.matched_skills || [];
  const gapSkills = job.missing_skills || [];
  
  const actions = [];
  if (job.status === 'todo') {
    actions.push({ label: 'Apply Now', href: job.url, cls: 'primary' });
    actions.push({ label: 'Mark Applied', onClick: `moveTo('${job.id}', 'applied')`, cls: 'secondary' });
  } else if (job.status === 'applied') {
    actions.push({ label: 'Schedule Interview', onClick: `moveTo('${job.id}', 'interview')`, cls: 'primary' });
    actions.push({ label: 'No Response', onClick: `moveTo('${job.id}', 'todo')`, cls: 'secondary' });
  } else if (job.status === 'interview') {
    actions.push({ label: 'Offer Received', onClick: `moveTo('${job.id}', 'offer')`, cls: 'primary' });
    actions.push({ label: 'Back to Pipeline', onClick: `moveTo('${job.id}', 'applied')`, cls: 'secondary' });
  }

  return `
    <div class="job-card" draggable="true" ondragstart="handleDragStart(event, '${job.id}')" id="card-${job.id}">
      <div class="jcard-head">
        <div class="jcard-company">${job.company}</div>
        <div class="jcard-date">${new Date(job.dateAdded || Date.now()).toLocaleDateString()}</div>
      </div>
      <div class="jcard-role">${job.role}</div>
      ${followUp && job.status === 'applied' ? `<div class="followup-inline ${followUp.class}">${followUp.label}</div>` : ''}
      <div class="jcard-meta-grid">
        <span class="meta-pill">Location: <b>${job.loc || 'India'}</b></span>
        <span class="meta-pill">Exp: <b>${job.experience || '3-5 Yrs'}</b></span>
      </div>
      <div class="jcard-skill-row">
        ${matchedSkills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
        ${gapSkills.map(s => `<span class="skill-gap-tag" onclick="showPage('profile_match')">${s}</span>`).join('')}
      </div>
      <div class="jcard-actions">
        ${actions.map(a => a.href 
          ? `<a href="${a.href}" target="_blank" class="jcard-btn ${a.cls}">${a.label}</a>`
          : `<button class="jcard-btn ${a.cls}" onclick="${a.onClick}">${a.label}</button>`
        ).join('')}
      </div>
    </div>
  `;
}

function renderInsights() {
  const funnel = document.getElementById('funnel-container');
  if (!funnel) return;
  const stages = [
    { label: 'TO APPLY', count: window.pipelineJobs.filter(j => j.status === 'todo').length, color: 'var(--blue)' },
    { label: 'APPLIED', count: window.pipelineJobs.filter(j => j.status === 'applied').length, color: 'var(--green)' },
    { label: 'INTERVIEW', count: window.pipelineJobs.filter(j => j.status === 'interview').length, color: 'var(--amber)' },
    { label: 'OFFER', count: window.pipelineJobs.filter(j => j.status === 'offer').length, color: 'var(--pink)' }
  ];
  const max = Math.max(...stages.map(s => s.count), 1);
  funnel.innerHTML = stages.map(s => `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
      <div style="width:70px; font-size:0.6rem; color:var(--muted); font-weight:800;">${s.label}</div>
      <div style="flex:1; background:rgba(255,255,255,0.03); height:10px; border-radius:5px; overflow:hidden;">
        <div style="background:${s.color}; height:100%; width:${(s.count/max)*100}%; transition:width 1s ease;"></div>
      </div>
      <div style="width:20px; font-size:0.75rem; font-weight:800;">${s.count}</div>
    </div>
  `).join('');
}

function renderDevelopment() {
  const container = document.getElementById('radar-development-view');
  if (!container) return;
  
  const phases = [
    { name: 'Phase 1: Foundation', status: 'completed', desc: 'Core agent logic and environment setup.' },
    { name: 'Phase 2: Job Fetching', status: 'completed', desc: 'LinkedIn & Naukri integration with deduplication.' },
    { name: 'Phase 3: AI Matching', status: 'in-progress', desc: 'Resume tailoring and skill gap analysis.' },
    { name: 'Phase 4: Auto-Apply', status: 'pending', desc: 'One-click application and tracking.' },
    { name: 'Phase 5: Smart Analytics', status: 'pending', desc: 'Market trend reporting and ROI tracking.' }
  ];

  const skillProficiency = [
    { skill: 'Apex & SOQL', value: 92 },
    { skill: 'LWC & Frontend', value: 85 },
    { skill: 'Integration & APIs', value: 78 },
    { skill: 'Data Cloud', value: 65 },
    { skill: 'Agentforce', value: 58 }
  ];

  container.innerHTML = `
    <div class="development-view">
      <div class="dev-header">
        <div class="dev-eyebrow">Project Evolution</div>
        <h2>Agent Capabilities & Roadmap</h2>
      </div>
      
      <div class="dev-grid">
        <div class="dev-panel">
          <h3>Skill Proficiency</h3>
          <div class="proficiency-list">
            ${skillProficiency.map(s => `
              <div class="proficiency-item">
                <div class="item-info">
                  <span>${s.skill}</span>
                  <span class="item-val">${s.value}%</span>
                </div>
                <div class="item-bar">
                  <div class="bar-fill" style="width:${s.value}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="dev-panel">
          <h3>Deployment Readiness</h3>
          <div class="readiness-list">
            ${phases.map(p => `
              <div class="readiness-item ${p.status}">
                <div class="item-dot">
                  ${p.status === 'completed' ? '✓' : p.status === 'in-progress' ? '▶' : '○'}
                </div>
                <div class="item-content">
                  <div class="item-name">${p.name}</div>
                  <div class="item-desc">${p.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderRevisionAlerts() {
  const container = document.getElementById('revisionAlerts');
  if (!container) return;
  const today = new Date();
  const due = Object.entries(window.userRetention || {}).filter(([id, s]) => new Date(s.nextReview) <= today);
  if (due.length === 0) {
    container.innerHTML = '';
    return;
  }
  let html = `<div class="premium-eyebrow" style="color:var(--purple); margin-bottom:10px;">RECOMMENDED REVISIONS</div>`;
  due.forEach(([id, s]) => {
    const name = (window.topicConfig && window.topicConfig[id]) ? window.topicConfig[id].name : id;
    html += `
      <div onclick="showPage('${id}')" style="background:rgba(167,139,250,0.08); border:1px solid rgba(167,139,250,0.2); border-radius:10px; padding:10px 12px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; cursor:pointer; transition:all 0.2s;">
        <div style="font-size:0.8rem; font-weight:600; color:var(--text);">${name}</div>
        <div style="font-size:0.65rem; color:var(--purple); font-family:'IBM Plex Mono',monospace;">Due Now</div>
      </div>`;
  });
  container.innerHTML = html;
}

function renderLog() {
  const body = document.getElementById('logBody');
  if (!body) return;
  const log = window.activityLog || [];
  const pageSize = window.LOG_PAGE_SIZE || 10;
  const page = window.activityLogPage || 0;
  const start = page * pageSize;
  const pageItems = log.slice(start, start + pageSize);

  if (!pageItems.length) {
    body.innerHTML = '<div style="color:var(--muted); font-size:0.78rem; padding:10px 0;">No activity yet.</div>';
    return;
  }

  body.innerHTML = pageItems.map(item => `
    <div class="log-entry">
      <div class="log-entry-meta">
        <span>${new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        <span style="color:${item.type==='success'?'var(--green)':item.type==='ai'?'var(--blue)':'var(--muted)'}">${(item.type || 'info').toUpperCase()}</span>
      </div>
      <div class="log-entry-text">${item.text}</div>
    </div>
  `).join('') + renderPager(log.length, page, pageSize, 'setLogPage(-1)', 'setLogPage(1)');
}

function renderPager(total, current, size, prevCmd, nextCmd, isMini = false) {
  const max = Math.max(0, Math.ceil(total / size) - 1);
  if (max <= 0) return '';
  return `
    <div class="industrial-pager ${isMini ? 'mini' : ''}">
      <button onclick="${prevCmd}" ${current === 0 ? 'disabled' : ''} class="pager-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <span class="pager-info">${current + 1} / ${max + 1}</span>
      <button onclick="${nextCmd}" ${current >= max ? 'disabled' : ''} class="pager-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </div>
  `;
}
