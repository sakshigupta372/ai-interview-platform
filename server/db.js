const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // We will use local mongodb if no URI is provided
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai-interview-platform";
    await mongoose.connect(uri);
    console.log("🟢 MongoDB Successfully Connected!");
  } catch (err) {
    console.error("🔴 MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
