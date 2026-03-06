import "dotenv/config";
import {
  addTrackedApplicationNote,
  getApplicationTrackerSummary,
  listTrackedApplications,
  setTrackedApplicationStatus
} from "../db/applicationTracker.js";

function printUsage() {
  console.log("Usage:");
  console.log("  npm run tracker -- summary");
  console.log("  npm run tracker -- list [status] [limit]");
  console.log("  npm run tracker -- set <job_hash_or_prefix> <status> [note]");
  console.log("  npm run tracker -- note <job_hash_or_prefix> <note>");
  console.log("  npm run tracker -- apply <job_hash_or_prefix> [note]");
  console.log("  npm run tracker -- save <job_hash_or_prefix> [note]");
  console.log("  npm run tracker -- ignore <job_hash_or_prefix> [note]");
  console.log("");
  console.log("Statuses:");
  console.log("  new, shortlisted, applied, interview, offer, rejected, ignored, follow_up");
  console.log("");
  console.log("Note:");
  console.log("  job hash prefixes are accepted when they uniquely match one record.");
}

function shorten(value, max = 64) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

async function run() {
  const [command = "summary", ...args] = process.argv.slice(2);

  if (command === "summary") {
    const summary = await getApplicationTrackerSummary({ limit: 10 });
    console.log("Application Tracker Summary");
    console.log(`Total: ${summary.total}`);
    console.log(
      `Counts: new=${summary.counts.new} | shortlisted=${summary.counts.shortlisted} | follow_up=${summary.counts.follow_up} | applied=${summary.counts.applied} | interview=${summary.counts.interview} | offer=${summary.counts.offer} | rejected=${summary.counts.rejected} | ignored=${summary.counts.ignored}`
    );
    console.log("");
    console.log("Top actionable:");
    if (summary.actionable.length === 0) {
      console.log("  (none)");
      return;
    }
    for (const item of summary.actionable) {
      console.log(`- [${item.status}] ${shorten(item.title, 60)} @ ${shorten(item.company, 24)}`);
      console.log(`  hash: ${item.job_hash}`);
      console.log(`  link: ${shorten(item.apply_link, 100)}`);
    }
    return;
  }

  if (command === "list") {
    const status = args[0] || "";
    const limit = Number(args[1] || 20);
    const jobs = await listTrackedApplications({ status, limit });
    console.log(`Tracked applications (${jobs.length})`);
    for (const job of jobs) {
      console.log(`- [${job.status}] ${shorten(job.title, 60)} @ ${shorten(job.company, 24)}`);
      console.log(`  hash: ${job.job_hash}`);
      console.log(`  updated: ${job.updated_at}`);
      console.log(`  link: ${shorten(job.apply_link, 100)}`);
    }
    return;
  }

  if (command === "set") {
    const [jobHash, status, ...noteParts] = args;
    if (!jobHash || !status) {
      printUsage();
      process.exitCode = 1;
      return;
    }
    const note = noteParts.join(" ").trim();
    const updated = await setTrackedApplicationStatus(jobHash, status, note);
    console.log(`Updated ${updated.job_hash} -> ${updated.status}`);
    return;
  }

  if (command === "note") {
    const [jobHash, ...noteParts] = args;
    const note = noteParts.join(" ").trim();
    if (!jobHash || !note) {
      printUsage();
      process.exitCode = 1;
      return;
    }
    const updated = await addTrackedApplicationNote(jobHash, note);
    console.log(`Note added for ${updated.job_hash}`);
    return;
  }

  if (["apply", "save", "ignore"].includes(command)) {
    const [jobHash, ...noteParts] = args;
    if (!jobHash) {
      printUsage();
      process.exitCode = 1;
      return;
    }

    const actionMap = {
      apply: {
        status: "applied",
        note: "Applied from tracker shortcut"
      },
      save: {
        status: "shortlisted",
        note: "Saved for follow-up"
      },
      ignore: {
        status: "ignored",
        note: "Ignored from tracker shortcut"
      }
    };
    const action = actionMap[command];
    const note = noteParts.join(" ").trim() || action.note;
    const updated = await setTrackedApplicationStatus(jobHash, action.status, note);
    console.log(`${command} -> ${updated.job_hash} -> ${updated.status}`);
    return;
  }

  printUsage();
  process.exitCode = 1;
}

run().catch(error => {
  console.log("❌ Tracker command failed:", error.message);
  process.exitCode = 1;
});
