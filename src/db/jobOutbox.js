import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTBOX_PATH = path.resolve(__dirname, "../../.cache/job-outbox.json");

async function readOutbox() {
  try {
    const raw = await fs.readFile(OUTBOX_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.jobs)) return parsed.jobs;
    return [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    console.log("⚠️ Job outbox read failed:", error.message);
    return [];
  }
}

async function writeOutbox(jobs) {
  const payload = {
    jobs,
    updated_at: new Date().toISOString()
  };

  await fs.mkdir(path.dirname(OUTBOX_PATH), { recursive: true });
  await fs.writeFile(OUTBOX_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function queueJobForSync(jobPayload) {
  const jobs = await readOutbox();
  const exists = jobs.some(job => job.job_hash === jobPayload.job_hash);
  if (exists) return false;

  jobs.push(jobPayload);
  await writeOutbox(jobs);
  return true;
}

export async function outboxHasHash(jobHash) {
  const jobs = await readOutbox();
  return jobs.some(job => job.job_hash === jobHash);
}

export async function flushJobOutbox(processor, options = {}) {
  const maxItems = Number(options.maxItems || Number.POSITIVE_INFINITY);
  const stopOnFailure = options.stopOnFailure !== false;
  const jobs = await readOutbox();
  if (jobs.length === 0) {
    return { total: 0, processed: 0, failed: 0, remaining: 0 };
  }

  const processCount = Number.isFinite(maxItems)
    ? Math.max(0, Math.min(jobs.length, Math.trunc(maxItems)))
    : jobs.length;
  const toProcess = jobs.slice(0, processCount);
  const untouched = jobs.slice(processCount);

  let processed = 0;
  let failed = 0;
  const pending = [...untouched];

  for (let index = 0; index < toProcess.length; index += 1) {
    const job = toProcess[index];
    try {
      await processor(job);
      processed += 1;
    } catch {
      failed += 1;
      pending.push(job);

      if (stopOnFailure) {
        pending.push(...toProcess.slice(index + 1));
        break;
      }
    }
  }

  await writeOutbox(pending);

  return {
    total: jobs.length,
    processed,
    failed,
    remaining: pending.length
  };
}
