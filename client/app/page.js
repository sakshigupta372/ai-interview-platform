"use client"

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Mic, MicOff, Lightbulb, Target, Brain, Activity,
  Download, Key, X, Volume2, Video,
} from "lucide-react";
import { getApiBase } from "@/lib/api";
import { APP_NAME, loadGeminiKey, saveGeminiKey, loadResumeContext, saveResumeContext } from "@/lib/brand";
import { toast } from "@/lib/toast";
import { speak as ttsSpeak, cancelSpeech, loadElevenLabsKey, saveElevenLabsKey, unlockSpeech, primeInterviewerVoice, setVoiceSpeed, loadVoiceSpeed, playAck, warmupAcks, flushSpokenSentences } from "@/lib/tts";
import { interviewerTitle, interviewerPromptRole, toneLabel } from "@/lib/persona";
import { DeepgramSTT, loadDeepgramKey, saveDeepgramKey } from "@/lib/deepgramSTT";
import InterviewerAvatar from "@/components/InterviewerAvatar";
import VideoCallPanel from "@/components/VideoCallPanel";
import LandingPage from "@/components/LandingPage";
import SetupEngine from "@/components/SetupEngine";
import "@/app/room.css";
import { getCompany } from "@/lib/companies";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import dynamic from "next/dynamic";

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), { ssr: false });

const SETUP_DRAFT_KEY = "nexus_setup_draft";

function readSetupDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SETUP_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSetupDraft(draft) {
  try { sessionStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify(draft)); } catch {}
}
function clearSetupDraft() {
  try { sessionStorage.removeItem(SETUP_DRAFT_KEY); } catch {}
}

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
          const a = 0.045 + inf * 0.22;
          const s = (cell * 0.3) * (1 + inf * 0.5);
          ctx.save(); ctx.translate(cx, cy);
          ctx.globalAlpha = a;
          ctx.fillStyle = "#4A3DF0";
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
  return <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#0E1A3A", margin: 0 }}>{out}</p>;
}

// ─── Small metre bar ─────────────────────────────────────────────────────────
function Meter({ label, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#596079", marginBottom: 6 }}>
        <span>{label}</span><span style={{ fontFamily: "monospace" }}>{Math.floor(value)}%</span>
      </div>
      <div style={{ width: "100%", height: 2, background: "#ECEBFE", borderRadius: 99 }}>
        <div style={{ width: `${value}%`, height: "100%", background: "#4A3DF0", borderRadius: 99, transition: "width .4s" }} />
      </div>
    </div>
  );
}

