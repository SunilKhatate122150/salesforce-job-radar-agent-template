const SKILL_ALIASES = {
  apex: ["apex", "apex class"],
  lwc: [
    "lwc",
    "lightning web component",
    "lightning web components"
  ],
  visualforce: ["visualforce", "vf page"],
  soql: ["soql"],
  sosl: ["sosl"],
  flows: ["flow", "flows", "salesforce flow"],
  triggers: ["trigger", "triggers", "apex trigger"],
  integration: ["integration", "integrations", "rest api", "soap api"],
  cpq: ["cpq", "salesforce cpq"],
  salesCloud: ["sales cloud"],
  serviceCloud: ["service cloud"],
  experienceCloud: ["experience cloud", "community cloud"],
  commerceCloud: ["commerce cloud"],
  fieldService: ["field service", "field service lightning", "fsl"],
  admin: ["salesforce admin", "administrator"],
  devops: ["devops", "copado", "gearset", "ci/cd", "ci cd"],
  git: ["git", "github", "gitlab", "bitbucket"],
  javascript: ["javascript", "js", "ecmascript"],
  htmlCss: ["html", "css"],
  aura: ["aura", "lightning component"],
  omniStudio: ["omnistudio", "vlocity"],
  dataMigration: ["data migration", "dataloader", "data loader"],
  sfdc: ["sfdc", "salesforce"]
};

const ROLE_KEYWORDS = [
  "salesforce developer",
  "sfdc developer",
  "apex developer",
  "lwc developer",
  "salesforce engineer",
  "salesforce consultant"
];

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseSkillList(value) {
  return uniqueList(
    String(value || "")
      .split(",")
      .map(skill => normalizeText(skill))
      .filter(Boolean)
  );
}

function mapSkillAliases(inputSkill) {
  const text = normalizeText(inputSkill);
  if (!text) return "";

  for (const [skillKey, aliases] of Object.entries(SKILL_ALIASES)) {
    if (skillKey === text) return skillKey;
    if (aliases.some(alias => text.includes(alias))) return skillKey;
  }

  return text;
}

function extractKnownSkills(text) {
  const normalized = normalizeText(text);
  const found = [];

  for (const [skillKey, aliases] of Object.entries(SKILL_ALIASES)) {
    if (
      aliases.some(alias => normalized.includes(alias)) ||
      normalized.includes(skillKey)
    ) {
      found.push(skillKey);
    }
  }

  return uniqueList(found);
}

function parseExperienceRange(experienceText) {
  const text = normalizeText(experienceText);
  if (!text) return null;

  const rangeMatch = text.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return { min, max };
    }
  }

  const plusMatch = text.match(/(\d+)\s*\+/);
  if (plusMatch) {
    const min = Number(plusMatch[1]);
    if (Number.isFinite(min)) {
      return { min, max: min + 3 };
    }
  }

  const singleMatch = text.match(/(\d+)/);
  if (singleMatch) {
    const year = Number(singleMatch[1]);
    if (Number.isFinite(year)) {
      return { min: year, max: year };
    }
  }

  return null;
}

function scoreExperience(profileYears, experienceRange) {
  if (!Number.isFinite(profileYears) || !experienceRange) return 10;

  if (profileYears >= experienceRange.min && profileYears <= experienceRange.max) {
    return 15;
  }

  const distance = Math.min(
    Math.abs(profileYears - experienceRange.min),
    Math.abs(profileYears - experienceRange.max)
  );

  if (distance <= 1) return 10;
  if (distance <= 2) return 7;
  return 3;
}

function scoreRole(profileRole, job) {
  const titleText = normalizeText(job.title);
  const roleText = normalizeText(profileRole);
  const combined = normalizeText(`${job.title} ${job.description} ${job.skills}`);

  if (roleText && (titleText.includes(roleText) || combined.includes(roleText))) {
    return 25;
  }

  if (ROLE_KEYWORDS.some(keyword => titleText.includes(keyword))) {
    return 22;
  }

  if (titleText.includes("salesforce") && titleText.includes("developer")) {
    return 20;
  }

  if (combined.includes("salesforce")) return 14;
  return 8;
}

function scoreSkills(profileSkills, jobSkills) {
  if (jobSkills.length === 0) return { score: 30, matched: [], missing: [] };

  const profileSet = new Set(profileSkills);
  const matched = jobSkills.filter(skill => profileSet.has(skill));
  const missing = jobSkills.filter(skill => !profileSet.has(skill));
  const coverage = matched.length / jobSkills.length;
  const score = Math.round(coverage * 60);

  return {
    score,
    matched,
    missing
  };
}

