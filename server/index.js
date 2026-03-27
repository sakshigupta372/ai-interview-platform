const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./db"); // Import DB 

const app = express();

app.use(cors());
app.use(express.json());

// Connect Server to MongoDB
connectDB();

const interviewRoute = require("./routes/interview");
app.use("/interview", interviewRoute);

app.get("/", (req, res) => {
  res.send("AI Interview Platform API + MongoDB Running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