// ─── Shared panel style ───────────────────────────────────────────────────────
const panel = { background: "#FFFFFF", border: "1px solid #E3E5F1", borderRadius: 20, boxShadow: "0 1px 2px rgba(14,26,58,.04), 0 18px 40px -22px rgba(14,26,58,.28)" };
const label = { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#596079", marginBottom: 6, display: "block" };
const inputStyle = { width: "100%", background: "#FBFAF7", border: "1px solid #E3E5F1", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#0E1A3A", outline: "none", boxSizing: "border-box" };

// ─── Chat message with ideal-answer toggle ────────────────────────────────────
function ChatMessage({ msg, onPlay }) {
  const [showIdeal, setShowIdeal] = useState(false);
  const ev = msg.evaluation;
  const isAi = msg.role === "ai";
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", justifyContent: isAi ? "flex-start" : "flex-end", paddingLeft: msg.isFollowUp ? 24 : 0 }}>
      <div style={{
        maxWidth: "88%",
        borderRadius: isAi ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
        padding: "14px 18px",
        background: isAi ? "#EFF0FB" : "#FFFFFF",
        border: `1px solid ${isAi ? "#DCE0FA" : "#E3E5F1"}`,
        fontSize: 13, lineHeight: 1.65, color: "#0E1A3A",
      }}>
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.text}</p>
        {isAi && onPlay && (
          <button type="button" onClick={() => { unlockSpeech(); primeInterviewerVoice(); onPlay(msg.text); }} aria-label="Play question"
            style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #DCE0FA", color: "#4A3DF0", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            <Volume2 size={13} /> Listen
          </button>
        )}
        {ev && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E3E5F1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: "#596079", letterSpacing: "0.08em", textTransform: "uppercase" }}>Score</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: ev.score >= 7 ? "#0B6B60" : "#0E1A3A" }}>{ev.score}<span style={{ fontSize: 11, color: "#9AA0B8" }}>/10</span></span>
            </div>
            <div style={{ width: "100%", height: 2, background: "#ECEBFE", borderRadius: 99, marginBottom: 8 }}>
              <div style={{ width: `${ev.score * 10}%`, height: "100%", background: "#4A3DF0", borderRadius: 99 }} />
            </div>
            {ev.time_complexity && (
              <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#596079", fontFamily: "monospace" }}>Est. T: {ev.time_complexity}</span>
                <span style={{ fontSize: 10, color: "#596079", fontFamily: "monospace" }}>Est. S: {ev.space_complexity}</span>
              </div>
            )}
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#596079", fontStyle: "italic" }}>{ev.suggestions}</p>
            {ev.ideal_answer && (
              <>
                <button onClick={() => setShowIdeal(p => !p)}
                  style={{ fontSize: 10, color: "#4A3DF0", background: "#ECEBFE", border: "1px solid #DCE0FA", borderRadius: 6, padding: "4px 10px", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {showIdeal ? "Hide" : "Show"} ideal answer
                </button>
                {showIdeal && (
                  <div style={{ marginTop: 10, padding: "10px 14px", background: "#FBFAF7", border: "1px solid #E3E5F1", borderRadius: 10, fontSize: 12, color: "#36405F", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                    {ev.ideal_answer}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── SSE streaming helper ─────────────────────────────────────────────────────
async function readSSEStream(url, body, onChunk, onSession, onDone, onError, getToken) {
  let response;
  try {
    const token = getToken ? await getToken() : null;
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    onError?.("Could not reach the server. Wait a moment and try again.");
    return;
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Stream failed" }));
    onError?.(err.error || "Stream failed");
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === "session") onSession?.(data.sessionId);
        else if (data.type === "chunk") onChunk?.(data.text);
        else if (data.type === "done") onDone?.(data.fullQuestion);
        else if (data.type === "error") onError?.(data.error);
      } catch {}
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { userId, isLoaded, getToken } = useAuth();
  const { user } = useUser();

  const [stage, setStage] = useState("landing");
  const [startError, setStartError] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [role, setRole] = useState("");
  const [persona, setPersona] = useState("Harsh Tech Lead");
  const [company, setCompany] = useState("Agnostic");
  const [interviewType, setInterviewType] = useState("Technical");
  const [timerMode, setTimerMode] = useState("Pressure Mode");
  const [language, setLanguage] = useState("English");
  const [voiceSpeed, setVoiceSpeedState] = useState(1.5);

  const [sessionId, setSessionId] = useState("");
  const [userApiKey, setUserApiKey] = useState("");
  const [freeQuota, setFreeQuota] = useState(null); // { limit, used, remaining, platformKeyAvailable }
  const [resumeContext, setResumeContext] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [isParsingResume, setIsParsingResume] = useState(false);

  const getCandidateName = () =>
    resumeContext?.name ||
    user?.firstName ||
    user?.fullName?.split(" ")[0] ||
    null;

  const [codeLanguage, setCodeLanguage] = useState("javascript");

  // Declared before the init effect below so the effect reads already-initialized setters.
  const [drillMode, setDrillMode] = useState(null); // { weakness, drillQuestion }
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [deepgramKey, setDeepgramKey] = useState("");

  // After Clerk loads and user is signed in, check if we already have their key in sessionStorage.
  // If not, redirect them to the API Key entry screen.
  useEffect(() => {
    if (!isLoaded) return;
    if (userId) {
      const saved = loadGeminiKey();
      if (saved) setUserApiKey(saved);
      const savedResume = loadResumeContext();
      if (savedResume) setResumeContext(savedResume);
      const el = loadElevenLabsKey(); if (el) setElevenLabsKey(el);
      const dg = loadDeepgramKey();   if (dg) setDeepgramKey(dg);
      const drillRaw = sessionStorage.getItem("nexus_drill_context");
      if (drillRaw) {
        try { setDrillMode(JSON.parse(drillRaw)); setStage("setup"); } catch {}
        sessionStorage.removeItem("nexus_drill_context");
      }
    }
    setVoiceSpeedState(loadVoiceSpeed());
    const draft = readSetupDraft();
    if (draft?.open) {
      if (draft.interviewType) setInterviewType(draft.interviewType);
      if (typeof draft.role === "string") setRole(draft.role);
      if (draft.company) setCompany(draft.company);
      if (draft.persona) setPersona(draft.persona);
      if (draft.timerMode) setTimerMode(draft.timerMode);
      if (draft.language) setLanguage(draft.language);
      setStage(draft.stage === "api-key" ? "api-key" : "setup");
    }
  }, [isLoaded, userId]);

  useEffect(() => {
    if (stage !== "setup" && stage !== "api-key") return;
    writeSetupDraft({ open: true, stage, interviewType, role, company, persona, timerMode, language });
  }, [stage, interviewType, role, company, persona, timerMode, language]);

  const playTone = (freq = 880, dur = 0.08) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };
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
  const deepgramRef = useRef(null);
  const audioCtxRef = useRef(null);
  const dgInterimRef = useRef("");
  const timerRef = useRef(null);
  const submitLock = useRef(false);
  const busyRef = useRef(false);
  const submitAnswerRef = useRef(null);
  const lastScoreRef = useRef(5);
  const spokenUpTo = useRef(0);

  // Voice setup — browser SR as fallback
  useEffect(() => {
    if (typeof window === "undefined") return;
    synthRef.current = window.speechSynthesis;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = "en-IN";
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setAnswer(t);
    };
    r.onerror = (ev) => {
      setIsRecording(false);
      const err = ev?.error;
      if (err === "not-allowed") toast.error("Allow microphone access to answer by voice.");
      else if (err === "no-speech") toast.error("No speech heard. Click the mic and try again.");
      else if (err && err !== "aborted") toast.error("Microphone error. Check Chrome permissions and try again.");
    };
    r.onend = () => setIsRecording(false);
    recognitionRef.current = r;
  }, []);

  const stopListening = () => {
    if (deepgramRef.current) {
      deepgramRef.current.stop();
      deepgramRef.current = null;
      setAnswer(prev => prev + (dgInterimRef.current ? " " + dgInterimRef.current : ""));
      dgInterimRef.current = "";
    } else if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsRecording(false);
  };

  const startListening = async (clear = false) => {
    if (isRecording || isCodingRound) return;
    unlockSpeech();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Allow microphone access in the browser popup, then click the mic.");
      return;
    }
    if (clear) setAnswer("");
    dgInterimRef.current = "";
    if (deepgramKey?.trim().length > 10) {
      const dg = new DeepgramSTT(deepgramKey.trim());
      deepgramRef.current = dg;
      dg.start({
        onInterim: (t) => { dgInterimRef.current = t; setAnswer(dgInterimRef.current); },
        onFinal: (t) => { dgInterimRef.current = ""; setAnswer(prev => (prev + " " + t).trim()); },
        onError: (e) => { console.warn("Deepgram:", e); deepgramRef.current = null; setIsRecording(false); },
      });
      setIsRecording(true);
      return;
    }
    if (!recognitionRef.current) {
      toast.error("Use Chrome or Edge to answer by voice.");
      return;
    }
    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (e) {
      toast.error("Could not start the microphone. Click the mic and try again.");
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopListening();
    else startListening(true);
  };

  const speechHooks = {
    onStart: () => setIsAiSpeaking(true),
    onEnd: () => setIsAiSpeaking(false),
  };

  const speak = (text) => {
    if (!text?.trim()) return;
    ttsSpeak(text, persona, elevenLabsKey, speechHooks, language).then((ok) => {
      if (ok === false) toast.error("Could not play interviewer voice. Unmute the Chrome tab and click Listen.");
    }).catch(() => setIsAiSpeaking(false));
  };

  const speakStream = (text, extra) => {
    spokenUpTo.current = flushSpokenSentences(
      text,
      spokenUpTo.current,
      language,
      speechHooks,
      extra
    );
  };

  // Live meters
  useEffect(() => {
    if (!answer.trim()) { setLiveClarity(0); setLiveConfidence(0); return; }
    const words = answer.trim().split(/\s+/).length;
    setLiveClarity(Math.min(100, words * 2.5));
    const h = (answer.match(/\b(hmm|uh|um|maybe|probably|guess)\b/gi) || []).length;
    setLiveConfidence(Math.max(0, Math.min(100, words * 2 - h * 15)));
  }, [answer]);

  // Timer with audio cues
  useEffect(() => {
    if (stage !== "interview" || isTyping || timerMode === "Practice Mode") return;
    const start = timerMode === "Rapid Fire" ? 30 : 120; setTimeLeft(start);
    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) {
          clearInterval(timerRef.current);
          if (!busyRef.current) submitAnswerRef.current?.("Time up.");
          return 0;
        }
        if (p === 30) playTone(440, 0.18);          // 30s warning — low tick
        else if (p <= 10) playTone(660, 0.07);      // last 10s — faster ticking
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [stage, isTyping, chatHistory.length, timerMode]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, isTyping, streamingText]);

  const apiBase = getApiBase();
  const isCodingRound = interviewType === "Coding Round";
  const freeInterviewAvailable = Boolean(freeQuota?.platformKeyAvailable && freeQuota.remaining > 0);
  const canUseAi = Boolean(userApiKey) || freeInterviewAvailable;

  // ─── Free interviews on the platform key ─────────────────────────────────
  const refreshQuota = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${apiBase}/interview/quota`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 70000,
      });
      setFreeQuota(res.data);
    } catch {
      setFreeQuota(null);
    }
  };

  useEffect(() => {
    if (!isLoaded || !userId) return;
    refreshQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId]);

  // ─── Resume upload (setup screen) ────────────────────────────────────────
  const parseResume = async (file, key) => {
    setIsParsingResume(true);
    try {
      const form = new FormData();
      form.append("resume", file);
      if (key) form.append("userApiKey", key);
      const token = await getToken();
      const res = await axios.post(`${apiBase}/resume/parse`, form, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 60000,
      });
      if (res.data.context) {
        setResumeContext(res.data.context);
        saveResumeContext(res.data.context);
      } else {
        setResumeFile(null);
        toast.error("Couldn't read details from that resume. Check your API key or try another PDF.");
      }
    } catch (e) {
      setResumeFile(null);
      toast.error(e.response?.data?.error || "Could not read that resume. Try again.");
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleResumeUpload = (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Please choose a PDF file."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Resume must be 5 MB or smaller."); return; }
    setResumeFile(file);
    setResumeContext(null);
    saveResumeContext(null);
    if (canUseAi) parseResume(file, userApiKey);
  };

  const handleResumeClear = () => {
    setResumeFile(null);
    setResumeContext(null);
    saveResumeContext(null);
  };

  // A file picked before AI access existed gets read as soon as a key or free quota arrives.
  useEffect(() => {
    if (resumeFile && canUseAi && !resumeContext && !isParsingResume) parseResume(resumeFile, userApiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseAi, userApiKey, resumeFile]);

  // ─── Config modal open/close ─────────────────────────────────────────────
  const openConfig = (type) => {
    if (typeof type === "string") setInterviewType(type);
    setStage("setup");
  };
  const closeConfig = () => {
    clearSetupDraft();
    setStartError("");
    setStage("landing");
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname || "/");
    }
  };

  // ─── Change API key ──────────────────────────────────────────────────────
  const handleChangeKey = () => { setApiKeyInput(""); setApiKeyError(""); setShowKeyModal(true); };
  const confirmNewKey = () => {
    if (apiKeyInput.trim().length < 10) { setApiKeyError("That doesn't look like a valid API key."); return; }
    saveGeminiKey(apiKeyInput.trim());
    setUserApiKey(apiKeyInput.trim());
    setShowKeyModal(false);
    setApiKeyInput("");
    setApiKeyError("");
  };

  const downloadReport = async () => {
    if (!finalSummary) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text(`${APP_NAME} — Interview Report`, W / 2, y, { align: "center" }); y += 10;

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

    doc.save(`nexus-ai-report-${Date.now()}.pdf`);
  };

  const startInterview = async () => {
    if (!role || !userId) return;
    setIsTyping(true);
    setStreamingText("");
    setChatHistory([]);
    setStartError("");
    unlockSpeech();
    if (!isCodingRound) warmupAcks(language);
    spokenUpTo.current = 0;
    const co = getCompany(company);
    const companyLabel = company === "Agnostic" ? "a tech company" : company;
    const ctx = interviewerPromptRole(persona, interviewType, companyLabel, co.tagline, role);
    let accum = "";
    let gotSession = false;
    let failMsg = "";
    let appended = false;
    busyRef.current = true;
    try {
      await readSSEStream(
        `${apiBase}/interview/stream-start`,
        { role: ctx, userApiKey, resumeContext: resumeContext || undefined, isCodingRound, candidateName: getCandidateName() || undefined, drillFocus: drillMode?.weakness || undefined, language },
        (chunk) => {
          accum += chunk;
          setStreamingText(accum);
          if (!isCodingRound) speakStream(accum);
        },
        (sid) => {
          gotSession = true;
          setSessionId(sid);
          setCurrentDifficulty("Medium");
          clearSetupDraft();
          setStage("interview");
        },
        (fullQuestion) => {
          if (appended) return;
          appended = true;
          setStreamingText("");
          setChatHistory([{ role: "ai", text: fullQuestion, isInitial: true }]);
          if (!gotSession) {
            gotSession = true;
            clearSetupDraft();
            setStage("interview");
          }
          if (!isCodingRound) speakStream(fullQuestion, { final: true });
        },
        (err) => {
          const onLiveSite = typeof window !== "undefined" && window.location.hostname.includes("vercel.app");
          const missingApiUrl = onLiveSite && apiBase.includes("localhost");
          failMsg = missingApiUrl
            ? "Backend not configured. Set NEXT_PUBLIC_API_URL on Vercel to your Render URL, then redeploy."
            : err || "Could not reach the server. Render may be waking up (~60s on free tier). Wait a moment and try again.";
          toast.error(failMsg);
          setStartError(failMsg);
          setStage("setup");
        },
        getToken
      );
      if (!gotSession && !failMsg) {
        failMsg = "Could not start the interview. Make sure the backend is running, then try again.";
        toast.error(failMsg);
        setStartError(failMsg);
        setStage("setup");
      }
    } catch (err) {
      toast.error("Could not reach the server. Wait a moment and try again.");
      setStartError("Could not reach the server. Wait a moment and try again.");
      setStage("setup");
    } finally {
      setIsTyping(false);
      busyRef.current = false;
      if (!userApiKey) refreshQuota();
    }
  };

  const submitAnswer = async (forced = null) => {
    if (submitLock.current || busyRef.current) return;
    const userAns = forced || answer;
    if (!userAns.trim()) return;
    submitLock.current = true;
    busyRef.current = true;
    if (isRecording) stopListening();
    cancelSpeech();
    unlockSpeech();
    if (!isCodingRound) playAck(language);
    spokenUpTo.current = 0;
    clearInterval(timerRef.current);
    const hist = [...chatHistory, { role: "user", text: userAns }];
    setChatHistory(hist);
    setAnswer("");
    setIsTyping(true);
    setStreamingText("");
    setIsAdjusting(false);

    const applyEval = (data) => {
      if (!data) return;
      const { evaluation, sessionSummary } = data;
      if (evaluation) {
        lastScoreRef.current = evaluation.score ?? lastScoreRef.current;
        setChatHistory((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === "user" && !next[i].evaluation) {
              next[i] = { ...next[i], evaluation };
              break;
            }
          }
          return next;
        });
      }
      if (sessionSummary) {
        setStrengths(sessionSummary.globalStrengths || []);
        setWeaknesses(sessionSummary.globalWeaknesses || []);
        setCurrentDifficulty(sessionSummary.currentDifficulty || "Medium");
      }
    };

    const answeredCount = hist.filter((m) => m.role === "user").length;
    const isLastTurn = answeredCount >= 5;

    const runEval = async () => {
      try {
        const token = await getToken();
        const res = await axios.post(
          `${apiBase}/interview/evaluate`,
          { sessionId, answer: userAns, userApiKey, isCodingRound, language },
          { timeout: 90000, headers: { Authorization: `Bearer ${token}` } }
        );
        applyEval(res.data);
        return res.data;
      } catch (err) {
        console.warn("evaluate:", err?.response?.data?.error || err.message);
        return null;
      }
    };

    try {
      if (isLastTurn) {
        const data = await runEval();
        setIsTyping(false);
        if (data?.isComplete || data?.sessionSummary) {
          setFinalSummary(data.sessionSummary || data);
          setStage("debrief");
        } else {
          toast.error("Could not finish evaluation. Try submit again.");
          setChatHistory(hist.slice(0, -1));
          setAnswer(userAns);
        }
        return;
      }

      let evalStarted = false;
      const startEval = () => {
        if (evalStarted) return;
        evalStarted = true;
        runEval();
      };

      let accum = "";
      let appended = false;
      await readSSEStream(
        `${apiBase}/interview/stream-next`,
        {
          sessionId,
          answer: userAns,
          userApiKey,
          resumeContext: resumeContext || undefined,
          isCodingRound,
          candidateName: getCandidateName() || undefined,
          evaluationScore: lastScoreRef.current,
          nextDifficulty: currentDifficulty,
          language,
        },
        (chunk) => {
          accum += chunk;
          setStreamingText(accum);
          startEval();
          if (!isCodingRound) speakStream(accum);
        },
        null,
        (fullQuestion) => {
          if (appended) return;
          appended = true;
          startEval();
          setStreamingText("");
          setChatHistory((prev) => [...prev, { role: "ai", text: fullQuestion, isFollowUp: true }]);
          if (!isCodingRound) speakStream(fullQuestion, { final: true });
        },
        (err) => { toast.error(err || "Could not get next question. Try again."); },
        getToken
      );
    } catch (err) {
      const isNetwork = !err.response;
      const msg = isNetwork
        ? "Could not reach the server. Render may be waking up — wait ~60s and try again."
        : err.response?.data?.error || `Server error ${err.response?.status || ""}`.trim();
      toast.error(msg);
      setChatHistory(hist.slice(0, -1));
      setAnswer(userAns);
    } finally {
      setIsTyping(false);
      setIsAdjusting(false);
      busyRef.current = false;
      submitLock.current = false;
    }
  };

  // Keep the timer effect pointed at the latest submitAnswer (avoids stale closures).
  useEffect(() => { submitAnswerRef.current = submitAnswer; });

  // ─── Render ────────────────────────────────────────────────────────────────
  const showLanding = stage === "landing";
  const showSetup = stage === "setup" || stage === "api-key";

  return (
    <>
      {showLanding && (
        <LandingPage
          onStart={openConfig}
          userId={userId}
          isLoaded={isLoaded}
          userApiKey={userApiKey}
          onChangeKey={handleChangeKey}
        />
      )}
      {showSetup && (
        <SetupEngine
          stage={stage}
          onBack={closeConfig}
          onStart={startInterview}
          isLoaded={isLoaded}
          userId={userId}
          userApiKey={userApiKey}
          setUserApiKey={setUserApiKey}
          freeQuota={freeQuota}
          role={role}
          setRole={setRole}
          company={company}
          setCompany={setCompany}
          persona={persona}
          setPersona={setPersona}
          timerMode={timerMode}
          setTimerMode={setTimerMode}
          interviewType={interviewType}
          setInterviewType={setInterviewType}
          isTyping={isTyping}
          drillMode={drillMode}
          setDrillMode={setDrillMode}
          apiKeyInput={apiKeyInput}
          setApiKeyInput={setApiKeyInput}
          apiKeyError={apiKeyError}
          setApiKeyError={setApiKeyError}
          onNeedKey={() => setStage("api-key")}
          onKeySaved={() => setStage("setup")}
          startError={startError}
          language={language}
          setLanguage={setLanguage}
          resumeFile={resumeFile}
          resumeContext={resumeContext}
          isParsingResume={isParsingResume}
          onResumeUpload={handleResumeUpload}
          onResumeClear={handleResumeClear}
        />
      )}
      {/* ── Change Key Modal ── */}
      <AnimatePresence>
        {showKeyModal && (
          <motion.div key="key-modal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(14,26,58,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(8px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowKeyModal(false); }}
          >
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              style={{ ...panel, padding: "36px 32px", width: "100%", maxWidth: 420, position: "relative" }}>
              <button onClick={() => setShowKeyModal(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#9AA0B8", cursor: "pointer", padding: 4 }}>
                <X size={16} />
              </button>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: "#0E1A3A" }}>{userApiKey ? "Change Gemini Key" : "Add Your Gemini Key"}</h2>
              <p style={{ fontSize: 12, color: "#596079", margin: "0 0 24px", lineHeight: 1.6 }}>
                {userApiKey ? "Your current key will be replaced for this session." : "Your own key gives unlimited interviews. It stays in this browser tab."}
              </p>
              <input type="password" value={apiKeyInput}
                onChange={e => { setApiKeyInput(e.target.value); setApiKeyError(""); }}
                onKeyDown={e => e.key === "Enter" && confirmNewKey()}
                placeholder="AIzaSy..." autoFocus
                style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.06em", marginBottom: 8 }}
              />
              {apiKeyError && <p style={{ fontSize: 11, color: "rgba(255,80,80,0.85)", marginBottom: 12 }}>{apiKeyError}</p>}
              <button onClick={confirmNewKey}
                style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer", background: apiKeyInput.trim().length > 10 ? "#4A3DF0" : "#E3E5F1", color: apiKeyInput.trim().length > 10 ? "#fff" : "#9AA0B8", fontWeight: 600, fontSize: 14, marginTop: 4 }}>
                Update Key →
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showLanding && !showSetup && (
    <div className="nx-room">
      <ShapeGrid />

      {/* NAV */}
      <nav className="nx-room-nav">
        <button type="button" className="nx-room-logo" onClick={() => { clearSetupDraft(); setStage("landing"); }} aria-label="Back to home">
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            <rect x="1" y="1" width="28" height="28" rx="9" fill="#0E1A3A" />
            <path d="M10 20.5V9.5l10 11V9.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="20" cy="9.5" r="2.6" fill="#4A3DF0" stroke="#fff" strokeWidth="1.2" />
          </svg>
          <span>NEXUS<b>.AI</b></span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLoaded && !userId && (
            <SignInButton mode="modal">
              <button type="button" className="nav-txt-btn">Log in</button>
            </SignInButton>
          )}
          {isLoaded && userId && (
            <>
              <button onClick={() => window.location.href = "/mentor"} className="nav-txt-btn">Mentor</button>
              <button onClick={() => window.location.href = "/profile"} className="nav-txt-btn">History</button>
              <button onClick={handleChangeKey} title={userApiKey ? "Change Gemini API Key" : "Add your Gemini API Key"}
                style={{ background: "#fff", border: "1px solid #E3E5F1", borderRadius: 8, padding: "7px 10px", color: "#596079", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <Key size={13} />
              </button>
              <UserButton />
            </>
          )}
        </div>
      </nav>

      {/* MAIN */}
      <main className="nx-room-main">
        <AnimatePresence mode="wait">

          {/* ══ INTERVIEW ════════════════════════════════════════════════════ */}
          {stage === "interview" && (
            <motion.div key="interview"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="interview-grid"
            >
              {/* Chat */}
              <div style={{ ...panel, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #E3E5F1" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <InterviewerAvatar persona={persona} isSpeaking={isAiSpeaking} isListening={isRecording} />
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13, margin: 0, color: "#0E1A3A" }}>{interviewerTitle(company, interviewType)}</p>
                      <p style={{ fontSize: 10, color: "#596079", margin: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>{interviewType} · {company === "Agnostic" ? "General" : company} · {toneLabel(persona)}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 99, border: "1px solid #DCE0FA", background: "#ECEBFE", color: "#4A3DF0", letterSpacing: "0.06em", textTransform: "uppercase" }}>{currentDifficulty}</span>
                    {timerMode !== "Practice Mode" && (
                      <span className={timeLeft <= 10 ? "timer-urgent" : ""} style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 8, border: `1px solid ${timeLeft <= 15 ? "#E5484D" : "#E3E5F1"}`, color: timeLeft <= 15 ? "#E5484D" : "#36405F", background: "#fff" }}>
                        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {chatHistory.map((msg, i) => (
                    <ChatMessage key={i} msg={msg} onPlay={speak} />
                  ))}
                  {/* Live streaming bubble */}
                  {streamingText && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ maxWidth: "88%", borderRadius: "4px 18px 18px 18px", padding: "14px 18px", background: "#EFF0FB", border: "1px solid #DCE0FA", fontSize: 13, lineHeight: 1.65 }}>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "#0E1A3A" }}>
                          {streamingText}<span className="cursor-blink">▌</span>
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Evaluating indicator (only while waiting for eval response, not while streaming) */}
                  {isTyping && !streamingText && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#EFF0FB", border: "1px solid #DCE0FA", borderRadius: "4px 18px 18px 18px", padding: "12px 18px", width: "fit-content" }}>
                        {[0, 100, 200].map(d => <div key={d} className="bounce-dot" style={{ width: 5, height: d === 100 ? 14 : 8, background: "#4A3DF0", borderRadius: 3, animationDelay: `${d}ms` }} />)}
                        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#596079", letterSpacing: "0.08em", textTransform: "uppercase", marginLeft: 6 }}>Next question</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Hint bar */}
                <div style={{ padding: "8px 20px", borderTop: "1px solid #E3E5F1", fontSize: 10, color: "#596079", fontFamily: "monospace", display: "flex", gap: 8, alignItems: "center" }}>
                  <Lightbulb size={11} />
                  {interviewType === "Technical" && "FORMAT: 1. Concept  2. Implementation  3. Edge Cases"}
                  {interviewType === "System Design" && "FORMAT: 1. Requirements  2. Architecture  3. Bottlenecks"}
                  {interviewType === "HR & Culture" && "STAR: Situation → Task → Action → Result"}
                  {interviewType === "Coding Round" && "Write your solution then hit Submit — AI reviews it (code is not executed) and estimates time & space complexity"}
                </div>

                {/* Input */}
                <div style={{ padding: "14px 16px", borderTop: "1px solid #E3E5F1", background: "#FBFAF7", display: "flex", gap: 10, alignItems: "flex-end" }}>
                  {!isCodingRound && (
                    <button onClick={toggleRecording} title={isRecording ? "Stop listening" : "Speak your answer"} aria-label={isRecording ? "Stop listening" : "Speak your answer"} style={{ width: 46, height: 46, borderRadius: 12, border: `1px solid ${isRecording ? "#4A3DF0" : "#E3E5F1"}`, background: isRecording ? "#ECEBFE" : "#fff", color: isRecording ? "#4A3DF0" : "#596079", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
                        placeholder={isRecording ? "Listening… speak now" : "Type, or click the mic to speak"}
                        rows={2}
                        style={{ width: "100%", background: "#fff", border: "1px solid #E3E5F1", borderRadius: 12, padding: "11px 50px 11px 14px", fontSize: 13, color: "#0E1A3A", fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} />
                    )}
                    <button onClick={() => submitAnswer()} disabled={!answer.trim() || isTyping}
                      style={{ position: "absolute", right: 8, bottom: 8, width: 34, height: 34, borderRadius: 8, background: answer.trim() && !isTyping ? "#4A3DF0" : "#E3E5F1", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={15} color={answer.trim() && !isTyping ? "#fff" : "#9AA0B8"} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="interview-sidebar">
                <div style={{ ...panel, padding: 12 }}>
                  <p style={{ ...label, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Video size={12} /> Video Call
                  </p>
                  <VideoCallPanel
                    persona={persona}
                    isSpeaking={isAiSpeaking}
                    isListening={isRecording}
                    label={getCandidateName() || "You"}
                  />
                </div>
                <div style={{ ...panel, padding: 20 }}>
                  <p style={{ ...label, marginBottom: 10 }}>Voice speed</p>
                  <div className="nx-speed" role="group" aria-label="Voice speed">
                    {[1, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        className={voiceSpeed === rate ? "on" : ""}
                        onClick={() => {
                          setVoiceSpeed(rate);
                          setVoiceSpeedState(rate);
                        }}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ ...panel, padding: 20 }}>
                  <p style={{ ...label, display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}><Activity size={12} /> Live Sensors</p>
                  <Meter label="Clarity" value={liveClarity} />
                  <Meter label="Confidence" value={liveConfidence} />
                  <p style={{ fontSize: 9, color: "#9AA0B8", textAlign: "center", fontFamily: "monospace", marginTop: 8 }}>Type to activate</p>
                </div>
                <div style={{ ...panel, padding: 20, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {weaknesses.length > 0 && (
                    <div style={{ background: "#ECEBFE", border: "1px solid #DCE0FA", borderRadius: 10, padding: "8px 12px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
                      <Brain size={11} color="#4A3DF0" />
                      <span style={{ fontSize: 9, color: "#4A3DF0", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recall: {weaknesses[0]?.slice(0, 22)}…</span>
                    </div>
                  )}
                  <p style={{ ...label, display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}><Target size={12} /> Neural Profile</p>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#9AA0B8", letterSpacing: "0.08em", marginBottom: 8 }}>Weaknesses</p>
                    {weaknesses.length === 0 ? <p style={{ fontSize: 11, color: "#9AA0B8", fontStyle: "italic" }}>None yet</p>
                      : weaknesses.map((w, i) => <p key={i} style={{ fontSize: 11, color: "#36405F", marginBottom: 4 }}>— {w}</p>)}
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#9AA0B8", letterSpacing: "0.08em", marginBottom: 8, marginTop: 16 }}>Strengths</p>
                    {strengths.length === 0 ? <p style={{ fontSize: 11, color: "#9AA0B8", fontStyle: "italic" }}>None yet</p>
                      : strengths.map((s, i) => <p key={i} style={{ fontSize: 11, color: "#36405F", marginBottom: 4 }}>+ {s}</p>)}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ DEBRIEF ══════════════════════════════════════════════════════ */}
          {stage === "debrief" && finalSummary && (
            <motion.div key="debrief" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              style={{ width: "100%", maxWidth: 820 }}>
              <div style={{ ...panel, padding: "40px 44px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                  <div>
                    <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Debrief</h2>
                    <p style={{ fontSize: 11, color: "#596079", fontFamily: "monospace", margin: 0 }}>
                      Review each answer before seeing your final score
                    </p>
                  </div>
                  <button onClick={() => setStage("dashboard")}
                    style={{ padding: "10px 20px", borderRadius: 10, background: "#4A3DF0", color: "#fff", border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                    Full Dashboard →
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {finalSummary.history.map((item, idx) => {
                    const s = item?.evaluation?.score ?? 0;
                    const col = s >= 7 ? "rgba(100,255,150,0.8)" : s >= 5 ? "rgba(255,200,80,0.8)" : "rgba(255,100,100,0.8)";
                    return (
                      <div key={idx} style={{ background: "#FBFAF7", border: "1px solid #E3E5F1", borderRadius: 14, overflow: "hidden" }}>
                        {/* Question header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #E3E5F1", background: "#fff" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#596079", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Q{idx + 1} · {item.difficulty || "Medium"}
                          </span>
                          <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 16, color: col }}>{s}/10</span>
                        </div>

                        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                          {/* Question text */}
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#0E1A3A" }}>
                            {item.question}
                          </p>

                          {/* Score bar */}
                          <div style={{ width: "100%", height: 2, background: "#ECEBFE", borderRadius: 99 }}>
                            <div style={{ width: `${s * 10}%`, height: "100%", background: col, borderRadius: 99, transition: "width .8s ease" }} />
                          </div>

                          {/* Your answer vs ideal */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div style={{ background: "#fff", border: "1px solid #E3E5F1", borderRadius: 10, padding: "12px 14px" }}>
                              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#596079", marginBottom: 6 }}>Your Answer</p>
                              <p style={{ fontSize: 11, color: "#36405F", lineHeight: 1.6, margin: 0 }}>{item.answer || "—"}</p>
                            </div>
                            {item?.evaluation?.ideal_answer && (
                              <div style={{ background: "rgba(100,255,150,0.04)", border: "1px solid rgba(100,255,150,0.12)", borderRadius: 10, padding: "12px 14px" }}>
                                <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(100,255,150,0.5)", marginBottom: 6 }}>Ideal Answer</p>
                                <p style={{ fontSize: 11, color: "#36405F", lineHeight: 1.6, margin: 0 }}>{item.evaluation.ideal_answer}</p>
                              </div>
                            )}
                          </div>

                          {/* Tip */}
                          {item?.evaluation?.suggestions && (
                            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,200,80,0.7)", fontStyle: "italic", borderLeft: "2px solid rgba(255,200,80,0.2)", paddingLeft: 10 }}>
                              {item.evaluation.suggestions}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button onClick={() => window.location.reload()}
                    style={{ padding: "12px 22px", borderRadius: 10, background: "#fff", color: "#0E1A3A", border: "1px solid #D7D9E6", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                    New Simulation
                  </button>
                  <button onClick={() => setStage("dashboard")}
                    style={{ padding: "12px 22px", borderRadius: 10, background: "#4A3DF0", color: "#fff", border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                    View Full Dashboard →
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ DASHBOARD ════════════════════════════════════════════════════ */}
          {stage === "dashboard" && finalSummary && (() => {
            const scores = finalSummary.history.map(h => h?.evaluation?.score ?? 0);
            const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
            return (
              <motion.div key="dashboard" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                style={{ width: "100%", maxWidth: 900, ...panel, padding: "48px 52px" }}>
                <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 4px", color: "#0E1A3A" }}>Simulation Report</h2>
                <p style={{ fontSize: 11, color: "#596079", fontFamily: "monospace", margin: "0 0 36px" }}>
                  {company} · {interviewType} · {role}
                </p>

                {/* Stats row */}
                <div className="dashboard-stats">
                  {[
                    ["Avg Score", `${avgScore}/10`],
                    ["Peak Difficulty", finalSummary.currentDifficulty],
                    ["Strengths", finalSummary.globalStrengths.length],
                    ["Questions", finalSummary.history.length],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: "#FBFAF7", border: "1px solid #E3E5F1", borderRadius: 14, padding: "20px 18px", textAlign: "center" }}>
                      <p style={{ fontSize: 10, color: "#596079", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{l}</p>
                      <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0E1A3A" }}>{v}</p>
                    </div>
                  ))}
                </div>

                {/* Per-question breakdown */}
                <div style={{ marginBottom: 28 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#596079", marginBottom: 14 }}>Question Breakdown</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {finalSummary.history.map((item, idx) => {
                      const s = item?.evaluation?.score ?? 0;
                      const barColor = s >= 7 ? "#0B6B60" : s >= 5 ? "#9A4507" : "#9B1C1C";
                      return (
                        <div key={idx} style={{ background: "#FBFAF7", border: "1px solid #E3E5F1", borderRadius: 12, padding: "14px 18px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: "#36405F", maxWidth: "80%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              Q{idx + 1} · <span style={{ color: "#9AA0B8", fontStyle: "italic" }}>{item.difficulty || "Medium"}</span> — {item.question}
                            </span>
                            <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 14, color: barColor, whiteSpace: "nowrap", marginLeft: 12 }}>{s}/10</span>
                          </div>
                          <div style={{ width: "100%", height: 2, background: "#ECEBFE", borderRadius: 99 }}>
                            <div style={{ width: `${s * 10}%`, height: "100%", background: barColor, borderRadius: 99, transition: "width .6s" }} />
                          </div>
                          {item?.evaluation?.suggestions && (
                            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#596079", fontStyle: "italic" }}>
                              💡 {item.evaluation.suggestions}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                {(finalSummary.globalStrengths.length > 0 || finalSummary.globalWeaknesses.length > 0) && (
                  <div className="sw-grid" style={{ marginBottom: 28 }}>
                    <div style={{ background: "#E2F2EE", border: "1px solid #C8E6DE", borderRadius: 12, padding: "18px 20px" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#0B6B60", marginBottom: 10 }}>Strengths</p>
                      {finalSummary.globalStrengths.length === 0
                        ? <p style={{ fontSize: 11, color: "#9AA0B8", fontStyle: "italic" }}>None detected</p>
                        : finalSummary.globalStrengths.map((s, i) => <p key={i} style={{ fontSize: 12, color: "#36405F", margin: "0 0 4px" }}>+ {s}</p>)}
                    </div>
                    <div style={{ background: "#FCEEDD", border: "1px solid #F4D7B5", borderRadius: 12, padding: "18px 20px" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9A4507", marginBottom: 10 }}>Areas to Improve</p>
                      {finalSummary.globalWeaknesses.length === 0
                        ? <p style={{ fontSize: 11, color: "#9AA0B8", fontStyle: "italic" }}>None detected</p>
                        : finalSummary.globalWeaknesses.map((w, i) => <p key={i} style={{ fontSize: 12, color: "#36405F", margin: "0 0 4px" }}>— {w}</p>)}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="dashboard-actions">
                  <button onClick={downloadReport} style={{ padding: 14, borderRadius: 12, background: "#fff", color: "#0E1A3A", fontWeight: 600, fontSize: 13, border: "1px solid #D7D9E6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Download size={13} /> PDF Report
                  </button>
                  <button onClick={() => window.location.href = "/profile"} style={{ padding: 14, borderRadius: 12, background: "#fff", color: "#0E1A3A", fontWeight: 600, fontSize: 13, border: "1px solid #D7D9E6", cursor: "pointer" }}>
                    View History →
                  </button>
                  <button onClick={() => window.location.reload()} style={{ padding: 14, borderRadius: 12, background: "#4A3DF0", color: "#fff", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
                    New Simulation
                  </button>
                </div>
              </motion.div>
            );
          })()}

        </AnimatePresence>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .nx-room textarea::placeholder, .nx-room input::placeholder { color: #9AA0B8; }
      `}</style>
    </div>
      )}
    </>
  );
}
