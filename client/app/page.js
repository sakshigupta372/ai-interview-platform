"use client"

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Zap, BrainCircuit, Timer, ShieldAlert,
  Mic, MicOff, Rocket, Lightbulb, Target, Brain, Activity,
  Download, Upload, CheckCircle, FileText, Code2,
} from "lucide-react";
import { getApiBase } from "@/lib/api";
import { useAuth, SignInButton, UserButton } from "@clerk/nextjs";
import dynamic from "next/dynamic";

const CodeEditor = dynamic(() => import("../../components/CodeEditor"), { ssr: false });

// ─── ShapeGrid (canvas) ───────────────────────────────────────────────────────
function ShapeGrid() {
  const ref = useRef(null);
  const mouse = useRef({ x: -999, y: -999 });
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const onMouse = (e) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", onMouse);
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      const cell = 58, gap = 2;
      const cols = Math.ceil(c.width / (cell + gap));
      const rows = Math.ceil(c.height / (cell + gap));
      for (let r = 0; r < rows; r++) {
        for (let cl = 0; cl < cols; cl++) {
          const cx = cl * (cell + gap) + cell / 2;
          const cy = r * (cell + gap) + cell / 2;
          const dx = mouse.current.x - cx, dy = mouse.current.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const inf = Math.max(0, 1 - dist / 140);
          const a = 0.055 + inf * 0.35;
          const s = (cell * 0.3) * (1 + inf * 0.5);
          ctx.save(); ctx.translate(cx, cy);
          ctx.globalAlpha = a;
          ctx.fillStyle = "#fff";
          const t = (r + cl) % 3;
          if (t === 0) { ctx.fillRect(-s / 2, -s / 2, s, s); }
          else if (t === 1) { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.beginPath(); ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, 0); ctx.lineTo(0, s / 2); ctx.lineTo(-s / 2, 0); ctx.closePath(); ctx.fill(); }
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMouse); };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", display: "block" }} />;
}

// ─── Typewriter ───────────────────────────────────────────────────────────────
function TypewriterText({ text, delay = 18 }) {
  const [out, setOut] = useState("");
  useEffect(() => {
    setOut(""); let i = 0;
    const id = setInterval(() => { setOut(p => p + text.charAt(i)); i++; if (i >= text.length) clearInterval(id); }, delay);
    return () => clearInterval(id);
  }, [text]);
  return <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "rgba(255,255,255,0.88)" }}>{out}</p>;
}

// ─── Small metre bar ─────────────────────────────────────────────────────────
function Meter({ label, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
        <span>{label}</span><span style={{ fontFamily: "monospace" }}>{Math.floor(value)}%</span>
      </div>
      <div style={{ width: "100%", height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 99 }}>
        <div style={{ width: `${value}%`, height: "100%", background: "rgba(255,255,255,0.6)", borderRadius: 99, transition: "width .4s" }} />
      </div>
    </div>
  );
}

