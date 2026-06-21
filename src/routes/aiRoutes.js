// AI Routes (Vite)
import fetch from 'node-fetch';
import { readBody } from './routeHelpers.js';

export async function handleAiRequest(req, res, userId, kind) {
  const body = readBody(req);
  const response = await generateAiText(kind, body);
  return res.status(200).json({ success: true, response });
}

function fallbackAiText(kind, payload = {}) {
  const userName = payload.userName || payload.candidateName || 'there';
  if (kind === 'code-review') {
    return JSON.stringify({
      score: payload.score || 0,
      correctnessPercent: payload.correctnessPercent || payload.score || 0,
      passedChecks: payload.passedChecks || [],
      failedChecks: payload.failedChecks || [],
      improvements: payload.improvements || ['Review the failed checks and add a concrete test case.'],
      interviewFeedback: payload.interviewFeedback || 'Explain the approach, tradeoffs, and how you would validate this in a Salesforce org.',
      nextPracticeTopics: payload.nextPracticeTopics || ['Apex testing', 'Bulkification', 'Security']
    });
  }
  if (kind === 'email') {
    const job = payload.job || {};
    const company = job.company || payload.company || 'the team';
    const role = job.title || job.role || payload.role || 'Salesforce Developer';
    if (payload.emailType === 'withdraw') {
      return `Subject: Withdrawing my application for ${role}\n\nHi ${company} team,\n\nThank you for considering me for the ${role} opportunity. After careful thought, I would like to withdraw my application at this time.\n\nI appreciate the time and consideration, and I hope we can stay connected for future Salesforce opportunities that may be a stronger fit.\n\nBest regards,\n${userName}`;
    }
    return `Subject: Thank you for the ${role} conversation\n\nHi ${company} team,\n\nThank you for taking the time to speak with me about the ${role} opportunity. I enjoyed learning more about the team, the Salesforce roadmap, and the problems you are solving.\n\nOur conversation strengthened my interest in contributing through Apex, LWC, integrations, and scalable Salesforce delivery. I appreciate your time and look forward to the next steps.\n\nBest regards,\n${userName}`;
  }
  if (kind === 'cover-letter') {
    const job = normalizeJobForPrompt(payload.job);
    const skills = job.matchedSkills.length ? job.matchedSkills.join(', ') : 'Apex, LWC, integrations, and Salesforce delivery';
    return `I am excited to apply for the ${job.title} role at ${job.company}. My Salesforce experience aligns strongly with the needs of this position, especially around ${skills}.\n\nI focus on building reliable, maintainable solutions that balance business outcomes with technical quality. I can contribute across Apex, Lightning Web Components, integrations, data quality, and production support while communicating clearly with business and engineering teams.\n\nI would welcome the opportunity to discuss how my Salesforce background can help ${job.company} deliver high-impact platform work.`;
  }
  if (kind === 'qa') {
    return JSON.stringify([
      {
        question: `What are the most important implementation risks for ${payload.topicName || 'this Salesforce topic'}?`,
        answer: 'Focus on governor limits, security enforcement, bulk-safe design, testing strategy, and operational monitoring. A strong answer explains the tradeoffs and how you would validate the solution in a real org.'
      },
      {
        question: `How would you explain ${payload.topicName || 'this concept'} to a business stakeholder?`,
        answer: 'Start with the business outcome, then describe the Salesforce mechanism in plain language. Avoid platform jargon unless the stakeholder needs it for a decision.'
      }
    ]);
  }
  const topic = payload.topic || payload.skill || 'Salesforce';
  return `Good answer. For a stronger interview response, connect your point to a real implementation decision, mention limits or security implications, and close with how you would test it. Next question: how would you design a scalable ${topic} solution when requirements change late in delivery?`;
}

function normalizeJobForPrompt(job = {}) {
  return {
    title: job.title || job.role || 'Salesforce role',
    company: job.company || 'the company',
    location: job.location || job.loc || '',
    matchedSkills: Array.isArray(job.matched_skills) ? job.matched_skills : [],
    missingSkills: Array.isArray(job.missing_skills) ? job.missing_skills : [],
    url: job.apply_link || job.url || ''
  };
}

export async function generateAiText(kind, payload = {}) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return fallbackAiText(kind, payload);

  const prompts = {
    interview: `You are a senior Salesforce technical interviewer. Topic: ${payload.topic || 'Salesforce'}. Difficulty: ${payload.difficulty || 'Senior'}. Give brief feedback on the candidate answer and ask one follow-up question.\n\nCandidate answer:\n${payload.answer || payload.prompt || ''}`,
    coach: `You are a Salesforce interview coach. Job/company context: ${JSON.stringify(payload.job || {})}. Reply to the candidate and ask one useful follow-up question.\n\nCandidate message:\n${payload.message || payload.prompt || ''}`,
    email: `Write a concise professional ${payload.emailType || 'thank you'} email for a Salesforce job process. Candidate: ${payload.userName || 'Candidate'}. Job/company: ${JSON.stringify(payload.job || {})}. Return subject and body.`,
    'cover-letter': `Write a short, professional 3-paragraph cover letter body for this Salesforce role. Candidate: ${payload.userName || 'Candidate'}. Job: ${JSON.stringify(normalizeJobForPrompt(payload.job || {}))}.`,
    qa: `Generate 5 Salesforce interview Q&A items for topic "${payload.topicName || payload.topic || 'Salesforce'}". Return valid JSON array only with question and answer fields.`,
    skill: `Create a concise 3-day Salesforce interview study plan for "${payload.skill || payload.topic || 'Salesforce'}". Use practical bullets.`,
    'code-review': `Review this Salesforce coding practice attempt. Return valid JSON only with keys score, correctnessPercent, passedChecks, failedChecks, improvements, interviewFeedback, nextPracticeTopics. Deterministic score is ${payload.score}. Challenge: ${payload.challengeTitle}. Instructions: ${payload.instructions}. Rubric: ${payload.aiRubric}. Files: ${payload.filesText}`
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'You are a precise Salesforce career and interview assistant. Keep responses useful, specific, and concise.' },
          { role: 'user', content: prompts[kind] || prompts.interview }
        ],
        temperature: 0.35
      })
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || fallbackAiText(kind, payload);
  } catch (err) {
    console.warn('[AI] Falling back to deterministic response:', err.message);
    return fallbackAiText(kind, payload);
  }
}
