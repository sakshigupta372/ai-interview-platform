const mongoose = require("mongoose");

const LOCAL_FALLBACK = "mongodb://127.0.0.1:27017/ai-interview-platform";

const options = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
};

function isUnreachable(err) {
  const msg = err?.message || String(err);
  return /ENOTFOUND|querySrv|ECONNREFUSED|ETIMEOUT|MongoServerSelectionError/i.test(msg);
}

async function connectOnce(uri) {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri, options);
}

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  const isProd = process.env.NODE_ENV === "production";

  if (!uri) {
    console.error("❌ MONGO_URI is missing. Add it in Render → Environment.");
    if (isProd) process.exit(1);
  } else {
    const maxAttempts = isProd ? 3 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await connectOnce(uri);
        console.log("🟢 MongoDB Successfully Connected!");
        return;
      } catch (err) {
        console.error(`🔴 MongoDB attempt ${attempt}/${maxAttempts} failed:`, err.message);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 3000));
        } else if (isProd || !isUnreachable(err)) {
          console.error("❌ Could not connect to MongoDB. Check MONGO_URI and Atlas Network Access (0.0.0.0/0).");
          process.exit(1);
        }
      }
    }
  }

  try {
    console.warn("⚠️ Atlas unreachable — falling back to local MongoDB at 127.0.0.1:27017");
    await connectOnce(LOCAL_FALLBACK);
    console.log("🟢 MongoDB Successfully Connected (local)!");
  } catch (err) {
    console.error("🔴 Local MongoDB fallback failed:", err.message);
    console.error("❌ Could not connect to MongoDB. Start mongod locally or fix MONGO_URI.");
    process.exit(1);
  }
};

module.exports = connectDB;
