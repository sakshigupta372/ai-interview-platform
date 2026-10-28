"use client";

import { useEffect, useRef } from "react";
import { Brain, Rocket, Loader2, ShieldAlert, KeyRound } from "lucide-react";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { ALL_COMPANIES } from "@/lib/companies";
import { saveGeminiKey } from "@/lib/brand";
import "@/app/setup.css";

const TYPES = ["Technical", "HR & Culture", "System Design", "Coding Round"];
const TONES = [
  ["Harsh Tech Lead", "Strict & direct"],
  ["Friendly Microsoft HR", "Warm & structured"],
  ["Chaotic Startup Founder", "Fast & casual"],
];
const TIMERS = [
  ["Practice Mode", "No timer"],
  ["Pressure Mode", "2 min / Q"],
  ["Rapid Fire", "30 sec / Q"],
];

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
          if (t === 0) ctx.fillRect(-s / 2, -s / 2, s, s);
          else if (t === 1) { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill(); }
          else {
            ctx.beginPath();
            ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, 0); ctx.lineTo(0, s / 2); ctx.lineTo(-s / 2, 0);
            ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", display: "block" }} />;
}

export default function SetupEngine({
  stage,
  onBack,
  onStart,
  isLoaded,
  userId,
  userApiKey,
  setUserApiKey,
  role, setRole,
  company, setCompany,
  persona, setPersona,
  timerMode, setTimerMode,
  interviewType, setInterviewType,
  isTyping,
  drillMode, setDrillMode,
  apiKeyInput, setApiKeyInput,
  apiKeyError, setApiKeyError,
  onNeedKey,
  onKeySaved,
}) {
  const submitKey = () => {
    if (apiKeyInput.trim().length < 10) {
      setApiKeyError("That doesn't look like a valid API key.");
      return;
    }
    saveGeminiKey(apiKeyInput);
    setUserApiKey(apiKeyInput.trim());
    setApiKeyError("");
    onKeySaved?.();
  };

  const handleStart = () => {
    if (isTyping) return;
    if (!userId) return;
    if (!userApiKey) {
      onNeedKey?.();
      return;
    }
    if (!role.trim()) return;
    onStart();
  };

  return (
    <div className="nx-setup">
      <ShapeGrid />
      <header className="nx-setup-nav">
        <button type="button" className="nx-setup-logo" onClick={onBack} aria-label="Back to home">
          NEXUS<span>.AI</span>
        </button>
        <div>
          {isLoaded && !userId && (
            <SignInButton mode="modal">
              <button type="button" className="nx-setup-signin">Sign In</button>
            </SignInButton>
          )}
          {isLoaded && userId && <UserButton />}
        </div>
      </header>

      <main className="nx-setup-main">
        {stage === "api-key" ? (
          <div className="nx-engine">
            <div className="nx-engine-icon"><KeyRound size={22} /></div>
            <h1>Connect Your AI</h1>
            <p className="sub">Paste a free Gemini API key to power the simulation.</p>
            <input
              className="nx-input"
              type="password"
              value={apiKeyInput}
              onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyError(""); }}
              onKeyDown={(e) => e.key === "Enter" && submitKey()}
              placeholder="AIzaSy..."
              autoFocus
              style={{ textAlign: "center", fontFamily: "ui-monospace, monospace", letterSpacing: "0.04em" }}
            />
            {apiKeyError && <p className="nx-engine-note" style={{ color: "rgba(255,80,80,0.85)", marginTop: 0, marginBottom: 10 }}>{apiKeyError}</p>}
            <button type="button" className="nx-start" disabled={apiKeyInput.trim().length < 10} onClick={submitKey}>
              Activate Engine
            </button>
            <p className="nx-engine-note">
              Need one?{" "}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                Get a free key
              </a>
              {" "}— never stored on our servers.
            </p>
          </div>
        ) : (
          <div className="nx-engine">
            <div className="nx-engine-icon"><Brain size={22} strokeWidth={1.7} /></div>
            <h1>Agentic Engine</h1>
            <p className="sub">Multi-Agent Interview Simulation Pipeline</p>

            {drillMode && (
              <div className="nx-drill">
                <div>
                  <p className="k">Drill mode</p>
                  <p className="v">{drillMode.weakness}</p>
                </div>
                <button type="button" onClick={() => setDrillMode(null)} aria-label="Clear drill">✕</button>
              </div>
            )}

            <div className="nx-types" role="tablist" aria-label="Interview type">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  className={interviewType === t ? "on" : ""}
                  aria-selected={interviewType === t}
                  onClick={() => setInterviewType(t)}
                >
                  {t === "Coding Round" ? "Coding" : t}
                </button>
              ))}
            </div>

            <div className="nx-row">
              <select className="nx-select" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company">
                {ALL_COMPANIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.id === "Agnostic" ? "Company" : c.name}</option>
                ))}
              </select>
              <select className="nx-select" value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Tone">
                {TONES.map(([v, l]) => (
                  <option key={v} value={v}>{v === "Harsh Tech Lead" ? "Tone" : l}</option>
                ))}
              </select>
              <select className="nx-select" value={timerMode} onChange={(e) => setTimerMode(e.target.value)} aria-label="Timer">
                {TIMERS.map(([v]) => (
                  <option key={v} value={v}>{v === "Pressure Mode" ? "Timer" : v === "Practice Mode" ? "Practice" : "Rapid Fire"}</option>
                ))}
              </select>
            </div>

            <input
              className="nx-input"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="Enter job target e.g. Senior Frontend Dev"
            />

            {!isLoaded ? (
              <button type="button" className="nx-start" disabled>Start Simulation</button>
            ) : !userId ? (
              <SignInButton mode="modal">
                <button type="button" className="nx-start"><ShieldAlert size={14} /> Sign in to start</button>
              </SignInButton>
            ) : (
              <button
                type="button"
                className="nx-start"
                onClick={handleStart}
                disabled={isTyping || (Boolean(userApiKey) && !role.trim())}
              >
                {isTyping ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> :
                  !userApiKey ? <><KeyRound size={14} /> Add API key</> :
                  drillMode ? <>Start drill <Rocket size={14} /></> :
                  <>Start Simulation <Rocket size={14} /></>}
              </button>
            )}
          </div>
        )}
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
