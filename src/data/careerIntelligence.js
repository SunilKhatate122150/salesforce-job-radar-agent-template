// ES Module


  const DAY_MS = 24 * 60 * 60 * 1000;
  const SAFE_JOB_STATUSES = ['todo', 'applied', 'interview', 'offer', 'rejected'];

  function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function asText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim() || fallback;
  }

  function clampNumber(value, min = 0, max = 100) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function uniqueTexts(values, limit = 12) {
    const seen = new Set();
    const output = [];
    asArray(values).forEach(value => {
      const text = typeof value === 'string'
        ? asText(value)
        : asText(value?.name || value?.skill || value?.topic || value?.label || value?.title);
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return;
      seen.add(key);
      output.push(text);
    });
    return output.slice(0, limit);
  }

  function parseDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function normalizeNow(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    return parseDate(value) || new Date();
  }

  function jobDateCandidates(job) {
    if (!job || typeof job !== 'object') return [];
    return [
      job.updatedAt,
      job.updated_at,
      job.statusUpdatedAt,
      job.last_seen_at,
      job.lastSeenAt,
      job.first_seen_at,
      job.firstSeenAt,
      job.date_added,
      job.dateAdded,
      job.createdAt,
      job.created_at,
      job.posted_at,
      job.postedAt,
      job.appliedAt,
      job.dateApplied
    ];
  }

  function jobTimestamp(job) {
    for (const value of jobDateCandidates(job)) {
      const parsed = parseDate(value);
      if (parsed) return parsed.getTime();
    }
    return 0;
  }

  function sortJobsNewestFirst(jobs) {
    return asArray(jobs).slice().sort((a, b) => {
      const dateDelta = jobTimestamp(b) - jobTimestamp(a);
      if (dateDelta) return dateDelta;
      const scoreDelta = Number(b?.score || b?.match_score || 0) - Number(a?.score || a?.match_score || 0);
      if (scoreDelta) return scoreDelta;
      return asText(b?.id || b?.job_hash).localeCompare(asText(a?.id || a?.job_hash));
    });
  }

  function daysSince(timestamp, now = new Date()) {
    if (!timestamp) return 999;
    return Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS));
  }

  function getJobFreshness(job, now = new Date()) {
    const updated = parseDate(job?.updatedAt || job?.updated_at || job?.statusUpdatedAt || job?.last_seen_at || job?.lastSeenAt);
    const created = parseDate(job?.first_seen_at || job?.firstSeenAt || job?.date_added || job?.dateAdded || job?.createdAt || job?.created_at || job?.posted_at || job?.postedAt);
    const basis = updated || created;
    const age = daysSince(basis ? basis.getTime() : 0, now);
    const hasApplyUrl = Boolean(job?.apply_link || job?.url || job?.applyUrl);
    const score = Number(job?.score || job?.match_score || 0);

    if (!basis || !hasApplyUrl) {
      return { label: 'Needs review', tone: 'review', daysOld: age, reason: 'Missing date or apply link' };
    }
    if (age === 0 && created && now.toDateString() === created.toDateString()) {
      return { label: 'New today', tone: 'new', daysOld: age, reason: 'Created today' };
    }
    if (updated && created && updated.getTime() - created.getTime() > 60 * 60 * 1000 && age <= 7) {
      return { label: 'Updated', tone: 'updated', daysOld: age, reason: 'Refreshed recently' };
    }
    if (age > 14) {
      return { label: 'Stale', tone: 'stale', daysOld: age, reason: 'Older than two weeks' };
    }
    if (score > 0 && score < 55) {
      return { label: 'Needs review', tone: 'review', daysOld: age, reason: 'Low fit score' };
    }
    return { label: 'Active', tone: 'active', daysOld: age, reason: 'Fresh enough for the board' };
  }

  function normalizeStatus(value) {
    const raw = asText(value, 'todo').toLowerCase();
    if (raw === 'new' || raw === 'saved') return 'todo';
    if (raw === 'ignored' || raw === 'archived') return 'rejected';
    return SAFE_JOB_STATUSES.includes(raw) ? raw : 'todo';
  }

  function scoreJob(job) {
    const score = Number(job?.score || job?.match_score || 0);
    return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  }

  function getJobFilterPredicate(filter, now = new Date()) {
    const value = asText(filter, 'all').toLowerCase();
    return function predicate(job) {
      const location = `${job?.loc || ''} ${job?.location || ''}`.toLowerCase();
      const status = normalizeStatus(job?.status);
      const score = scoreJob(job);
      const probability = asText(job?.prob || job?.probability, '').toLowerCase();
      const freshness = getJobFreshness(job, now);
      const resumeActions = asArray(job?.resume_actions || job?.resumeActions);
      if (value === 'all') return true;
      if (value === 'high') return probability === 'high' || score >= 80;
      if (value === 'medium') return probability === 'medium' || (score >= 60 && score < 80);
      if (value === 'stretch') return probability === 'stretch' || score < 60;
      if (value === 'remote') return /\bremote|wfh|work from home\b/i.test(location);
      if (value === 'pune') return location.includes('pune');
      if (value === 'india') return /\bindia|pune|mumbai|bangalore|bengaluru|hyderabad|chennai|delhi|noida|gurgaon|remote\b/i.test(location);
      if (value === 'high_fit') return status === 'todo' && score >= 80;
      if (value === 'resume_ready') return status === 'todo' && resumeActions.length > 0;
      if (value === 'fresh') return freshness.tone === 'new' || freshness.daysOld <= 2;
      if (value === 'followup') return status === 'applied';
      if (value === 'needs_review') return freshness.tone === 'review' || asArray(job?.missing_skills).length > 0;
      return true;
    };
  }

  function extractSourceHealthFromLogs(activityLog) {
    const safeLogs = sortJobsNewestFirst(asArray(activityLog).map((entry, index) => ({
      ...entry,
      updatedAt: entry?.timestamp || entry?.createdAt || entry?.date || index
    })));
    let jobsAdded = 0;
    let jobsRefreshed = 0;
    let failedProviderCount = 0;
    safeLogs.slice(0, 24).forEach(entry => {
      const text = asText(entry?.text).toLowerCase();
      const added = text.match(/synced\s+(\d+)\s+new jobs?/i) || text.match(/(\d+)\s+new jobs?/i);
      const refreshed = text.match(/refreshed\s+(\d+)/i);
      if (added) jobsAdded += Number(added[1] || 0);
      if (refreshed) jobsRefreshed += Number(refreshed[1] || 0);
      if (entry?.type === 'error' || /\b(error|failed|failure|timeout|provider)\b/i.test(text)) failedProviderCount += 1;
    });
    return { safeLogs, jobsAdded, jobsRefreshed, failedProviderCount };
  }

  function buildJobSourceHealth(jobs = [], activityLog = [], now = new Date()) {
    const sortedJobs = sortJobsNewestFirst(jobs);
    const { safeLogs, jobsAdded, jobsRefreshed, failedProviderCount } = extractSourceHealthFromLogs(activityLog);
    const lastLogDate = parseDate(safeLogs[0]?.timestamp || safeLogs[0]?.updatedAt);
    const lastJobDate = sortedJobs[0] ? new Date(jobTimestamp(sortedJobs[0])) : null;
    const lastScanDate = lastLogDate || (lastJobDate && lastJobDate.getTime() ? lastJobDate : null);
    const age = lastScanDate ? daysSince(lastScanDate.getTime(), now) : 999;
    return {
      lastScanAt: lastScanDate ? lastScanDate.toISOString() : null,
      lastScanLabel: lastScanDate ? formatRelativeDate(lastScanDate, now) : 'Not run yet',
      jobsAdded,
      jobsRefreshed,
      failedProviderCount,
      totalTracked: sortedJobs.length,
      nextScanExpectation: age === 999 ? 'Run a scan to start daily updates.' : age >= 1 ? 'Next scan should refresh today.' : 'Next scan expected in the daily automation window.',
      status: failedProviderCount ? 'degraded' : (age > 2 ? 'stale' : 'healthy')
    };
  }

  function formatRelativeDate(date, now = new Date()) {
    if (!date) return 'Not run yet';
    const diff = Math.max(0, now.getTime() - date.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 8) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function summarizeJobs(jobs = [], now = new Date()) {
    const sorted = sortJobsNewestFirst(jobs);
    const todo = sorted.filter(job => normalizeStatus(job?.status) === 'todo');
    const applied = sorted.filter(job => normalizeStatus(job?.status) === 'applied');
    const interview = sorted.filter(job => normalizeStatus(job?.status) === 'interview');
    const highFit = todo.filter(job => scoreJob(job) >= 80);
    const fresh = todo.filter(job => {
      const freshness = getJobFreshness(job, now);
      return freshness.tone === 'new' || freshness.daysOld <= 2;
    });
    const resumeReady = todo.filter(job => asArray(job?.resume_actions || job?.resumeActions).length > 0);
    return { sorted, todo, applied, interview, highFit, fresh, resumeReady };
  }

  function pickWeakTopics(profile = {}, progress = {}, jobs = []) {
    const missing = asArray(profile.missingSkills).map(skill => asText(skill)).filter(Boolean);
    const gapsFromJobs = new Map();
    asArray(jobs).forEach(job => {
      asArray(job?.missing_skills || job?.missingSkills).forEach(skill => {
        const key = asText(skill);
        if (key) gapsFromJobs.set(key, (gapsFromJobs.get(key) || 0) + 1);
      });
    });
    const fromJobs = [...gapsFromJobs.entries()].sort((a, b) => b[1] - a[1]).map(([skill]) => skill);
    const fromProgress = Object.entries(progress?.topics || {})
      .filter(([, topic]) => Number(topic?.confidenceScore || topic?.confidence || 0) < 60)
      .map(([id, topic]) => asText(topic?.name || topic?.topicName || id));
    return [...new Set([...missing, ...fromJobs, ...fromProgress])].slice(0, 6);
  }

  function buildTodayCommandCenter(input = {}) {
    const now = normalizeNow(input.now);
    const profile = input.profile || {};
    const progress = input.progress || {};
    const bookmarks = asArray(input.bookmarks);
    const releases = input.releases || {};
    const jobSummary = summarizeJobs(input.jobs || [], now);
    const weakTopics = pickWeakTopics(profile, progress, jobSummary.sorted);
    const targetRole = asText(profile.targetRole || profile.targetDesignation, 'Salesforce Developer');
    const recommendedTopic = weakTopics[0] || asText(profile.studyPlanTopics?.[0]?.topic || profile.studyPlanTopics?.[0]?.name, 'Apex bulk-safe patterns');
    const releaseItems = asArray(releases.personalizedItems || releases.items).slice(0, 3);

    const actions = [
      {
        id: 'study-focus',
        title: `Study ${recommendedTopic}`,
        detail: `Prepare one crisp explanation and one scenario answer for ${targetRole}.`,
        type: 'study',
        cta: 'Start topic'
      },
      {
        id: 'job-radar',
        title: jobSummary.highFit[0] ? `Apply first: ${asText(jobSummary.highFit[0].company, 'High-fit role')}` : 'Run today job scan',
        detail: jobSummary.highFit[0]
          ? asText(jobSummary.highFit[0].role || jobSummary.highFit[0].title, 'Salesforce role')
          : 'Refresh the board before changing resume priorities.',
        type: 'jobs',
        cta: 'Open radar'
      },
      {
        id: 'resume-profile',
        title: jobSummary.resumeReady.length ? 'Finish resume pack updates' : 'Update resume profile',
        detail: jobSummary.resumeReady.length
          ? `${jobSummary.resumeReady.length} saved role${jobSummary.resumeReady.length === 1 ? '' : 's'} has resume action items.`
          : 'Import or edit your profile so recommendations stay personal.',
        type: 'profile',
        cta: 'Review profile'
      },
      {
        id: 'release-intel',
        title: releaseItems[0] ? `Release focus: ${asText(releaseItems[0].category, 'Salesforce')}` : 'Review release intelligence',
        detail: releaseItems[0]
          ? asText(releaseItems[0].interviewAngle || releaseItems[0].whyMatters, 'Turn the release note into an interview story.')
          : 'Map current Salesforce release updates to your target role.',
        type: 'release',
        cta: 'Study release'
      }
    ];

    const planSeeds = [
      recommendedTopic,
      weakTopics[1] || 'LWC communication',
      jobSummary.highFit[0] ? 'Resume tailoring for high-fit role' : 'Job radar source scan',
      weakTopics[2] || 'Integration retry design',
      bookmarks[0]?.topic || 'Bookmarked Q&A revision',
      releaseItems[0]?.title || 'Release interview prompts',
      'Mock interview and STAR story'
    ];

    return {
      targetRole,
      recommendedTopic,
      weakTopics,
      metrics: {
        jobsTracked: jobSummary.sorted.length,
        highFitJobs: jobSummary.highFit.length,
        freshJobs: jobSummary.fresh.length,
        bookmarks: bookmarks.length,
        releaseItems: releaseItems.length
      },
      actions,
      nextSevenDays: planSeeds.map((topic, index) => ({
        dayOffset: index,
        label: index === 0 ? 'Today' : `Day ${index + 1}`,
        topic: asText(topic),
        focus: index % 3 === 0 ? 'Core' : index % 3 === 1 ? 'Scenario' : 'Application'
      }))
    };
  }

  function buildStudyRoadmap(input = {}) {
    const content = input.content || {};
    const sections = typeof content.getSections === 'function'
      ? content.getSections()
      : asArray(content.sections || content);
    const progress = input.progress || {};
    const bookmarks = asArray(input.bookmarks);
    const tracks = [
      { id: 'apex', label: 'Apex', match: /apex|trigger|soql|sosl|governor/i },
      { id: 'lwc', label: 'LWC', match: /lwc|lightning|ui|record page|navigation/i },
      { id: 'integration', label: 'Integration', match: /integration|rest|soap|platform event|cdc|oauth/i },
      { id: 'security', label: 'Security', match: /security|sharing|crud|fls|permission|user mode/i },
      { id: 'agentforce', label: 'Agentforce', match: /agentforce|prompt|rag|atlas|trust layer/i },
      { id: 'data-cloud', label: 'Data Cloud', match: /data cloud|identity|dlo|dmo|segmentation|activation/i }
    ];

    return tracks.map(track => {
      const matched = sections.filter(section => {
        const haystack = `${section.id || ''} ${section.title || ''} ${asArray(section.tags).join(' ')}`;
        return track.match.test(haystack);
      });
      const core = matched.filter(section => !/scenario|case|fde/i.test(`${section.id || ''} ${section.title || ''}`));
      const scenario = matched.filter(section => !core.includes(section));
      const progressItems = matched.map(section => progress?.topics?.[section.id] || progress?.[section.id]).filter(Boolean);
      const revised = progressItems.filter(item => /revised|mastered/i.test(asText(item.status))).length;
      const mastered = progressItems.filter(item => /mastered/i.test(asText(item.status))).length;
      const bookmarked = bookmarks.filter(bookmark => matched.some(section => section.id === bookmark.sectionId || section.id === bookmark.topic)).length;
      return {
        ...track,
        totalSections: matched.length,
        coreSections: core.length,
        scenarioSections: scenario.length,
        revised,
        mastered,
        bookmarked,
        weak: matched.length > mastered,
        nextTopic: matched.find(section => !progress?.topics?.[section.id])?.title || matched[0]?.title || `${track.label} scenario`
      };
    });
  }

  function buildReleaseStudyActions(releasePayload = {}) {
    const items = asArray(releasePayload.personalizedItems || releasePayload.items);
    const categories = ['Admin', 'Developer', 'Agentforce', 'Data Cloud', 'Security', 'Flow'];
    return categories.map(category => {
      const relevant = items.filter(item => {
        const haystack = `${item.category || ''} ${item.title || ''} ${item.summary || ''} ${item.whyMatters || ''}`.toLowerCase();
        const needle = category.toLowerCase().replace(' ', '');
        return haystack.includes(category.toLowerCase()) || haystack.replace(/\s+/g, '').includes(needle);
      }).slice(0, 4);
      const fallbackTopic = category === 'Developer' ? 'Apex/LWC' : category;
      return {
        category,
        count: relevant.length,
        items: relevant,
        studyTopic: relevant[0]?.topicId || fallbackTopic,
        prompts: [
          `How would you explain this ${category} release update to a project manager?`,
          `Where would you use this ${category} capability in a Salesforce implementation?`,
          `What risks, limits, or tradeoffs should you mention in an interview?`
        ]
      };
    });
  }

  function createMockInterviewSession(input = {}, userId = 'guest') {
    const answers = asArray(input.answers);
    const questions = asArray(input.questions);
    const answered = answers.filter(answer => asText(answer.answerText || answer.text).length > 20).length;
    const score = questions.length ? Math.round((answered / questions.length) * 100) : 0;
    return {
      id: input.id || `mock_${Date.now()}`,
      userId: asText(userId || input.userId, 'guest'),
      role: asText(input.role, 'Salesforce Developer'),
      company: asText(input.company, 'General'),
      topic: asText(input.topic, 'Apex/LWC'),
      questions,
      answers,
      score,
      strengths: answered ? ['Specific examples', 'Clear structure'] : [],
      improvements: score >= 80 ? ['Add tradeoffs and measurable impact'] : ['Answer every question with a concrete project example'],
      createdAt: input.createdAt || new Date().toISOString()
    };
  }

  function summarizeMockInterviewSessions(sessions = []) {
    const sorted = sortJobsNewestFirst(asArray(sessions).map(session => ({
      ...session,
      updatedAt: session.createdAt || session.updatedAt
    })));
    const scores = sorted.map(session => Number(session.score || 0)).filter(Number.isFinite);
    const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
    return {
      sessions: sorted,
      total: sorted.length,
      averageScore,
      latest: sorted[0] || null,
      emptyState: sorted.length ? '' : 'No mock interviews yet. Start your first session.'
    };
  }

  function getStudyReadinessSignals(progress = {}, now = new Date()) {
    const sessions = asArray(progress.sessions || progress.studySessions);
    const topics = progress.topics && typeof progress.topics === 'object' ? progress.topics : {};
    const todayKey = now.toISOString().slice(0, 10);
    const sevenDaysAgo = now.getTime() - (7 * DAY_MS);
    const topicValues = Object.values(topics).filter(Boolean);
    const confidenceValues = topicValues
      .map(topic => Number(topic.confidenceScore || topic.confidence || topic.mastery || 0))
      .filter(value => Number.isFinite(value) && value > 0);

    const todaySeconds = sessions.reduce((sum, session) => {
      const dateText = asText(session?.date || session?.startDate);
      const startedAt = parseDate(session?.startTime || session?.startedAt || session?.createdAt);
      const sessionKey = dateText || (startedAt ? startedAt.toISOString().slice(0, 10) : '');
      return sessionKey === todayKey ? sum + Number(session?.duration || session?.durationSeconds || 0) : sum;
    }, 0);

    const recentSessions = sessions.filter(session => {
      const date = parseDate(session?.endTime || session?.startTime || session?.createdAt || session?.date);
      return date && date.getTime() >= sevenDaysAgo;
    });

    const topicSeconds = topicValues.reduce((sum, topic) => sum + Number(topic?.totalSeconds || topic?.duration || 0), 0);
    const sessionSeconds = sessions.reduce((sum, session) => sum + Number(session?.duration || session?.durationSeconds || 0), 0);
    const studiedTopics = topicValues.filter(topic =>
      Number(topic?.totalSeconds || topic?.duration || 0) > 0 ||
      /revised|mastered|complete/i.test(asText(topic?.status))
    ).length;

    return {
      todaySeconds,
      totalSeconds: topicSeconds + sessionSeconds,
      recentSessions: recentSessions.length,
      studiedTopics,
      averageConfidence: confidenceValues.length
        ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
        : 0
    };
  }

  function summarizeRecommendedJob(job) {
    if (!job) return null;
    return {
      id: asText(job.id || job.job_hash || job._id),
      company: asText(job.company || job.org || job.employer, 'Target company'),
      role: asText(job.role || job.title || job.position, 'Salesforce role'),
      score: scoreJob(job),
      location: asText(job.loc || job.location || job.city, 'Location not listed'),
      reason: asText(job.why_apply || job.reason || job.summary, 'Strongest available Job Radar signal.')
    };
  }

  function summarizeRecommendedTopic(topic, fallback = 'Apex/LWC interview fundamentals') {
    if (!topic) {
      return { label: fallback, topicId: 'study_tracker', reason: 'Keeps core interview readiness moving.' };
    }
    if (typeof topic === 'string') {
      return {
        label: topic,
        topicId: topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'study_tracker',
        reason: 'High-signal gap from your profile or job matches.'
      };
    }
    const label = asText(topic.topic || topic.name || topic.title || topic.topicId, fallback);
    return {
      label,
      topicId: asText(topic.topicId || topic.id || label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), 'study_tracker'),
      reason: asText(topic.reason || topic.desc || topic.description, 'Recommended from your roadmap and market gaps.')
    };
  }

  function buildRisk(title, detail, severity = 'medium', route = 'profile_match', actionLabel = 'Review') {
    return { id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, detail, severity, route, actionLabel };
  }

  function buildSprintItem(id, title, detail, route, priority = 'medium', actionLabel = 'Open', metric = '', complete = false) {
    return { id, title, detail, route, priority, actionLabel, metric, complete };
  }

  function buildCareerReadinessCockpit(input = {}) {
    const now = normalizeNow(input.now);
    const profile = input.profile || {};
    const progress = input.progress || {};
    const jobs = asArray(input.jobs);
    const bookmarks = asArray(input.bookmarks);
    const releases = input.releases || {};
    const releaseItems = asArray(releases.personalizedItems || releases.items);
    const skills = uniqueTexts(profile.skills, 18);
    const certifications = uniqueTexts(profile.certifications || profile.certs, 10);
    const missingSkills = uniqueTexts(profile.missingSkills || profile.skillGaps || profile.gaps, 12);
    const roadmapTopics = asArray(profile.studyPlanTopics || profile.roadmapTopics);
    const targetRole = asText(profile.targetRole || profile.targetDesignation, 'Salesforce Developer');
    const experienceYears = clampNumber(profile.experienceYears || profile.yearsOfExperience || 0, 0, 20);
    const jobSummary = summarizeJobs(jobs, now);
    const sourceHealth = buildJobSourceHealth(jobs, input.activityLog || [], now);
    const studySignals = getStudyReadinessSignals(progress, now);
    const weakTopics = pickWeakTopics(profile, progress, jobSummary.sorted);
    const bestJob = summarizeRecommendedJob(jobSummary.highFit[0] || jobSummary.fresh[0] || jobSummary.todo[0] || jobSummary.sorted[0]);
    const nextTopic = summarizeRecommendedTopic(
      weakTopics[0] || roadmapTopics[0] || missingSkills[0],
      missingSkills[0] || 'Apex/LWC interview fundamentals'
    );

    const profileScore = clampNumber(
      (skills.length * 6) +
      (certifications.length * 9) +
      (targetRole ? 12 : 0) +
      (experienceYears ? 10 : 0) +
      Math.min(18, roadmapTopics.length * 3) -
      (missingSkills.length * 3),
      0,
      100
    );
    const marketScore = clampNumber(
      (jobSummary.highFit.length * 20) +
      (jobSummary.fresh.length * 10) +
      (jobSummary.applied.length * 8) +
      (jobSummary.interview.length * 14) +
      (jobSummary.resumeReady.length ? 10 : 0) +
      (sourceHealth.status === 'healthy' ? 12 : sourceHealth.status === 'degraded' ? 4 : 0),
      jobs.length ? 8 : 0,
      100
    );
    const studyScore = clampNumber(
      Math.min(36, studySignals.todaySeconds / 60) +
      Math.min(22, studySignals.totalSeconds / 1800) +
      Math.min(18, studySignals.recentSessions * 4) +
      Math.min(14, studySignals.studiedTopics * 2) +
      Math.min(10, studySignals.averageConfidence / 10),
      0,
      100
    );
    const momentumScore = clampNumber(
      (bookmarks.length * 4) +
      (releaseItems.length * 5) +
      (jobSummary.applied.length * 8) +
      (jobSummary.interview.length * 14) +
      (jobSummary.resumeReady.length * 6) +
      (sourceHealth.jobsAdded ? 8 : 0),
      0,
      100
    );
    const overallScore = Math.round(
      (profileScore * 0.25) +
      (marketScore * 0.3) +
      (studyScore * 0.25) +
      (momentumScore * 0.2)
    );

    const stage = overallScore >= 85
      ? 'Interview-ready'
      : overallScore >= 70
        ? 'Market-ready'
        : overallScore >= 50
          ? 'Building traction'
          : 'Setup needed';
    const tone = overallScore >= 75 ? 'green' : overallScore >= 50 ? 'amber' : 'red';

    const risks = [];
    if (skills.length < 4) {
      risks.push(buildRisk('Profile signal is thin', 'Import or edit your profile so role matching has enough Salesforce evidence.', 'high', 'profile_match', 'Update profile'));
    }
    if (!jobs.length) {
      risks.push(buildRisk('Job Radar has no market sample', 'Run a scan before deciding which skills or companies to prioritize.', 'high', 'job_radar', 'Run scan'));
    } else if (sourceHealth.status === 'stale') {
      risks.push(buildRisk('Job data is getting stale', 'Refresh sources so your application queue reflects current postings.', 'medium', 'job_radar', 'Refresh radar'));
    } else if (sourceHealth.status === 'degraded') {
      risks.push(buildRisk('Some job sources need attention', 'Provider failures were detected in recent activity. Review source health before applying heavily.', 'medium', 'job_radar', 'Check sources'));
    }
    if (missingSkills.length >= 3) {
      risks.push(buildRisk('Skill gaps are clustered', `Lead with ${missingSkills.slice(0, 3).join(', ')} in this sprint.`, 'medium', 'study_tracker', 'Start study'));
    }
    if (studySignals.todaySeconds < 1200) {
      risks.push(buildRisk('No focused study block yet', 'Complete at least one 20 minute block before applications or mock interviews.', 'medium', 'study_tracker', 'Start timer'));
    }
    if (jobSummary.highFit.length && !jobSummary.applied.length && !jobSummary.interview.length) {
      risks.push(buildRisk('High-fit roles need conversion', 'Move one strong match from review to applied after tailoring the resume notes.', 'high', 'job_radar', 'Apply now'));
    }

    const sprint = [
      jobs.length
        ? buildSprintItem(
          'radar-apply',
          bestJob ? `Advance ${bestJob.company}` : 'Advance top Job Radar roles',
          bestJob ? `${bestJob.role} is your strongest visible market signal right now.` : 'Review high-fit and fresh roles before they age out.',
          'job_radar',
          jobSummary.highFit.length ? 'high' : 'medium',
          'Open radar',
          `${jobSummary.highFit.length} high fit`,
          jobSummary.applied.length > 0
        )
        : buildSprintItem('radar-scan', 'Run a Job Radar scan', 'Create a fresh market sample before changing the study plan.', 'job_radar', 'high', 'Scan roles', '0 jobs'),
      buildSprintItem(
        'study-focus',
        `Study ${nextTopic.label}`,
        nextTopic.reason,
        nextTopic.topicId || 'study_tracker',
        missingSkills.length ? 'high' : 'medium',
        'Start study',
        `${Math.round(studySignals.todaySeconds / 60)}m today`,
        studySignals.todaySeconds >= 1200
      ),
      buildSprintItem(
        'profile-proof',
        jobSummary.resumeReady.length ? 'Finish resume proof points' : 'Strengthen profile proof points',
        jobSummary.resumeReady.length
          ? `${jobSummary.resumeReady.length} role${jobSummary.resumeReady.length === 1 ? '' : 's'} has resume action items waiting.`
          : 'Add quantified Apex, LWC, Flow, integration, or support outcomes to improve matching.',
        'profile_match',
        skills.length < 4 || jobSummary.resumeReady.length ? 'high' : 'medium',
        'Update profile',
        `${skills.length} skills`,
        skills.length >= 6
      ),
      buildSprintItem(
        'mock-interview',
        'Run one mock interview rep',
        `Use ${targetRole} prompts and include one project tradeoff, metric, and risk.`,
        'ai_interview',
        overallScore >= 65 ? 'medium' : 'low',
        'Practice',
        stage,
        false
      )
    ];

    if (releaseItems[0]) {
      sprint.push(buildSprintItem(
        'release-brief',
        `Turn ${asText(releaseItems[0].category, 'release')} into an answer`,
        asText(releaseItems[0].interviewAngle || releaseItems[0].whyMatters, 'Convert a release note into a crisp implementation story.'),
        releaseItems[0].topicId || 'salesforce_releases',
        'low',
        'Study release',
        `${releaseItems.length} updates`,
        false
      ));
    }

    return {
      generatedAt: now.toISOString(),
      targetRole,
      overallScore,
      stage,
      tone,
      components: [
        { id: 'profile', label: 'Profile', score: Math.round(profileScore), detail: `${skills.length} skills, ${certifications.length} certs` },
        { id: 'market', label: 'Market', score: Math.round(marketScore), detail: `${jobSummary.highFit.length} high-fit, ${jobSummary.fresh.length} fresh` },
        { id: 'study', label: 'Study', score: Math.round(studyScore), detail: `${Math.round(studySignals.todaySeconds / 60)}m today` },
        { id: 'momentum', label: 'Momentum', score: Math.round(momentumScore), detail: `${bookmarks.length} bookmarks, ${releaseItems.length} releases` }
      ],
      sourceHealth,
      signals: {
        skills: skills.length,
        certifications: certifications.length,
        missingSkills,
        jobsTracked: jobs.length,
        highFitJobs: jobSummary.highFit.length,
        resumeReadyJobs: jobSummary.resumeReady.length,
        todayStudyMinutes: Math.round(studySignals.todaySeconds / 60),
        recentStudySessions: studySignals.recentSessions,
        releaseItems: releaseItems.length,
        bookmarks: bookmarks.length
      },
      bestJob,
      nextTopic,
      risks: risks.slice(0, 4),
      sprint: sprint.slice(0, 5)
    };
  }

  function searchCareerContent(query, input = {}) {
    const term = asText(query).toLowerCase();
    if (!term) return [];
    const content = input.content || {};
    const sections = typeof content.getSections === 'function'
      ? content.getSections()
      : asArray(content.sections || content);
    const results = [];
    sections.forEach(section => {
      const sectionText = `${section.title || ''} ${section.description || ''} ${asArray(section.tags).join(' ')}`.toLowerCase();
      if (sectionText.includes(term)) {
        results.push({ type: 'section', sectionId: section.id, title: section.title, preview: section.description, difficulty: section.difficulty, tags: asArray(section.tags).slice(0, 4) });
      }
      asArray(section.questions).forEach(question => {
        const haystack = `${question.question || ''} ${question.scenario || ''} ${question.shortAnswer || ''} ${asArray(question.tags).join(' ')} ${question.difficulty || ''} ${question.roleLevel || ''}`.toLowerCase();
        if (!haystack.includes(term)) return;
        results.push({
          type: 'question',
          sectionId: section.id,
          questionId: question.id,
          title: question.question,
          preview: question.scenario || question.shortAnswer,
          difficulty: question.difficulty || section.difficulty,
          tags: asArray(question.tags || section.tags).slice(0, 4)
        });
      });
    });
    return results.slice(0, 60);
  }

  const api = {
    DAY_MS,
    asArray,
    parseDate,
    jobTimestamp,
    sortJobsNewestFirst,
    getJobFreshness,
    getJobFilterPredicate,
    buildJobSourceHealth,
    buildTodayCommandCenter,
    buildStudyRoadmap,
    buildReleaseStudyActions,
    createMockInterviewSession,
    buildCareerReadinessCockpit,
    summarizeMockInterviewSessions,
    searchCareerContent
  };

export const SFJR_CAREER_INTELLIGENCE = Object.freeze(api);
if (typeof window !== 'undefined') window.SFJR_CAREER_INTELLIGENCE = SFJR_CAREER_INTELLIGENCE;
if (typeof globalThis !== 'undefined') globalThis.SFJR_CAREER_INTELLIGENCE = SFJR_CAREER_INTELLIGENCE;
