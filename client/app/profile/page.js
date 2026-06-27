"use client"

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth, UserButton } from "@clerk/nextjs";
import { Rocket, Target, ArrowLeft, BarChart3, BrainCircuit, Activity, Database } from "lucide-react";
import { motion } from "framer-motion";

const panel = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, backdropFilter: "blur(20px)" };

export default function Profile() {
  const { userId, isLoaded } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/interview/user/${userId}`)
      .then(res => setSessions(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [userId, isLoaded]);

  if (!isLoaded || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: "#fff", fontFamily: "Inter, sans-serif" }}>
        <Activity size={28} style={{ opacity: 0.4, animation: "pulse 1.5s ease-in-out infinite" }} />
        <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Fetching Neural Records...</span>
        <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.9} }`}</style>
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Inter, sans-serif" }}>
        <p>Unauthorized. <a href="/" style={{ color: "rgba(255,255,255,0.5)" }}>Go back</a></p>
      </div>
    );
  }

  // Metrics
  const totalInterviews = sessions.length;
  const allScores = sessions.flatMap(s => (s.history || []).map(h => h?.evaluation?.score ?? 0));
  const avgScore = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : "—";
  let highestDiff = "Easy";
  if (sessions.some(s => s.currentDifficulty === "Hard")) highestDiff = "Hard";
  else if (sessions.some(s => s.currentDifficulty === "Medium")) highestDiff = "Medium";

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "Inter, sans-serif", padding: "0 0 60px" }}>
      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 40px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(5,5,5,0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={() => window.location.href = "/"} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          <ArrowLeft size={13} /> Back to Simulator
        </button>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button onClick={() => window.location.href = "/mentor"} style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", background: "none", border: "none", cursor: "pointer" }}>Mentor →</button>
          <UserButton />
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px 0" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Database size={22} color="rgba(255,255,255,0.5)" />
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>Executive Profile</h1>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", fontFamily: "monospace" }}>
            Clerk ID: {userId?.substring(0, 16)}...
          </p>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 48 }}>
          {[
            { icon: <Target size={20} />, label: "Total Simulations", value: totalInterviews },
            { icon: <BarChart3 size={20} />, label: "Avg Score", value: avgScore },
            { icon: <BrainCircuit size={20} />, label: "Peak Difficulty", value: highestDiff },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ ...panel, padding: "24px 28px", display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)" }}>
                {icon}
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.28)", marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* History */}
        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 12, marginBottom: 24 }}>
          Simulation History
        </h3>

        {sessions.length === 0 ? (
          <div style={{ ...panel, padding: 64, textAlign: "center" }}>
            <Rocket size={36} style={{ color: "rgba(255,255,255,0.15)", margin: "0 auto 16px" }} />
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>No simulations found. Complete an interview to see your history.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {sessions.map((session, i) => {
              const sessionScores = (session.history || []).map(h => h?.evaluation?.score ?? 0);
              const sessionAvg = sessionScores.length ? (sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length).toFixed(1) : "—";
              return (
                <motion.div key={session.sessionId || i}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  style={{ ...panel, padding: "24px", position: "relative", overflow: "hidden" }}>

                  {/* Difficulty badge */}
                  <div style={{ position: "absolute", top: 16, right: 16 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {session.currentDifficulty || "—"}
                    </span>
                  </div>

                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px", maxWidth: "80%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.role}</h4>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "monospace", margin: "0 0 20px" }}>
                    {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : "—"} · {(session.history || []).length} questions
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.22)", marginBottom: 6 }}>Weaknesses</p>
                      {(session.globalWeaknesses || []).length === 0
                        ? <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>None</p>
                        : (session.globalWeaknesses || []).slice(0, 2).map((w, idx) => (
                          <p key={idx} style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>— {w}</p>
                        ))}
                    </div>
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.22)", marginBottom: 6 }}>Strengths</p>
                      {(session.globalStrengths || []).length === 0
                        ? <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>None</p>
                        : (session.globalStrengths || []).slice(0, 2).map((s, idx) => (
                          <p key={idx} style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>+ {s}</p>
                        ))}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(session.history || []).map((h, idx) => (
                        <div key={idx} style={{ width: 10, height: 10, borderRadius: "50%", background: (h?.evaluation?.score ?? 0) >= 7 ? "rgba(255,255,255,0.6)" : (h?.evaluation?.score ?? 0) >= 5 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      avg {sessionAvg}/10
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
