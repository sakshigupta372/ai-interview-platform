const UserModel = require("../models/user.model");

const DEFAULT_FREE_INTERVIEWS = 3;

function freeInterviewLimit() {
  const n = Number.parseInt(process.env.FREE_INTERVIEW_LIMIT ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_FREE_INTERVIEWS;
}

async function ensureUser(clerkId) {
  try {
    return await UserModel.findOneAndUpdate(
      { clerkId },
      { $set: { lastActiveAt: new Date() } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  } catch (error) {
    // Two first requests racing on the upsert: the loser hits the unique index.
    if (error?.code === 11000) return UserModel.findOne({ clerkId });
    throw error;
  }
}

async function getQuota(clerkId) {
  const user = await ensureUser(clerkId);
  const limit = freeInterviewLimit();
  const used = user?.freeInterviewsUsed || 0;
  return { limit, used, remaining: Math.max(0, limit - used) };
}

// Atomic: concurrent starts can never push a user past the limit.
async function consumeFreeInterview(clerkId) {
  await ensureUser(clerkId);
  const limit = freeInterviewLimit();
  const updated = await UserModel.findOneAndUpdate(
    { clerkId, freeInterviewsUsed: { $lt: limit } },
    { $inc: { freeInterviewsUsed: 1 } },
    { returnDocument: "after" }
  );
  return updated
    ? { granted: true, limit, used: updated.freeInterviewsUsed }
    : { granted: false, limit };
}

async function refundFreeInterview(clerkId) {
  return UserModel.updateOne(
    { clerkId, freeInterviewsUsed: { $gt: 0 } },
    { $inc: { freeInterviewsUsed: -1 } }
  );
}

module.exports = { freeInterviewLimit, getQuota, consumeFreeInterview, refundFreeInterview };
