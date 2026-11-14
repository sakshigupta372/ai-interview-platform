"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useAuth, UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  ArrowLeft, BrainCircuit, Target, TrendingUp, BookOpen,
  FolderGit2, Sparkles, Loader2, AlertCircle, Activity, Download,
  Brain, Zap, ListChecks, FileText, ChevronDown, Upload, MessageSquare,
} from "lucide-react";

import { getApiBase } from "@/lib/api";
import { loadGeminiKey } from "@/lib/brand";
import { toast } from "@/lib/toast";

// ─── Cream theme tokens (match the interview room) ───────────────────────────
const INK = "#0E1A3A";
const INK2 = "#36405F";
const MUTED = "#596079";
const LINE = "#E3E5F1";
const BG = "#FBFAF7";
const PAPER = "#FFFFFF";
const ACCENT = "#4A3DF0";
const ACCENT_BG = "#ECEBFE";
const ACCENT_LINE = "#DCE0FA";
const WARN = "#B4690E";
const BAD = "#C62A2F";

const panel = {
  background: PAPER,
  border: `1px solid ${LINE}`,
  borderRadius: 20,
  boxShadow: "0 1px 2px rgba(14,26,58,.04), 0 18px 40px -22px rgba(14,26,58,.28)",
};

const label = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: MUTED,
};

