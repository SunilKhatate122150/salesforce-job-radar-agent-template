// Knowledge Routes (Vite)
import { readDataJson } from './routeHelpers.js';

export async function handleKnowledge(req, res, path) {
  const topicId = path.split('/')[1];
  if (!topicId) return res.status(400).json({ error: 'Missing topic ID' });
  
  // Try specific file first
  let knowledge = readDataJson(`topics/${topicId}.json`, null);
  
  // Fallback to master knowledge map
  if (!knowledge) {
    const master = readDataJson('topics/master_knowledge.json', {});
    knowledge = master[topicId];
  }

  if (knowledge) return res.status(200).json(knowledge);
  return res.status(404).json({ error: 'Topic not found' });
}
