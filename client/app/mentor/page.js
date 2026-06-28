"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth, UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  ArrowLeft, BrainCircuit, Target, TrendingUp, BookOpen,
  FolderGit2, Sparkles, Loader2, AlertCircle, Activity,
} from "lucide-react";

import { getApiBase } from "@/lib/api";

const panel = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  backdropFilter: "blur(20px)",
};

const label = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.28)",
};

export default function MentorPage() {
  const { userId, isLoaded } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState("");
  const [targetRole, setTargetRole] = useState("");

  const fetchProfile = async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${getApiBase()}/mentor/${userId}`);
      setStats(res.data.stats);
      setRoadmap(res.data.roadmap);
      setHasData(res.data.hasData);
      if (res.data.stats?.roles?.[0]) setTargetRole(res.data.stats.roles[0]);
    } catch (e) {
      setError("Could not load mentor profile.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || !userId) return;
    fetchProfile();
  }, [userId, isLoaded]);

  const generatePlan = async () => {
    const userApiKey = sessionStorage.getItem("careerforge_gemini_key");
    if (!userApiKey) {
      setError("Add your Gemini API key on the home page first (Connect Your AI screen).");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const res = await axios.post(
        `${getApiBase()}/mentor/generate`,
        { clerkId: userId, userApiKey, targetRole: targetRole || undefined },
        { timeout: 90000 }
      );
      setStats(res.data.stats);
      setRoadmap(res.data.roadmap);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to generate career plan.");
    } finally {
      setGenerating(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: "#fff", fontFamily: "Inter, sans-serif" }}>
        <Activity size={28} style={{ opacity: 0.4 }} />
        <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Loading Career Mentor...</span>
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <p>Sign in required. <a href="/" style={{ color: "rgba(255,255,255,0.5)" }}>Go home</a></p>
      </div>
    );
  }

  const analysis = roadmap?.weakness_analysis;
  const weeks = roadmap?.learning_roadmap || [];
  const projects = roadmap?.recommended_projects || [];

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "Inter, sans-serif", paddingBottom: 60 }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 40px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(5,5,5,0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={() => (window.location.href = "/")} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 16px", cursor: "pointer" }}>
          <ArrowLeft size={13} /> Simulator
        </button>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button onClick={() => (window.location.href = "/profile")} style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", background: "none", border: "none", cursor: "pointer" }}>History →</button>
          <UserButton />
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px 0" }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <BrainCircuit size={24} color="rgba(255,255,255,0.5)" />
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Career Mentor</h1>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "4px 10px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}>V4</span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>Weakness analysis · Learning roadmap · Recommended projects</p>
        </div>

        {error && (
          <div style={{ ...panel, padding: "14px 18px", marginBottom: 24, display: "flex", gap: 10, alignItems: "center", borderColor: "rgba(255,80,80,0.3)" }}>
            <AlertCircle size={16} color="rgba(255,120,120,0.9)" />
            <span style={{ fontSize: 13, color: "rgba(255,180,180,0.9)" }}>{error}</span>
          </div>
        )}

        {/* Stats row */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
            {[
              { icon: <Target size={18} />, label: "Sessions", value: stats.sessionCount },
              { icon: <TrendingUp size={18} />, label: "Avg Score", value: stats.avgScore ? `${stats.avgScore}/10` : "—" },
              { icon: <Sparkles size={18} />, label: "Weaknesses Tracked", value: stats.topWeaknesses?.length || 0 },
            ].map(({ icon, label: lbl, value }) => (
              <div key={lbl} style={{ ...panel, padding: "22px 24px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.55)" }}>{icon}</div>
                <div>
                  <p style={{ ...label, marginBottom: 4 }}>{lbl}</p>
                  <p style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generate CTA */}
        <div style={{ ...panel, padding: "24px 28px", marginBottom: 32, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ ...label, marginBottom: 8 }}>Target Role</p>
            <input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Frontend Developer"
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            onClick={generatePlan}
            disabled={!hasData || generating}
            style={{ padding: "12px 24px", borderRadius: 11, border: "none", cursor: !hasData || generating ? "not-allowed" : "pointer", background: !hasData || generating ? "rgba(255,255,255,0.1)" : "#fff", color: !hasData || generating ? "rgba(255,255,255,0.35)" : "#000", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}
          >
            {generating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
            {generating ? "Analyzing..." : roadmap ? "Regenerate Plan" : "Generate Career Plan"}
          </button>
        </div>

        {!hasData && (
          <div style={{ ...panel, padding: 48, textAlign: "center" }}>
            <BookOpen size={36} style={{ color: "rgba(255,255,255,0.15)", margin: "0 auto 16px" }} />
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}>Complete at least one interview simulation to unlock your personalized career plan.</p>
            <button onClick={() => (window.location.href = "/")} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, background: "#fff", color: "#000", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Start Simulation</button>
          </div>
        )}

        {hasData && !roadmap && !generating && (
          <div style={{ ...panel, padding: 32, textAlign: "center", marginBottom: 32 }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>You have interview data. Click <strong>Generate Career Plan</strong> to get your AI roadmap.</p>
          </div>
        )}

        {/* Weakness Analysis */}
        {analysis && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
            <h2 style={{ ...label, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Target size={12} /> Weakness Analysis</h2>
            <div style={{ ...panel, padding: "28px" }}>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.75)", margin: "0 0 24px" }}>{analysis.summary}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
                {(analysis.patterns || []).map((p, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{p.theme}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 8px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.45)" }}>{p.frequency}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "0 0 6px" }}>{p.impact}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0, fontStyle: "italic" }}>Root: {p.root_cause}</p>
                  </div>
                ))}
              </div>
              <p style={{ ...label, marginBottom: 8 }}>Priority Areas</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(analysis.priority_areas || []).map((a, i) => (
                  <span key={i} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 99, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>{a}</span>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* Learning Roadmap */}
        {weeks.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: 32 }}>
            <h2 style={{ ...label, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><BookOpen size={12} /> Learning Roadmap</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {weeks.map((w) => (
                <div key={w.week} style={{ ...panel, padding: "22px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "#fff", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13 }}>W{w.week}</span>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{w.focus}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, fontSize: 12 }}>
                    <div>
                      <p style={{ ...label, marginBottom: 6 }}>Topics</p>
                      {(w.topics || []).map((t, i) => <p key={i} style={{ margin: "0 0 3px", color: "rgba(255,255,255,0.55)" }}>· {t}</p>)}
                    </div>
                    <div>
                      <p style={{ ...label, marginBottom: 6 }}>Resources</p>
                      {(w.resources || []).map((r, i) => <p key={i} style={{ margin: "0 0 3px", color: "rgba(255,255,255,0.55)" }}>· {r}</p>)}
                    </div>
                    <div>
                      <p style={{ ...label, marginBottom: 6 }}>Goals</p>
                      {(w.goals || []).map((g, i) => <p key={i} style={{ margin: "0 0 3px", color: "rgba(255,255,255,0.55)" }}>✓ {g}</p>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Recommended Projects */}
        {projects.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 style={{ ...label, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><FolderGit2 size={12} /> Recommended Projects</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {projects.map((p, i) => (
                <div key={i} style={{ ...panel, padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, maxWidth: "75%" }}>{p.title}</h3>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.45)" }}>{p.difficulty}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: "0 0 14px" }}>{p.description}</p>
                  <p style={{ ...label, marginBottom: 6 }}>Skills Addressed</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {(p.skills_addressed || []).map((s, j) => (
                      <span key={j} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{s}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.25)", margin: 0 }}>~{p.estimated_weeks} weeks</p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Raw weakness frequency */}
        {stats?.topWeaknesses?.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ ...label, marginBottom: 16 }}>Detected Weaknesses (from interviews)</h2>
            <div style={{ ...panel, padding: "20px 24px" }}>
              {stats.topWeaknesses.map((w, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < stats.topWeaknesses.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{w.text}</span>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.25)" }}>{w.count}×</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
