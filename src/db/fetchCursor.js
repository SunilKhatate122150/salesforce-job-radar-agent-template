import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CURSOR_PATH = path.resolve(__dirname, "../../.cache/fetch-cursor.json");

async function readCursor() {
  try {
    const raw = await fs.readFile(CURSOR_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Number(parsed.plan_index || 0) || 0;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    console.log("⚠️ Fetch cursor read failed:", error.message);
    return 0;
  }
}

async function writeCursor(planIndex) {
  const payload = {
    plan_index: planIndex,
    updated_at: new Date().toISOString()
  };

  await fs.mkdir(path.dirname(CURSOR_PATH), { recursive: true });
  await fs.writeFile(CURSOR_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function getNextPlanStartIndex(planCount) {
  if (!Number.isInteger(planCount) || planCount <= 0) return 0;

  const current = await readCursor();
  const normalized = ((current % planCount) + planCount) % planCount;
  await writeCursor((normalized + 1) % planCount);
  return normalized;
}

