import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.resolve(__dirname, "../../.cache/job-hashes.json");

async function readStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return new Set(parsed);
    }

    if (Array.isArray(parsed.hashes)) {
      return new Set(parsed.hashes);
    }

    return new Set();
  } catch (error) {
    if (error.code === "ENOENT") {
      return new Set();
    }

    console.log("⚠️ Local dedupe read failed:", error.message);
    return new Set();
  }
}

async function writeStore(hashes) {
  const payload = {
    hashes: [...hashes],
    updated_at: new Date().toISOString()
  };

  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function hasLocalHash(jobHash) {
  const hashes = await readStore();
  return hashes.has(jobHash);
}

export async function saveLocalHash(jobHash) {
  const hashes = await readStore();
  if (hashes.has(jobHash)) return false;

  hashes.add(jobHash);
  await writeStore(hashes);
  return true;
}