// ─── Shared panel style ───────────────────────────────────────────────────────
const panel = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 20, backdropFilter: "blur(20px)" };
const label = { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 6, display: "block" };
const inputStyle = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" };

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { userId, isLoaded } = useAuth();

  const [stage, setStage] = useState("role-selection");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [role, setRole] = useState("");
  const [persona, setPersona] = useState("Harsh Tech Lead");
  const [company, setCompany] = useState("Agnostic");
  const [interviewType, setInterviewType] = useState("Technical");
  const [timerMode, setTimerMode] = useState("Pressure Mode");

  const [sessionId, setSessionId] = useState("");
  const [userApiKey, setUserApiKey] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeContext, setResumeContext] = useState(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState("javascript");

  // After Clerk loads and user is signed in, check if we already have their key in sessionStorage.
  // If not, redirect them to the API Key entry screen.
  useEffect(() => {
    if (!isLoaded) return;
    if (userId) {
      const saved = sessionStorage.getItem("careerforge_gemini_key");
      if (saved) {
        setUserApiKey(saved);
      } else {
        setStage("api-key");
      }
    }
  }, [isLoaded, userId]);
  const [currentDifficulty, setCurrentDifficulty] = useState("Medium");
  const [strengths, setStrengths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [answer, setAnswer] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [finalSummary, setFinalSummary] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [liveClarity, setLiveClarity] = useState(0);
  const [liveConfidence, setLiveConfidence] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const chatEndRef = useRef(null);
  const timerRef = useRef(null);

  // Voice setup
  useEffect(() => {
    if (typeof window === "undefined") return;
    synthRef.current = window.speechSynthesis;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR(); r.continuous = true; r.interimResults = true;
    r.onresult = (e) => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; setAnswer(t); };
    r.onerror = () => setIsRecording(false); r.onend = () => setIsRecording(false);
    recognitionRef.current = r;
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) { alert("Use Chrome/Edge for voice."); return; }
    if (isRecording) { recognitionRef.current.stop(); setIsRecording(false); }
    else { setAnswer(""); recognitionRef.current.start(); setIsRecording(true); }
  };

  const speak = (text) => {
    if (!synthRef.current) return; setIsAiSpeaking(true);
    const u = new SpeechSynthesisUtterance(text); u.rate = 1.0; u.pitch = 0.9;
    u.onend = () => setIsAiSpeaking(false); synthRef.current.speak(u);
  };

  // Live meters
  useEffect(() => {
    if (!answer.trim()) { setLiveClarity(0); setLiveConfidence(0); return; }
    const words = answer.trim().split(/\s+/).length;
    setLiveClarity(Math.min(100, words * 2.5));
    const h = (answer.match(/\b(hmm|uh|um|maybe|probably|guess)\b/gi) || []).length;
    setLiveConfidence(Math.max(0, Math.min(100, words * 2 - h * 15)));
  }, [answer]);

  // Timer
  useEffect(() => {
    if (stage !== "interview" || isTyping || timerMode === "Practice Mode") return;
    const start = timerMode === "Rapid Fire" ? 30 : 120; setTimeLeft(start);
    timerRef.current = setInterval(() => {
      setTimeLeft(p => { if (p <= 1) { clearInterval(timerRef.current); submitAnswer("Time up."); return 0; } return p - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [stage, isTyping, chatHistory.length, timerMode]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, isTyping]);

  const apiBase = getApiBase();
  const isCodingRound = interviewType === "Coding Round";

  const handleResumeUpload = async (file) => {
    if (!file) return;
    setResumeFile(file);
    setIsParsingResume(true);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("userApiKey", userApiKey);
      const res = await axios.post(`${apiBase}/resume/parse`, formData, { timeout: 60000 });
      setResumeContext(res.data.context);
    } catch (e) {
      console.error("Resume parse failed:", e);
      setResumeContext(null);
    } finally {
      setIsParsingResume(false);
    }
  };

  const downloadReport = async () => {
    if (!finalSummary) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text("CareerForge — Interview Report", W / 2, y, { align: "center" }); y += 10;

    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`${company} · ${interviewType} · ${new Date().toLocaleDateString()}`, W / 2, y, { align: "center" });
    y += 8;
    doc.text(`Role: ${role}`, W / 2, y, { align: "center" });
    y += 14;

    doc.setTextColor(0);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(`Peak Difficulty: ${finalSummary.currentDifficulty}   Avg Score: ${
      finalSummary.history.length
        ? (finalSummary.history.reduce((a, h) => a + (h?.evaluation?.score || 0), 0) / finalSummary.history.length).toFixed(1)
        : "—"
    }/10   Questions: ${finalSummary.history.length}`, 14, y);
    y += 12;

    doc.setDrawColor(220); doc.line(14, y, W - 14, y); y += 10;

    finalSummary.history.forEach((item, idx) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
      doc.text(`Q${idx + 1} [${item.difficulty || "Medium"}] — Score: ${item?.evaluation?.score ?? "—"}/10`, 14, y); y += 7;

      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(40);
      const qLines = doc.splitTextToSize(`Question: ${item.question}`, W - 28);
      doc.text(qLines, 14, y); y += qLines.length * 5 + 3;

      const aLines = doc.splitTextToSize(`Answer: ${item.answer}`, W - 28);
      doc.text(aLines, 14, y); y += aLines.length * 5 + 3;

      if (item?.evaluation?.suggestions) {
        doc.setTextColor(80);
        const sLines = doc.splitTextToSize(`Tip: ${item.evaluation.suggestions}`, W - 28);
        doc.text(sLines, 14, y); y += sLines.length * 5 + 3;
      }
      if (item?.evaluation?.ideal_answer) {
        doc.setTextColor(60);
        const iLines = doc.splitTextToSize(`Ideal: ${item.evaluation.ideal_answer}`, W - 28);
        doc.text(iLines, 14, y); y += iLines.length * 5 + 3;
      }
      if (item?.evaluation?.time_complexity) {
        doc.setTextColor(80);
        doc.text(`Time: ${item.evaluation.time_complexity}  Space: ${item.evaluation.space_complexity}`, 14, y); y += 6;
      }
      doc.setDrawColor(230); doc.line(14, y, W - 14, y); y += 8;
    });

    if (finalSummary.globalStrengths?.length || finalSummary.globalWeaknesses?.length) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
      doc.text("Overall Profile", 14, y); y += 8;
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      (finalSummary.globalStrengths || []).forEach(s => { doc.setTextColor(40); doc.text(`+ ${s}`, 18, y); y += 5; });
      (finalSummary.globalWeaknesses || []).forEach(w => { doc.setTextColor(100); doc.text(`— ${w}`, 18, y); y += 5; });
    }

    doc.save(`careerforge-report-${Date.now()}.pdf`);
  };

  const startInterview = async () => {
    if (!role || !userId) return;
    setIsTyping(true); setStage("interview");
    const ctx = `A ${persona} acting as a ${interviewType} interviewer at ${company}, for a ${role} position.`;
    try {
      const res = await axios.post(
        `${apiBase}/interview/start`,
        { role: ctx, clerkId: userId, userApiKey, resumeContext: resumeContext || undefined, isCodingRound },
        { timeout: 90000 }
      );
      setSessionId(res.data.sessionId);
      setChatHistory([{ role: "ai", text: res.data.question, isInitial: true }]);
      setCurrentDifficulty("Medium");
      if (!isCodingRound) speak(res.data.question);
    } catch (err) {
      const isNetwork = !err.response;
      const onLiveSite = typeof window !== "undefined" && window.location.hostname.includes("vercel.app");
      const missingApiUrl = onLiveSite && apiBase.includes("localhost");
      const msg = missingApiUrl
        ? "Backend not configured. Set NEXT_PUBLIC_API_URL on Vercel to your Render URL, then redeploy."
        : isNetwork
        ? "Could not reach the server. Render may be waking up (~60s on free tier). Wait a moment and try again."
        : `Server error ${err.response?.status}: ${err.response?.data?.error || "Unknown error"}`;
      alert(msg);
      setStage("role-selection");
    }
    finally { setIsTyping(false); }
  };

  const submitAnswer = async (forced = null) => {
    if (isRecording) toggleRecording();
    if (synthRef.current?.speaking) synthRef.current.cancel();
    const userAns = forced || answer; if (!userAns.trim()) return;
    clearInterval(timerRef.current);
    const hist = [...chatHistory, { role: "user", text: userAns }];
    setChatHistory(hist); setAnswer(""); setIsTyping(true);
    setTimeout(() => setIsAdjusting(true), 1200);
    try {
      const res = await axios.post(`${apiBase}/interview/answer`, { sessionId, answer: userAns, userApiKey, resumeContext: resumeContext || undefined, isCodingRound }, { timeout: 90000 });
      const updated = [...hist];
      updated[updated.length - 1].evaluation = res.data.evaluation;
      if (res.data.sessionSummary) {
        setStrengths(res.data.sessionSummary.globalStrengths || []);
        setWeaknesses(res.data.sessionSummary.globalWeaknesses || []);
        setCurrentDifficulty(res.data.sessionSummary.currentDifficulty || "Medium");
      }
      if (res.data.isComplete) { setFinalSummary(res.data.sessionSummary); setStage("dashboard"); }
      else { updated.push({ role: "ai", text: res.data.nextQuestion, isFollowUp: true }); setChatHistory(updated); if (!isCodingRound) speak(res.data.nextQuestion); }
    } catch (e) { console.error(e); }
    finally { setIsTyping(false); setIsAdjusting(false); }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'Inter', sans-serif", position: "relative" }}>
      <ShapeGrid />

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 64, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(5,5,5,0.8)", backdropFilter: "blur(20px)" }}>
        <span style={{ fontWeight: 900, letterSpacing: "0.18em", fontSize: 13, textTransform: "uppercase" }}>Career<span style={{ color: "rgba(255,255,255,0.3)" }}>Forge</span></span>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {isLoaded && !userId && (
            <div style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .2s" }}>
              <SignInButton mode="modal" />
            </div>
          )}
          {isLoaded && userId && (
            <>
              <button onClick={() => window.location.href = "/mentor"} style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", letterSpacing: "0.05em", background: "none", border: "none", cursor: "pointer" }}>
                Mentor →
              </button>
              <button onClick={() => window.location.href = "/profile"} style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", letterSpacing: "0.05em", background: "none", border: "none", cursor: "pointer" }}>
                History →
              </button>
              <UserButton />
            </>
          )}
        </div>
      </nav>

      {/* MAIN */}
      <main style={{ position: "relative", zIndex: 10, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px 40px" }}>
        <AnimatePresence mode="wait">

          {/* ══ API KEY GATE ═══════════════════════════════════════════════════ */}
          {stage === "api-key" && (
            <motion.div key="api-key"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}
              style={{ width: "100%", maxWidth: 460 }}
            >
              <div style={{ ...panel, padding: "44px 40px", textAlign: "center" }}>
                {/* Icon */}
                <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 28 }}>
                  🔑
                </div>

                <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Connect Your AI</h2>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.6, margin: "0 0 32px" }}>
                  Paste your free Gemini API key to power your interview simulation.<br />
                  Your key is <strong style={{ color: "rgba(255,255,255,0.6)" }}>never stored</strong> on our servers.
                </p>

                {/* Key Input */}
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => { setApiKeyInput(e.target.value); setApiKeyError(""); }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      if (apiKeyInput.trim().length < 10) { setApiKeyError("That doesn't look like a valid API key."); return; }
                      sessionStorage.setItem("careerforge_gemini_key", apiKeyInput.trim());
                      setUserApiKey(apiKeyInput.trim());
                      setStage("role-selection");
                    }
                  }}
                  placeholder="AIzaSy..."
                  style={{ ...inputStyle, textAlign: "center", fontSize: 13, padding: "14px 16px", fontFamily: "monospace", letterSpacing: "0.06em", marginBottom: 8 }}
                  autoFocus
                />
                {apiKeyError && <p style={{ fontSize: 11, color: "rgba(255,80,80,0.85)", marginBottom: 12 }}>{apiKeyError}</p>}

                {/* CTA */}
                <button
                  onClick={() => {
                    if (apiKeyInput.trim().length < 10) { setApiKeyError("That doesn't look like a valid API key."); return; }
                    sessionStorage.setItem("careerforge_gemini_key", apiKeyInput.trim());
                    setUserApiKey(apiKeyInput.trim());
                    setStage("role-selection");
                  }}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 11, border: "none", cursor: apiKeyInput.trim().length > 10 ? "pointer" : "not-allowed", background: apiKeyInput.trim().length > 10 ? "#fff" : "rgba(255,255,255,0.1)", color: apiKeyInput.trim().length > 10 ? "#000" : "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", transition: "all .2s", marginBottom: 20 }}>
                  Activate Simulation Engine →
                </button>

                {/* Helper link */}
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", lineHeight: 1.6 }}>
                  Don't have one?{" "}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
                    style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>
                    Get a free key at aistudio.google.com
                  </a>
                  {" "}— 1,500 requests/day, no credit card.
                </p>

                {/* Reassurance badges */}
                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 20 }}>
                  {["🔒 Client-side only", "🚫 Never logged", "♻️ Cached for session"].map(t => (
                    <span key={t} style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>{t}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ SETUP ══════════════════════════════════════════════════════════ */}
          {stage === "role-selection" && (
            <motion.div key="setup"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.45 }}
              style={{ width: "100%", maxWidth: 500 }}
            >
              <div style={{ ...panel, padding: "44px 40px" }}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 36 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                    <BrainCircuit size={24} color="rgba(255,255,255,0.75)" />
                  </div>
                  <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>Agentic Engine</h1>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 8 }}>Multi-Agent Interview Simulation Pipeline</p>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 4, marginBottom: 28, flexWrap: "wrap", gap: 2 }}>
                  {["Technical", "HR & Culture", "System Design", "Coding Round"].map(t => (
                    <button key={t} onClick={() => setInterviewType(t)} style={{ flex: 1, minWidth: 80, padding: "9px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 9, border: "none", cursor: "pointer", background: interviewType === t ? "#fff" : "transparent", color: interviewType === t ? "#000" : "rgba(255,255,255,0.33)", transition: "all .2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      {t === "Coding Round" && <Code2 size={10} />}{t}
                    </button>
                  ))}
                </div>

                {/* Config grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
                  {[
                    { lbl: "Company", val: company, set: setCompany, opts: [["Agnostic","General"], ["Google","Google"], ["Amazon","Amazon"], ["Stripe","Stripe"]] },
                    { lbl: "Tone", val: persona, set: setPersona, opts: [["Harsh Tech Lead","Strict"], ["Friendly Microsoft HR","Friendly"], ["Chaotic Startup Founder","Startup"]] },
                    { lbl: "Timer", val: timerMode, set: setTimerMode, opts: [["Practice Mode","Practice"], ["Pressure Mode","Pressure"], ["Rapid Fire","Rapid 30s"]] },
                  ].map(({ lbl, val, set, opts }) => (
                    <div key={lbl}>
                      <span style={label}>{lbl}</span>
                      <select value={val} onChange={e => set(e.target.value)} style={{ ...inputStyle, padding: "9px 12px", fontSize: 11 }}>
                        {opts.map(([v, l]) => <option key={v} value={v} style={{ background: "#111" }}>{l}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Role input */}
                <input
                  type="text" value={role}
                  onChange={e => setRole(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && startInterview()}
                  placeholder="Enter job target (e.g. Senior Frontend Dev)"
                  style={{ ...inputStyle, marginBottom: 12, fontSize: 14, padding: "13px 16px" }}
                />

                {/* Resume upload */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${resumeContext ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, cursor: "pointer", transition: "all .2s" }}>
                    <input type="file" accept=".pdf" style={{ display: "none" }} onChange={e => handleResumeUpload(e.target.files[0])} />
                    {isParsingResume
                      ? <Loader2 size={14} color="rgba(255,255,255,0.5)" style={{ animation: "spin 1s linear infinite" }} />
                      : resumeContext
                      ? <CheckCircle size={14} color="rgba(255,255,255,0.7)" />
                      : <Upload size={14} color="rgba(255,255,255,0.35)" />}
                    <span style={{ fontSize: 12, color: resumeContext ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)" }}>
                      {isParsingResume ? "Parsing resume…"
                        : resumeContext ? `Resume loaded — ${resumeContext.recent_role || "profile extracted"}`
                        : "Upload resume PDF (optional) — personalizes questions"}
                    </span>
                  </label>
                </div>

                {/* CTA */}
                <button
                  onClick={startInterview}
                  disabled={!role || isTyping || !userId || !userApiKey}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 11, border: "none", cursor: (!role || !userId || isTyping || !userApiKey) ? "not-allowed" : "pointer", background: (!role || !userId || isTyping || !userApiKey) ? "rgba(255,255,255,0.1)" : "#fff", color: (!role || !userId || isTyping || !userApiKey) ? "rgba(255,255,255,0.35)" : "#000", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s" }}>
                  {isTyping ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> :
                    !userId ? <><ShieldAlert size={14} /> Sign in to access</> :
                    !userApiKey ? <><span style={{ fontSize: 13 }}>🔑</span> Enter your Gemini API key</> :
                    <><Rocket size={14} /> Start Simulation</>}
                </button>
              </div>
            </motion.div>
          )}

          {/* ══ INTERVIEW ════════════════════════════════════════════════════ */}
          {stage === "interview" && (
            <motion.div key="interview"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ width: "100%", maxWidth: 1100, display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, height: "82vh" }}
            >
              {/* Chat */}
              <div style={{ ...panel, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: isAiSpeaking ? "#fff" : isRecording ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }} />
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{persona}</p>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>{interviewType} · {company}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.2)", color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>{currentDifficulty}</span>
                    {timerMode !== "Practice Mode" && (
                      <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 8, border: `1px solid ${timeLeft <= 15 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.1)"}`, color: timeLeft <= 15 ? "#fff" : "rgba(255,255,255,0.45)" }}>
                        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {chatHistory.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      style={{ display: "flex", justifyContent: msg.role === "ai" ? "flex-start" : "flex-end", paddingLeft: msg.isFollowUp ? 24 : 0 }}>
                      <div style={{ maxWidth: "82%", borderRadius: msg.role === "ai" ? "4px 18px 18px 18px" : "18px 4px 18px 18px", padding: "14px 18px", background: msg.role === "ai" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)", border: `1px solid rgba(255,255,255,${msg.role === "ai" ? "0.07" : "0.13"})`, fontSize: 13, lineHeight: 1.65 }}>
                        {msg.role === "ai" && i === chatHistory.length - 1 && !msg.evaluation && !isTyping
                          ? <TypewriterText text={msg.text} />
                          : <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.text}</p>}
                        {msg.evaluation && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Neural Score</span>
                              <span style={{ fontSize: 18, fontWeight: 900, color: msg.evaluation.score >= 7 ? "#fff" : "rgba(255,255,255,0.5)" }}>{msg.evaluation.score}<span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>/10</span></span>
                            </div>
                            <div style={{ width: "100%", height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 99, marginBottom: 8 }}>
                              <div style={{ width: `${msg.evaluation.score * 10}%`, height: "100%", background: "#fff", borderRadius: 99 }} />
                            </div>
                            {msg.evaluation.time_complexity && (
                              <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>T: {msg.evaluation.time_complexity}</span>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>S: {msg.evaluation.space_complexity}</span>
                              </div>
                            )}
                            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>{msg.evaluation.suggestions}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px 18px 18px 18px", padding: "12px 18px", width: "fit-content" }}>
                        {[0, 100, 200].map(d => <div key={d} className="bounce-dot" style={{ width: 5, height: d === 100 ? 14 : 8, background: "rgba(255,255,255,0.4)", borderRadius: 3, animationDelay: `${d}ms` }} />)}
                        <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginLeft: 6 }}>Evaluating</span>
                      </div>
                      {isAdjusting && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", fontStyle: "italic", marginLeft: 12 }}>Adjusting difficulty...</p>}
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Hint bar */}
                <div style={{ padding: "8px 20px", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", display: "flex", gap: 8, alignItems: "center" }}>
                  <Lightbulb size={11} />
                  {interviewType === "Technical" && "FORMAT: 1. Concept  2. Implementation  3. Edge Cases"}
                  {interviewType === "System Design" && "FORMAT: 1. Requirements  2. Architecture  3. Bottlenecks"}
                  {interviewType === "HR & Culture" && "STAR: Situation → Task → Action → Result"}
                  {interviewType === "Coding Round" && "Write your solution then hit Submit — AI grades correctness, time & space complexity"}
                </div>

                {/* Input */}
                <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)", display: "flex", gap: 10, alignItems: "flex-end" }}>
                  {!isCodingRound && (
                    <button onClick={toggleRecording} style={{ width: 46, height: 46, borderRadius: 12, border: `1px solid ${isRecording ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)"}`, background: isRecording ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)", color: isRecording ? "#fff" : "rgba(255,255,255,0.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isRecording ? <Mic size={18} /> : <MicOff size={18} />}
                    </button>
                  )}
                  <div style={{ flex: 1, position: "relative" }}>
                    {isCodingRound ? (
                      <div style={{ paddingBottom: 44 }}>
                        <CodeEditor value={answer} onChange={setAnswer} language={codeLanguage} onLanguageChange={setCodeLanguage} />
                      </div>
                    ) : (
                      <textarea value={answer} onChange={e => setAnswer(e.target.value)}
                        placeholder={isRecording ? "Listening…" : "Type your answer…"}
                        rows={2}
                        style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "11px 50px 11px 14px", fontSize: 13, color: "#fff", fontFamily: "monospace", outline: "none", resize: "none", boxSizing: "border-box" }} />
                    )}
                    <button onClick={() => submitAnswer()} disabled={!answer.trim() || isTyping}
                      style={{ position: "absolute", right: 8, bottom: 8, width: 34, height: 34, borderRadius: 8, background: answer.trim() && !isTyping ? "#fff" : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={15} color={answer.trim() && !isTyping ? "#000" : "rgba(255,255,255,0.3)"} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ ...panel, padding: 20 }}>
                  <p style={{ ...label, display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}><Activity size={12} /> Live Sensors</p>
                  <Meter label="Clarity" value={liveClarity} />
                  <Meter label="Confidence" value={liveConfidence} />
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", textAlign: "center", fontFamily: "monospace", marginTop: 8 }}>Type to activate</p>
                </div>
                <div style={{ ...panel, padding: 20, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {weaknesses.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
                      <Brain size={11} color="rgba(255,255,255,0.4)" />
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recall: {weaknesses[0]?.slice(0, 22)}…</span>
                    </div>
                  )}
                  <p style={{ ...label, display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}><Target size={12} /> Neural Profile</p>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", marginBottom: 8 }}>Weaknesses</p>
                    {weaknesses.length === 0 ? <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>None yet</p>
                      : weaknesses.map((w, i) => <p key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>— {w}</p>)}
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", marginBottom: 8, marginTop: 16 }}>Strengths</p>
                    {strengths.length === 0 ? <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>None yet</p>
                      : strengths.map((s, i) => <p key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>+ {s}</p>)}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ DASHBOARD ════════════════════════════════════════════════════ */}
          {stage === "dashboard" && finalSummary && (
            <motion.div key="dashboard" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              style={{ width: "100%", maxWidth: 860, ...panel, padding: "48px 52px" }}>
              <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Simulation Report</h2>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", margin: "0 0 36px" }}>{company} · {interviewType}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
                {[["Peak Difficulty", finalSummary.currentDifficulty], ["Strengths Found", finalSummary.globalStrengths.length], ["Questions", finalSummary.history.length]].map(([l, v]) => (
                  <div key={l} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 18px", textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{l}</p>
                    <p style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>{v}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button onClick={downloadReport} style={{ flex: 1, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Download size={14} /> Download PDF Report
                </button>
                <button onClick={() => window.location.reload()} style={{ flex: 1, padding: 14, borderRadius: 12, background: "#fff", color: "#000", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", border: "none", cursor: "pointer" }}>
                  New Simulation
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .bounce-dot { animation: bounce 0.6s ease-in-out infinite alternate; }
        @keyframes bounce { from { transform: scaleY(0.5); } to { transform: scaleY(1.2); } }
        select option { background: #111; }
        textarea::placeholder, input::placeholder { color: rgba(255,255,255,0.2); }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
