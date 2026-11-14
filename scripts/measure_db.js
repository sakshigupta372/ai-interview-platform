/**
 * Read-only session metrics. Prints JSON only. Does not print secrets.
 */
const path = require("path");
const serverRoot = path.join(__dirname, "..", "server");
module.paths.unshift(path.join(serverRoot, "node_modules"));
require("dotenv").config({ path: path.join(serverRoot, ".env") });
const mongoose = require("mongoose");
const Session = require("../server/models/session.model");

const RANK = { Easy: 0, Medium: 1, Hard: 2 };

function rankOf(value) {
  if (value == null) return null;
  const key = String(value).trim();
  return Object.prototype.hasOwnProperty.call(RANK, key) ? RANK[key] : null;
}

function sessionAdjustments(session) {
  const history = Array.isArray(session.history) ? session.history : [];
  let up = 0;
  let down = 0;
  let unknown = 0;

  for (const item of history) {
    const fromRank = rankOf(item.difficulty);
    const toRank = rankOf(item.evaluation && item.evaluation.suggested_next_difficulty);
    if (fromRank == null || toRank == null) {
      if (item.evaluation && item.evaluation.suggested_next_difficulty) unknown += 1;
      continue;
    }
    if (toRank > fromRank) up += 1;
    else if (toRank < fromRank) down += 1;
  }

  return { up, down, unknown, changed: up + down > 0 };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log(JSON.stringify({ ok: false, error: "MONGO_URI is not set" }));
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  const sessions = await Session.find({}).lean();
  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const active = sessions.filter((s) => s.status === "active").length;
  const uniqueUsers = new Set(
    sessions.map((s) => s.clerkId).filter((id) => id != null && String(id).trim() !== "")
  ).size;
  const sessionsWithNullClerkId = sessions.filter((s) => s.clerkId == null || String(s.clerkId).trim() === "").length;

  const questionCounts = sessions.map((s) => (Array.isArray(s.history) ? s.history.length : 0));
  const questionSum = questionCounts.reduce((a, b) => a + b, 0);
  const avgQuestionsPerSession = total === 0 ? null : questionSum / total;
  const sessionsWithAtLeastOneQuestion = questionCounts.filter((n) => n > 0).length;
  const avgQuestionsAmongSessionsWithHistory =
    sessionsWithAtLeastOneQuestion === 0
      ? null
      : questionSum / sessionsWithAtLeastOneQuestion;

  let sessionsAdjusted = 0;
  let sessionsAdjustedUp = 0;
  let sessionsAdjustedDown = 0;
  let totalUpEvents = 0;
  let totalDownEvents = 0;
  let totalUnknownEvents = 0;
  let sessionsWithHistory = 0;

  for (const session of sessions) {
    const history = Array.isArray(session.history) ? session.history : [];
    if (history.length === 0) continue;
    sessionsWithHistory += 1;
    const adj = sessionAdjustments(session);
    totalUpEvents += adj.up;
    totalDownEvents += adj.down;
    totalUnknownEvents += adj.unknown;
    if (adj.changed) sessionsAdjusted += 1;
    if (adj.up > 0) sessionsAdjustedUp += 1;
    if (adj.down > 0) sessionsAdjustedDown += 1;
  }

  const pct = (n, d) => (d === 0 ? null : (n / d) * 100);

  const report = {
    ok: true,
    measured_at: new Date().toISOString(),
    mongo_kind: uri.startsWith("mongodb+srv") ? "atlas" : "local_or_other",
    models_found: {
      session: "server/models/session.model.js",
      roadmap: "server/models/roadmap.model.js",
      user: null,
      agent_turn: null,
    },
    sessions: {
      total,
      completed,
      active,
      unique_users_by_clerkId: uniqueUsers,
      sessions_with_null_or_empty_clerkId: sessionsWithNullClerkId,
    },
    questions: {
      total_history_items: questionSum,
      average_per_session_all_sessions: avgQuestionsPerSession,
      sessions_with_at_least_one_question: sessionsWithAtLeastOneQuestion,
      average_per_session_with_history: avgQuestionsAmongSessionsWithHistory,
    },
    difficulty: {
      definition:
        "One event = history[i].difficulty vs history[i].evaluation.suggested_next_difficulty. Rank: Easy < Medium < Hard.",
      sessions_with_history: sessionsWithHistory,
      sessions_with_any_adjustment: sessionsAdjusted,
      pct_sessions_with_any_adjustment_of_all: pct(sessionsAdjusted, total),
      pct_sessions_with_any_adjustment_of_sessions_with_history: pct(sessionsAdjusted, sessionsWithHistory),
      sessions_with_at_least_one_up: sessionsAdjustedUp,
      sessions_with_at_least_one_down: sessionsAdjustedDown,
      pct_sessions_with_up_of_all: pct(sessionsAdjustedUp, total),
      pct_sessions_with_down_of_all: pct(sessionsAdjustedDown, total),
      total_up_events: totalUpEvents,
      total_down_events: totalDownEvents,
      events_skipped_unknown_rank: totalUnknownEvents,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.log(JSON.stringify({ ok: false, error: err.message }));
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
