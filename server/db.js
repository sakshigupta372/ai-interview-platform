const mongoose = require("mongoose");

const LOCAL_FALLBACK = "mongodb://127.0.0.1:27017/ai-interview-platform";

// Atlas SRV lookups go over DNS first, which is the step that most often times
// out on slow / flaky networks. Give selection + connect a generous window so a
// reachable Atlas cluster isn't abandoned prematurely and silently downgraded to
// local Mongo.
const options = {
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  socketTimeoutMS: 20000,
  family: 4,
};

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isAtlasUri(uri) {
  return /^mongodb\+srv:\/\//i.test(uri || "") || /mongodb\.net/i.test(uri || "");
}

// Hide credentials when echoing which host we're connecting to.
function describeTarget(uri) {
  try {
    const u = new URL(uri);
    return `${u.protocol}//${u.hostname}${u.pathname || ""}`;
  } catch {
    return isAtlasUri(uri) ? "Atlas (mongodb+srv)" : "configured MongoDB";
  }
}

function isUnreachable(err) {
  const msg = err?.message || String(err);
  return /ENOTFOUND|querySrv|ECONNREFUSED|ETIMEOUT|ETIMEDOUT|MongoServerSelectionError|getaddrinfo|timed out/i.test(msg);
}

function explainAtlasFailure(err) {
  const msg = err?.message || String(err);
  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(msg)) {
    console.error("   → DNS could not resolve the Atlas SRV host. Check the cluster hostname in MONGO_URI and your internet/DNS.");
  }
  if (/MongoServerSelectionError|ETIMEDOUT|ETIMEOUT/i.test(msg)) {
    console.error("   → Could not reach any Atlas node in time. In Atlas → Network Access, add 0.0.0.0/0 (or this machine's IP) and confirm the cluster is running.");
  }
  if (/authentication|auth failed|bad auth/i.test(msg)) {
    console.error("   → Authentication failed. Check the DB username/password in MONGO_URI (Atlas → Database Access).");
  }
}

async function connectOnce(uri) {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await withTimeout(mongoose.connect(uri, options), 10000, "Mongo connect");
}

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  const isProd = process.env.NODE_ENV === "production";
  const atlas = isAtlasUri(uri);

  if (!uri) {
    console.error("❌ MONGO_URI is missing. Add it in your .env (local) or Render → Environment (prod).");
    if (isProd) process.exit(1);
  } else {
    console.log(`🔌 Connecting to ${atlas ? "MongoDB Atlas" : "MongoDB"} → ${describeTarget(uri)}`);
    const maxAttempts = isProd ? 3 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await connectOnce(uri);
        console.log(`🟢 Connected to ${atlas ? "Atlas (data persists across restarts & machines)" : "MongoDB"}.`);
        return;
      } catch (err) {
        console.error(`🔴 ${atlas ? "Atlas" : "MongoDB"} attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
        explainAtlasFailure(err);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 3000));
        } else if (isProd || !isUnreachable(err)) {
          console.error("❌ Could not connect to MongoDB. Fix MONGO_URI and Atlas Network Access (0.0.0.0/0), then restart.");
          process.exit(1);
        }
      }
    }
  }

  // Dev-only safety net. Loud warning so local-only data loss is never a surprise.
  try {
    console.warn("⚠️  Atlas unreachable — falling back to LOCAL MongoDB at 127.0.0.1:27017.");
    console.warn("    Data saved now lives ONLY on this machine and will NOT appear after a deploy or on another device.");
    await connectOnce(LOCAL_FALLBACK);
    console.log("🟡 Connected to LOCAL MongoDB (not Atlas). History survives API restarts on THIS machine only.");
  } catch (err) {
    console.error("🔴 Local MongoDB fallback failed:", err.message);
    console.error("❌ No database available. Start mongod locally or fix MONGO_URI for Atlas.");
    process.exit(1);
  }
};

module.exports = connectDB;