function formatSkillLabel(skill) {
  const labelMap = {
    lwc: "LWC",
    soql: "SOQL",
    sosl: "SOSL",
    sfdc: "SFDC",
    cpq: "CPQ",
    devops: "DevOps",
    htmlCss: "HTML/CSS",
    omniStudio: "OmniStudio",
    salesCloud: "Sales Cloud",
    serviceCloud: "Service Cloud",
    experienceCloud: "Experience Cloud",
    commerceCloud: "Commerce Cloud",
    fieldService: "Field Service",
    dataMigration: "Data Migration"
  };

  if (labelMap[skill]) return labelMap[skill];
  return skill
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildResumeActions({
  missingSkills,
  matchScore,
  profileYears,
  experienceRange
}) {
  const actions = [];

  if (missingSkills.length > 0) {
    const top = missingSkills.slice(0, 3).map(formatSkillLabel).join(", ");
    actions.push(`Add these skills in resume if you know them: ${top}.`);
  }

  if (Number.isFinite(profileYears) && experienceRange) {
    if (profileYears < experienceRange.min) {
      actions.push(
        `Show projects that prove you can handle ${experienceRange.min}+ years level work.`
      );
    } else if (profileYears > experienceRange.max + 1) {
      actions.push(
        "Tailor summary for this role level and remove over-senior wording."
      );
    }
  }

  if (matchScore < 70) {
    actions.push(
      "Add 2-3 Salesforce project bullets with numbers (impact, users, automation count)."
    );
  }

  actions.push("Keep resume title aligned to role: Salesforce Developer.");
  return uniqueList(actions).slice(0, 3);
}

function describeExperienceFit(profileYears, experienceRange) {
  if (!Number.isFinite(profileYears) || !experienceRange) {
    return "Experience requirement is not clearly specified, so role and skills carry more weight.";
  }

  if (profileYears >= experienceRange.min && profileYears <= experienceRange.max) {
    return `Your experience fits the ${experienceRange.min}-${experienceRange.max} years range.`;
  }

  const distance = Math.min(
    Math.abs(profileYears - experienceRange.min),
    Math.abs(profileYears - experienceRange.max)
  );

  if (distance <= 1) {
    return `Your experience is close to the ${experienceRange.min}-${experienceRange.max} years range.`;
  }

  if (profileYears < experienceRange.min) {
    return `Your profile is below the ${experienceRange.min}-${experienceRange.max} years range, so project proof matters.`;
  }

  return `Your profile is above the ${experienceRange.min}-${experienceRange.max} years range, so role-level positioning matters.`;
}

function buildWhyMatched({
  job,
  profile,
  skillsResult,
  experienceRange,
  roleScore
}) {
  const reasons = [];
  const titleText = normalizeText(job.title);
  const profileRole = normalizeText(profile.role);

  if (skillsResult.matched.length > 0) {
    reasons.push(
      `Matched skills: ${skillsResult.matched
        .slice(0, 4)
        .map(formatSkillLabel)
        .join(", ")}.`
    );
  }

  if (
    profileRole &&
    (titleText.includes(profileRole) || titleText.includes("salesforce"))
  ) {
    reasons.push(
      `Job title is aligned with your target role: ${profile.role || "Salesforce Developer"}.`
    );
  } else if (roleScore >= 20) {
    reasons.push("Role keywords strongly match Salesforce developer work.");
  }

  reasons.push(
    describeExperienceFit(profile.years, experienceRange)
  );

  return uniqueList(reasons).slice(0, 3);
}

function buildApplyPriority({ matchScore, isUrgent }) {
  if (isUrgent && matchScore >= 60) return "High";
  if (matchScore >= 75) return "High";
  if (isUrgent || matchScore >= 50) return "Medium";
  return "Low";
}

function buildResumeBulletSuggestions({
  job,
  matchedSkills,
  missingSkills,
  experienceRange,
  profile
}) {
  const normalizedTitle = String(job?.title || "Salesforce Developer").trim();
  const primaryMatched = matchedSkills.slice(0, 3).map(formatSkillLabel);
  const primaryMissing = missingSkills.slice(0, 2).map(formatSkillLabel);
  const suggestions = [];

  suggestions.push(
    `Add one bullet for a ${normalizedTitle} project using ${primaryMatched.join(", ") || "Salesforce platform skills"} with measurable impact such as users supported, time saved, or automation count.`
  );

  if (matchedSkills.includes("integration")) {
    suggestions.push(
      "Add one integration bullet that shows API design, error handling, retries, and system scale."
    );
  } else if (matchedSkills.includes("flows") || matchedSkills.includes("triggers")) {
    suggestions.push(
      "Add one automation bullet that shows how you improved process speed, accuracy, or manual effort using Flow or Apex automation."
    );
  } else {
    suggestions.push(
      "Add one bullet that shows end-to-end feature delivery from requirement analysis to deployment and production support."
    );
  }

  if (primaryMissing.length > 0) {
    suggestions.push(
      `If true, add proof points for ${primaryMissing.join(", ")} in project bullets or the skills section.`
    );
  } else if (experienceRange && Number.isFinite(profile?.years)) {
    suggestions.push(
      `Add one bullet that clearly positions you for the ${experienceRange.min}-${experienceRange.max} years expectation with ownership and business impact.`
    );
  } else {
    suggestions.push(
      `Tailor one bullet directly to ${normalizeText(profile?.role || "salesforce developer")} responsibilities and team impact.`
    );
  }

  return uniqueList(suggestions).slice(0, 3);
}

function scoreLabel(score) {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

function buildPrompt({ job, profile, analysis }) {
  return [
    "You are a resume coach.",
    "Give exactly 3 short, concrete resume improvement actions.",
    "Do not add extra text or bullets outside these 3 lines.",
    "",
    `Candidate role target: ${profile.role || "Salesforce Developer"}`,
    `Candidate years: ${Number.isFinite(profile.years) ? profile.years : "unknown"}`,
    `Candidate skills: ${profile.skills.join(", ") || "not provided"}`,
    "",
    `Job title: ${job.title || ""}`,
    `Job company: ${job.company || ""}`,
    `Job location: ${job.location || ""}`,
    `Job skills text: ${job.skills || ""}`,
    `Job description: ${String(job.description || "").slice(0, 1200)}`,
    "",
    `Current score: ${analysis.match_score}`,
    `Missing skills: ${(analysis.missing_skills || []).join(", ") || "none"}`
  ].join("\n");
}

async function getAiActions({ job, profile, analysis }) {
  if (!isTruthy(process.env.RESUME_AI_ENABLED)) return [];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.RESUME_AI_MODEL || "gpt-4.1-mini",
        temperature: 0.2,
        max_output_tokens: 220,
        input: buildPrompt({ job, profile, analysis })
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.log(`⚠️ Resume AI suggestion failed: ${text.slice(0, 140)}`);
      return [];
    }

    const data = await response.json();
    const outputText = String(data?.output_text || "").trim();
    if (!outputText) return [];

    return outputText
      .split("\n")
      .map(line => line.replace(/^[-*0-9.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch (error) {
    console.log(`⚠️ Resume AI suggestion error: ${error.message}`);
    return [];
  }
}

function loadResumeProfile() {
  const enabled = isTruthy(process.env.RESUME_MATCH_ENABLED || "true");
  if (!enabled) {
    return { enabled: false, skills: [], role: "", years: NaN };
  }

  const skillsFromList = parseSkillList(process.env.RESUME_SKILLS || "");
  const skillsFromText = extractKnownSkills(process.env.RESUME_TEXT || "");
  const mappedSkills = uniqueList(
    [...skillsFromList, ...skillsFromText].map(mapSkillAliases)
  );
  const years = Number(process.env.RESUME_EXPERIENCE_YEARS);
  const role = String(
    process.env.RESUME_TARGET_ROLE || "Salesforce Developer"
  ).trim();

  return {
    enabled: true,
    role,
    years: Number.isFinite(years) ? years : NaN,
    skills: mappedSkills
  };
}

function analyzeJobAgainstResume(job, profile) {
  const experienceRange = parseExperienceRange(job.experience);
  const jobSkills = uniqueList(
    [
      ...extractKnownSkills(job.skills),
      ...extractKnownSkills(job.description),
      ...extractKnownSkills(job.title)
    ].map(mapSkillAliases)
  );

  const skillsResult = scoreSkills(profile.skills, jobSkills);
  const roleScore = scoreRole(profile.role, job);
  const experienceScore = scoreExperience(
    profile.years,
    experienceRange
  );

  const totalScore = clamp(
    skillsResult.score + roleScore + experienceScore,
    0,
    100
  );

  const actions = buildResumeActions({
    missingSkills: skillsResult.missing,
    matchScore: totalScore,
    profileYears: profile.years,
    experienceRange
  });

  const whyMatched = buildWhyMatched({
    job,
    profile,
    skillsResult,
    experienceRange,
    roleScore
  });
  const isUrgent = false;
  const applyPriority = buildApplyPriority({
    matchScore: totalScore,
    isUrgent
  });
  const resumeBulletSuggestions = buildResumeBulletSuggestions({
    job,
    matchedSkills: skillsResult.matched,
    missingSkills: skillsResult.missing,
    experienceRange,
    profile
  });

  return {
    match_score: totalScore,
    match_level: scoreLabel(totalScore),
    matched_skills: skillsResult.matched.map(formatSkillLabel),
    missing_skills: skillsResult.missing.map(formatSkillLabel),
    top_missing_keywords: skillsResult.missing
      .map(formatSkillLabel)
      .slice(0, 5),
    why_matched: whyMatched,
    apply_priority: applyPriority,
    resume_bullet_suggestions: resumeBulletSuggestions,
    resume_actions: actions
  };
}

export async function enrichJobsWithResumeMatch(jobs) {
  const profile = loadResumeProfile();
  if (!profile.enabled) return jobs;

  if (profile.skills.length === 0) {
    console.log(
      "ℹ️ Resume matching enabled, but RESUME_SKILLS/RESUME_TEXT is empty. Using limited scoring."
    );
  }

  const aiMaxJobs = Math.max(
    0,
    Number(process.env.RESUME_AI_MAX_JOBS_PER_RUN || 3)
  );

  const enriched = [];
  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];
    const analysis = analyzeJobAgainstResume(job, profile);

    let aiActions = [];
    if (index < aiMaxJobs) {
      aiActions = await getAiActions({ job, profile, analysis });
    }

    enriched.push({
      ...job,
      ...analysis,
      resume_actions: uniqueList([
        ...analysis.resume_actions,
        ...aiActions
      ]).slice(0, 3)
    });
  }

  return enriched.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
}