export default function MentorPage() {
  const { userId, isLoaded, getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [activeTab, setActiveTab] = useState("roadmap"); // "roadmap" | "coach" | "prep"
  const [coachData, setCoachData] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);

  // Interview Prep tab
  const [prep, setPrep] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepGenerating, setPrepGenerating] = useState(false);
  const [prepLoaded, setPrepLoaded] = useState(false); // GET /latest attempted
  const [prepLang, setPrepLang] = useState("English");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [prepResume, setPrepResume] = useState(null);
  const [openQ, setOpenQ] = useState(null); // expanded question id

  const fetchProfile = async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const res = await axios.get(`${getApiBase()}/mentor/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data.stats);
      setRoadmap(res.data.roadmap);
      setHasData(res.data.hasData);
      if (res.data.stats?.roles?.[0]) setTargetRole(res.data.stats.roles[0]);
    } catch (e) {
      setError("Could not load mentor profile. The API may be waking up — refresh in a moment.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || !userId) return;
    fetchProfile();
  }, [userId, isLoaded]);

  const downloadRoadmap = async () => {
    if (!roadmap) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text("NEXUS.AI — Career Roadmap", W / 2, y, { align: "center" }); y += 10;
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
    doc.text(`Target: ${roadmap.targetRole || "—"} · Generated ${new Date().toLocaleDateString()}`, W / 2, y, { align: "center" }); y += 16;

    // Weakness analysis
    if (roadmap.weakness_analysis) {
      doc.setTextColor(0); doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("Weakness Analysis", 14, y); y += 8;
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(40);
      const sumLines = doc.splitTextToSize(roadmap.weakness_analysis.summary || "", W - 28);
      doc.text(sumLines, 14, y); y += sumLines.length * 5 + 6;
      (roadmap.weakness_analysis.priority_areas || []).forEach(a => {
        doc.text(`• ${a}`, 18, y); y += 5;
      });
      y += 4;
    }

    // Learning roadmap
    if ((roadmap.learning_roadmap || []).length) {
      doc.setDrawColor(220); doc.line(14, y, W - 14, y); y += 8;
      doc.setTextColor(0); doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("4-Week Learning Roadmap", 14, y); y += 8;
      (roadmap.learning_roadmap || []).forEach(w => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
        doc.text(`Week ${w.week}: ${w.focus}`, 14, y); y += 6;
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60);
        (w.topics || []).forEach(t => { doc.text(`  Topic: ${t}`, 16, y); y += 4; });
        (w.resources || []).forEach(r => { doc.text(`  Resource: ${r}`, 16, y); y += 4; });
        (w.goals || []).forEach(g => { doc.text(`  ✓ ${g}`, 16, y); y += 4; });
        y += 4;
      });
    }

    // Recommended projects
    if ((roadmap.recommended_projects || []).length) {
      doc.setDrawColor(220); doc.line(14, y, W - 14, y); y += 8;
      doc.setTextColor(0); doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("Recommended Projects", 14, y); y += 8;
      (roadmap.recommended_projects || []).forEach(p => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
        doc.text(`${p.title} [${p.difficulty}] ~${p.estimated_weeks}w`, 14, y); y += 6;
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60);
        const dLines = doc.splitTextToSize(p.description || "", W - 28);
        doc.text(dLines, 14, y); y += dLines.length * 4 + 4;
      });
    }

    doc.save(`nexus-roadmap-${Date.now()}.pdf`);
  };

  const generatePlan = async () => {
    const userApiKey = loadGeminiKey();
    if (!userApiKey) {
      setError("Add your Gemini API key on the home page first (Connect Your AI screen).");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const token = await getToken();
      const res = await axios.post(
        `${getApiBase()}/mentor/generate`,
        { userApiKey, targetRole: targetRole || undefined },
        { timeout: 90000, headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(res.data.stats);
      setRoadmap(res.data.roadmap);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to generate roadmap.");
    } finally {
      setGenerating(false);
    }
  };

  const runCoach = async () => {
    const userApiKey = loadGeminiKey();
    if (!userApiKey) { toast.error("Add your Gemini API key on the home page first."); return; }
    setCoachLoading(true);
    setError("");
    try {
      const token = await getToken();
      const res = await axios.post(
        `${getApiBase()}/coach/analyze/${userId}`,
        { userApiKey, targetRole: targetRole || undefined },
        { timeout: 60000, headers: { Authorization: `Bearer ${token}` } }
      );
      setCoachData(res.data);
    } catch (e) {
      const msg = e.response?.data?.error || "Failed to run coach analysis.";
      setError(msg);
      toast.error(msg);
    } finally {
      setCoachLoading(false);
    }
  };

  const startDrill = (weakness) => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("nexus_drill_context", JSON.stringify({ weakness }));
    window.location.href = "/";
  };

  // Load any previously generated prep set the first time the Prep tab opens.
  const fetchPrep = async () => {
    if (!userId) return;
    setPrepLoading(true);
    try {
      const token = await getToken();
      const res = await axios.get(`${getApiBase()}/prep/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.prep) {
        setPrep(res.data.prep);
        if (res.data.prep.targetRole && !targetRole) setTargetRole(res.data.prep.targetRole);
        if (res.data.prep.language) setPrepLang(res.data.prep.language);
      }
    } catch {
      /* no prep yet or API waking up — the form still works */
    } finally {
      setPrepLoaded(true);
      setPrepLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "prep" && !prepLoaded && userId) fetchPrep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, prepLoaded, userId]);

  const generatePrep = async () => {
    const userApiKey = loadGeminiKey();
    if (!userApiKey) { toast.error("Add your Gemini API key on the home page first."); return; }
    if (!targetRole.trim()) { toast.error("Enter a target role first."); return; }
    setPrepGenerating(true);
    setError("");
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("targetRole", targetRole.trim());
      form.append("userApiKey", userApiKey);
      form.append("language", prepLang);
      if (linkedinUrl.trim()) form.append("linkedinUrl", linkedinUrl.trim());
      if (prepResume) form.append("resume", prepResume);
      const res = await axios.post(`${getApiBase()}/prep/generate`, form, {
        timeout: 120000,
        headers: { Authorization: `Bearer ${token}` },
      });
      setPrep(res.data.prep);
      setOpenQ(null);
      toast.success("Interview prep ready.");
    } catch (e) {
      const msg = e.response?.data?.error || "Failed to generate interview prep.";
      setError(msg);
      toast.error(msg);
    } finally {
      setPrepGenerating(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: INK, fontFamily: "Inter, sans-serif" }}>
        <Activity size={28} style={{ color: ACCENT, opacity: 0.6, animation: "pulse 1.5s ease-in-out infinite" }} />
        <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>Loading Nexus Mentor...</span>
        <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.9} }`}</style>
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color: INK, fontFamily: "Inter, sans-serif" }}>
        <p>Sign in required. <Link href="/" style={{ color: ACCENT }}>Go home</Link></p>
      </div>
    );
  }

  const analysis = roadmap?.weakness_analysis;
  const weeks = roadmap?.learning_roadmap || [];
  const projects = roadmap?.recommended_projects || [];

  return (
    <div style={{ minHeight: "100vh", background: BG, color: INK, fontFamily: "Inter, sans-serif", paddingBottom: 60 }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 40px", borderBottom: `1px solid ${LINE}`, background: "rgba(251,250,247,0.85)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={() => (window.location.href = "/")} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: INK2, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: "8px 16px", cursor: "pointer" }}>
          <ArrowLeft size={13} /> NEXUS.AI
        </button>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button onClick={() => (window.location.href = "/profile")} style={{ fontSize: 11, color: MUTED, fontFamily: "monospace", background: "none", border: "none", cursor: "pointer" }}>History →</button>
          <UserButton />
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px 0" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <BrainCircuit size={24} color={ACCENT} />
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: INK }}>Nexus Mentor</h1>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "4px 10px", borderRadius: 99, border: `1px solid ${ACCENT_LINE}`, background: ACCENT_BG, color: ACCENT, letterSpacing: "0.08em" }}>V4</span>
          </div>
          <p style={{ fontSize: 13, color: MUTED, margin: "0 0 24px" }}>Weakness analysis · Learning roadmap · Recommended projects</p>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: 4, width: "fit-content" }}>
            {[
              { id: "roadmap", icon: <BookOpen size={13} />, label: "Roadmap" },
              { id: "coach",   icon: <Brain    size={13} />, label: "AI Coach" },
              { id: "prep",    icon: <FileText size={13} />, label: "Interview Prep" },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", transition: "all .2s",
                  background: activeTab === t.id ? ACCENT : "none",
                  color: activeTab === t.id ? "#fff" : MUTED }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ ...panel, padding: "14px 18px", marginBottom: 24, display: "flex", gap: 10, alignItems: "center", borderColor: "#F3C0C2", background: "#FDF3F3" }}>
            <AlertCircle size={16} color={BAD} />
            <span style={{ fontSize: 13, color: BAD }}>{error}</span>
          </div>
        )}

        {/* ══ COACH TAB ══════════════════════════════════════════════════════ */}
        {activeTab === "coach" && (
          <div>
            {/* Analyze button */}
            <div style={{ ...panel, padding: "24px 28px", marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: INK }}>Agentic Performance Analysis</p>
                <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
                  AI observes your full history, identifies your biggest gap, and builds a targeted drill.
                </p>
              </div>
              <button onClick={runCoach} disabled={!hasData || coachLoading}
                style={{ padding: "12px 24px", borderRadius: 11, border: "none", cursor: !hasData || coachLoading ? "not-allowed" : "pointer", background: !hasData || coachLoading ? "#E3E5F1" : ACCENT, color: !hasData || coachLoading ? "#9AA0B8" : "#fff", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                {coachLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Brain size={14} />}
                {coachLoading ? "Analyzing..." : coachData ? "Re-analyze" : "Analyze Me"}
              </button>
            </div>

            {!hasData && (
              <div style={{ ...panel, padding: 48, textAlign: "center" }}>
                <Brain size={36} style={{ color: ACCENT, opacity: 0.4, margin: "0 auto 16px" }} />
                <p style={{ fontSize: 14, color: MUTED }}>Complete at least one interview to unlock coach analysis.</p>
                <button onClick={() => window.location.href = "/"} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, background: ACCENT, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Start Interview</button>
              </div>
            )}

            {coachData && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Insight */}
                <div style={{ ...panel, padding: "22px 24px", borderColor: ACCENT_LINE }}>
                  <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: ACCENT, margin: "0 0 8px" }}>Coach Insight</p>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: INK, margin: "0 0 10px" }}>{coachData.coaching.insight}</p>
                  {coachData.coaching.encouragement && (
                    <p style={{ fontSize: 12, color: MUTED, fontStyle: "italic", margin: 0 }}>{coachData.coaching.encouragement}</p>
                  )}
                </div>

                {/* Priority weakness + drill */}
                <div style={{ ...panel, padding: "22px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: WARN, margin: "0 0 6px" }}>Priority Weakness</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: INK, margin: "0 0 10px" }}>{coachData.coaching.priority_weakness}</p>
                      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 6px" }}>Drill Question</p>
                      <p style={{ fontSize: 13, color: INK2, lineHeight: 1.6, margin: "0 0 8px" }}>{coachData.coaching.drill_question}</p>
                      {coachData.coaching.drill_tip && (
                        <p style={{ fontSize: 11, color: WARN, fontStyle: "italic", borderLeft: `2px solid ${WARN}`, paddingLeft: 10, margin: 0 }}>
                          Tip: {coachData.coaching.drill_tip}
                        </p>
                      )}
                    </div>
                    <button onClick={() => startDrill(coachData.coaching.priority_weakness)}
                      style={{ padding: "12px 20px", borderRadius: 11, background: ACCENT_BG, border: `1px solid ${ACCENT_LINE}`, color: ACCENT, fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <Zap size={13} /> Drill it now →
                    </button>
                  </div>
                </div>

                {/* Next steps */}
                {(coachData.coaching.next_steps || []).length > 0 && (
                  <div style={{ ...panel, padding: "22px 24px" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
                      <ListChecks size={11} /> This week&apos;s actions
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {coachData.coaching.next_steps.map((step, i) => (
                        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <span style={{ width: 22, height: 22, borderRadius: 6, background: ACCENT_BG, border: `1px solid ${ACCENT_LINE}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>{i + 1}</span>
                          <p style={{ fontSize: 13, color: INK2, lineHeight: 1.5, margin: 0 }}>{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    ["Sessions", coachData.stats.sessionCount],
                    ["Avg Score", coachData.stats.avgScore ? `${coachData.stats.avgScore}/10` : "—"],
                    ["Tracked Gaps", coachData.stats.topWeaknesses?.length || 0],
                  ].map(([l, v]) => (
                    <div key={l} style={{ ...panel, padding: "16px 18px", textAlign: "center" }}>
                      <p style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>{l}</p>
                      <p style={{ fontSize: 20, fontWeight: 900, margin: 0, color: INK }}>{v}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ══ INTERVIEW PREP TAB ═════════════════════════════════════════════ */}
        {activeTab === "prep" && (
          <div>
            {/* Generator */}
            <div style={{ ...panel, padding: "24px 28px", marginBottom: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: INK }}>Personalised Interview Prep</p>
              <p style={{ fontSize: 12, color: MUTED, margin: "0 0 18px" }}>
                10 likely questions with model answers in three formats — talking points, a full spoken script, and S.T.A.R. Add your resume or LinkedIn to make them specific to you.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <p style={{ ...label, marginBottom: 6 }}>Target Role</p>
                  <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Backend Engineer"
                    style={{ width: "100%", background: BG, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: INK, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <p style={{ ...label, marginBottom: 6 }}>Language</p>
                  <select value={prepLang} onChange={(e) => setPrepLang(e.target.value)}
                    style={{ width: "100%", background: BG, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: INK, outline: "none", boxSizing: "border-box" }}>
                    <option>English</option><option>Hindi</option><option>Hinglish</option>
                  </select>
                </div>
                <div>
                  <p style={{ ...label, marginBottom: 6 }}>LinkedIn URL <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></p>
                  <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://www.linkedin.com/in/…"
                    style={{ width: "100%", background: BG, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: INK, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <p style={{ ...label, marginBottom: 6 }}>Resume PDF <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></p>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, background: BG, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: prepResume ? INK : MUTED, cursor: "pointer", boxSizing: "border-box" }}>
                    <Upload size={13} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prepResume ? prepResume.name : "Choose a PDF"}</span>
                    <input type="file" accept="application/pdf" onChange={(e) => setPrepResume(e.target.files?.[0] || null)} style={{ display: "none" }} />
                  </label>
                </div>
              </div>
              <button onClick={generatePrep} disabled={prepGenerating}
                style={{ padding: "12px 24px", borderRadius: 11, border: "none", cursor: prepGenerating ? "not-allowed" : "pointer", background: prepGenerating ? "#E3E5F1" : ACCENT, color: prepGenerating ? "#9AA0B8" : "#fff", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                {prepGenerating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
                {prepGenerating ? "Generating…" : prep ? "Regenerate Prep" : "Generate Prep"}
              </button>
            </div>

            {prepLoading && !prep && (
              <div style={{ ...panel, padding: 48, textAlign: "center", color: MUTED, fontSize: 13 }}>Loading your saved prep…</div>
            )}

            {!prepLoading && !prep && (
              <div style={{ ...panel, padding: 48, textAlign: "center" }}>
                <FileText size={36} style={{ color: ACCENT, opacity: 0.4, margin: "0 auto 16px" }} />
                <p style={{ fontSize: 14, color: MUTED }}>No prep yet. Enter a target role above and generate your personalised question set.</p>
              </div>
            )}

            {prep && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <p style={{ fontSize: 12, color: MUTED, margin: "0 0 16px" }}>
                  {prep.questions?.length || 0} questions for <strong style={{ color: INK }}>{prep.targetRole}</strong> · {prep.language}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(prep.questions || []).map((q) => {
                    const open = openQ === q.id;
                    return (
                      <div key={q.id} style={{ ...panel, padding: 0, overflow: "hidden" }}>
                        <button onClick={() => setOpenQ(open ? null : q.id)}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 9px", borderRadius: 99, background: ACCENT_BG, border: `1px solid ${ACCENT_LINE}`, color: ACCENT, flexShrink: 0 }}>{q.category}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: INK }}>{q.question}</span>
                          <ChevronDown size={16} style={{ color: MUTED, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                        </button>
                        {open && (
                          <div style={{ padding: "4px 20px 20px", borderTop: `1px solid ${LINE}` }}>
                            {q.bullets?.length > 0 && (
                              <div style={{ marginTop: 16 }}>
                                <p style={{ ...label, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><ListChecks size={11} /> Talking points</p>
                                {q.bullets.map((b, i) => (
                                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                                    <span style={{ color: ACCENT, flexShrink: 0 }}>·</span>
                                    <span style={{ fontSize: 13, color: INK2, lineHeight: 1.5 }}>{b}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {q.fullScript && (
                              <div style={{ marginTop: 18 }}>
                                <p style={{ ...label, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><MessageSquare size={11} /> Full script</p>
                                <p style={{ fontSize: 13, color: INK2, lineHeight: 1.65, margin: 0, background: BG, border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>{q.fullScript}</p>
                              </div>
                            )}
                            {q.star && (q.star.situation || q.star.task || q.star.action || q.star.result) && (
                              <div style={{ marginTop: 18 }}>
                                <p style={{ ...label, marginBottom: 8 }}>S.T.A.R.</p>
                                <div style={{ display: "grid", gap: 8 }}>
                                  {[["Situation", q.star.situation], ["Task", q.star.task], ["Action", q.star.action], ["Result", q.star.result]].map(([k, v]) => v ? (
                                    <div key={k} style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 10 }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, paddingTop: 2 }}>{k}</span>
                                      <span style={{ fontSize: 13, color: INK2, lineHeight: 1.55 }}>{v}</span>
                                    </div>
                                  ) : null)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ══ ROADMAP TAB ════════════════════════════════════════════════════ */}
        {activeTab === "roadmap" && <>

        {/* Stats row */}
        {stats && (
          <div className="mentor-stats-grid" style={{ gap: 16, marginBottom: 32 }}>
            {[
              { icon: <Target size={18} />, label: "Sessions", value: stats.sessionCount },
              { icon: <TrendingUp size={18} />, label: "Avg Score", value: stats.avgScore ? `${stats.avgScore}/10` : "—" },
              { icon: <Sparkles size={18} />, label: "Weaknesses Tracked", value: stats.topWeaknesses?.length || 0 },
            ].map(({ icon, label: lbl, value }) => (
              <div key={lbl} style={{ ...panel, padding: "22px 24px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: ACCENT_BG, border: `1px solid ${ACCENT_LINE}`, display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT }}>{icon}</div>
                <div>
                  <p style={{ ...label, marginBottom: 4 }}>{lbl}</p>
                  <p style={{ fontSize: 24, fontWeight: 900, margin: 0, color: INK }}>{value}</p>
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
              style={{ width: "100%", background: BG, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: INK, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={generatePlan}
              disabled={!hasData || generating}
              style={{ padding: "12px 24px", borderRadius: 11, border: "none", cursor: !hasData || generating ? "not-allowed" : "pointer", background: !hasData || generating ? "#E3E5F1" : ACCENT, color: !hasData || generating ? "#9AA0B8" : "#fff", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}
            >
              {generating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
              {generating ? "Analyzing..." : roadmap ? "Regenerate Plan" : "Generate Roadmap"}
            </button>
            {roadmap && (
              <button
                onClick={downloadRoadmap}
                style={{ padding: "12px 20px", borderRadius: 11, border: `1px solid ${LINE}`, cursor: "pointer", background: PAPER, color: INK2, fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}
              >
                <Download size={14} />
                Export PDF
              </button>
            )}
          </div>
        </div>

        {!hasData && (
          <div style={{ ...panel, padding: 48, textAlign: "center" }}>
            <BookOpen size={36} style={{ color: ACCENT, opacity: 0.4, margin: "0 auto 16px" }} />
            <p style={{ fontSize: 14, color: MUTED }}>Complete at least one NEXUS.AI interview to unlock your personalized roadmap.</p>
            <button onClick={() => (window.location.href = "/")} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, background: ACCENT, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Start Simulation</button>
          </div>
        )}

        {hasData && !roadmap && !generating && (
          <div style={{ ...panel, padding: 32, textAlign: "center", marginBottom: 32 }}>
            <p style={{ fontSize: 13, color: MUTED }}>You have interview data. Click <strong style={{ color: INK }}>Generate Roadmap</strong> to get your AI plan.</p>
          </div>
        )}

        {/* Weakness Analysis */}
        {analysis && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
            <h2 style={{ ...label, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Target size={12} /> Weakness Analysis</h2>
            <div style={{ ...panel, padding: "28px" }}>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: INK2, margin: "0 0 24px" }}>{analysis.summary}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
                {(analysis.patterns || []).map((p, i) => (
                  <div key={i} style={{ background: BG, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{p.theme}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 8px", borderRadius: 99, border: `1px solid ${LINE}`, color: MUTED }}>{p.frequency}</span>
                    </div>
                    <p style={{ fontSize: 11, color: INK2, margin: "0 0 6px" }}>{p.impact}</p>
                    <p style={{ fontSize: 11, color: MUTED, margin: 0, fontStyle: "italic" }}>Root: {p.root_cause}</p>
                  </div>
                ))}
              </div>
              <p style={{ ...label, marginBottom: 8 }}>Priority Areas</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(analysis.priority_areas || []).map((a, i) => (
                  <span key={i} style={{ fontSize: 11, padding: "6px 14px", borderRadius: 99, background: ACCENT_BG, border: `1px solid ${ACCENT_LINE}`, color: ACCENT }}>{a}</span>
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
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13 }}>W{w.week}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{w.focus}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, fontSize: 12 }}>
                    <div>
                      <p style={{ ...label, marginBottom: 6 }}>Topics</p>
                      {(w.topics || []).map((t, i) => <p key={i} style={{ margin: "0 0 3px", color: INK2 }}>· {t}</p>)}
                    </div>
                    <div>
                      <p style={{ ...label, marginBottom: 6 }}>Resources</p>
                      {(w.resources || []).map((r, i) => <p key={i} style={{ margin: "0 0 3px", color: INK2 }}>· {r}</p>)}
                    </div>
                    <div>
                      <p style={{ ...label, marginBottom: 6 }}>Goals</p>
                      {(w.goals || []).map((g, i) => <p key={i} style={{ margin: "0 0 3px", color: INK2 }}>✓ {g}</p>)}
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
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, maxWidth: "75%", color: INK }}>{p.title}</h3>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, border: `1px solid ${LINE}`, color: MUTED }}>{p.difficulty}</span>
                  </div>
                  <p style={{ fontSize: 12, color: INK2, lineHeight: 1.6, margin: "0 0 14px" }}>{p.description}</p>
                  <p style={{ ...label, marginBottom: 6 }}>Skills Addressed</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {(p.skills_addressed || []).map((s, j) => (
                      <span key={j} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 99, background: ACCENT_BG, color: ACCENT }}>{s}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, fontFamily: "monospace", color: MUTED, margin: 0 }}>~{p.estimated_weeks} weeks</p>
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
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < stats.topWeaknesses.length - 1 ? `1px solid ${LINE}` : "none" }}>
                  <span style={{ fontSize: 12, color: INK2 }}>{w.text}</span>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: MUTED }}>{w.count}×</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </> /* end roadmap tab */}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .mentor-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 700px) {
          .mentor-stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      </div>
    </div>
  );
}
