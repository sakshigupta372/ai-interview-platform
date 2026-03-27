# 🤖 Nexus: AI Interview Platform 
A state-of-the-art, voice-activated, agentic AI interview simulation pipeline built with Next.js, Node.js, MongoDB, and the Google Gemini API.

## 🌟 Premium Features
- **Multi-Agent Pipeline**: Dedicated AI Agents for Question Generation, Answer Evaluation, and Dynamic Follow-ups.
- **2-Way Voice Interaction**: Utilize Web Speech API and Neural Speech Synthesis to literally hold a verbal interview with the AI.
- **Adaptive Difficulty Engine**: The system actively evaluates your clarity and depth in real-time. If you perform well, the underlying prompt engine seamlessly upgrades the interview to "Hard" mode.
- **Neural Profiling Dashboard**: Real-time extraction and memory retrieval of Candidate Weaknesses and Strengths. ("AI Recall: Target struggles with React Hooks").
- **Company Personas**: Select specific company traits (Google FAANG, Amazon Principles, Stripe Architect) to drastically alter the System Prompts and interview pressure.

## 🛠️ System Architecture
1. **Frontend**: Next.js (App Router), Tailwind CSS, Framer Motion, Axios, Web Speech API.
2. **Backend**: Express.js, Node.js, `@google/genai` (Gemini 2.5 Flash), MongoDB/Mongoose.
3. **Database Architecture**: Stateful polymorphic schema to handle dynamically extending session documents, preserving complete Q&A histories, floating evaluation metrics, and persistent role metadata.

## 🚀 Local Deployment

### 1. Setup the Database & Env
Inside the `/server` folder, create a `.env` file:
```env
GEMINI_API_KEY=your_gemini_key_here
MONGO_URI=mongodb://127.0.0.1:27017/ai-interview-platform
```

### 2. Boot the Backend
```bash
cd server
npm install
node index.js
```

### 3. Boot the Frontend
```bash
cd client
npm install
npm run dev
```

Visit `http://localhost:3000` to interact with A.N.I.A (Advanced Neural Interview Agent).
