"use client"

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth, UserProfile, UserButton } from "@clerk/nextjs";
import { BackgroundLines } from "@/components/ui/background-lines"; // Assuming they don't have this, I will just use standard styles
import { Rocket, Target, ArrowLeft, BarChart3, Clock, Database, BrainCircuit, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function Profile() {
  const { userId, isLoaded } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    
    axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/interview/user/${userId}`)
      .then(res => {
        setSessions(res.data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [userId, isLoaded]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex justify-center items-center text-cyan-400">
         <div className="flex flex-col items-center gap-4">
           <Activity className="w-8 h-8 animate-pulse" />
           <span className="font-mono text-sm tracking-widest uppercase text-cyan-500/80">Fetching Neural Records...</span>
         </div>
      </div>
    );
  }

  if (!userId) {
     return (
       <div className="min-h-screen bg-[#020617] flex flex-col justify-center items-center text-red-400 font-mono">
         <ShieldAlert className="w-12 h-12 mb-4" />
         <h1>UNAUTHORIZED: CLERK_ID_MISSING</h1>
         <button onClick={() => window.location.href='/'} className="mt-8 border text-white px-4 py-2 hover:bg-slate-800">Return to Node</button>
       </div>
     );
  }

  // Calculate Metrics
  const totalInterviews = sessions.length;
  let avgScore = 0;
  let highestDiff = "Easy";
  
  if (totalInterviews > 0) {
     const allScores = sessions.flatMap(s => s.history.map(h => h.evaluation.score));
     avgScore = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : 0;
     
     if (sessions.some(s => s.currentDifficulty === "Hard")) highestDiff = "Hard";
     else if (sessions.some(s => s.currentDifficulty === "Medium")) highestDiff = "Medium";
  }

  return (
    <div className="min-h-screen bg-[#020617] relative text-slate-100 overflow-x-hidden p-6 md:p-12 font-sans z-0">
      <div className="cyberpunk-bg opacity-20 absolute inset-0 z-[-1]" />
      
      {/* Navbar */}
      <nav className="flex justify-between items-center mb-12">
        <button onClick={() => window.location.href='/'} className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400 uppercase tracking-widest font-bold text-xs bg-cyan-500/10 px-4 py-2 rounded-lg border border-cyan-500/30 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]">
           <ArrowLeft className="w-4 h-4" /> Return to Simulator
        </button>
        <UserButton appearance={{ elements: { avatarBox: "w-10 h-10 border border-slate-700" } }} />
      </nav>

      {/* Hero Stats */}
      <div className="mb-12 text-center md:text-left">
        <h1 className="text-4xl font-black mb-2 uppercase tracking-tight text-white flex items-center gap-3">
          <Database className="w-8 h-8 text-purple-500" /> Executive Profile
        </h1>
        <p className="text-slate-400 ml-1">Agentic tracking dashboard linked to Clerk Auth ID: <span className="text-slate-500 font-mono">{userId.substring(0, 12)}...</span></p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center gap-6">
           <div className="w-16 h-16 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex justify-center items-center">
             <Target className="w-8 h-8 text-cyan-400" />
           </div>
           <div>
             <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Total Simulations</p>
             <p className="text-3xl font-black text-white">{totalInterviews}</p>
           </div>
        </div>
        
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center gap-6">
           <div className="w-16 h-16 rounded-xl bg-purple-500/10 border border-purple-500/30 flex justify-center items-center">
             <BarChart3 className="w-8 h-8 text-purple-400" />
           </div>
           <div>
             <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Global Avg Score</p>
             <p className="text-3xl font-black text-white">{avgScore}</p>
           </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center gap-6">
           <div className="w-16 h-16 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex justify-center items-center">
             <BrainCircuit className="w-8 h-8 text-emerald-400" />
           </div>
           <div>
             <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Peak Difficulty</p>
             <p className="text-3xl font-black text-emerald-400">{highestDiff}</p>
           </div>
        </div>
      </div>

      {/* History Feed */}
      <h3 className="text-sm font-bold border-b border-slate-800 pb-3 text-white uppercase tracking-wider mb-6">Simulation History Data</h3>
      
      {sessions.length === 0 ? (
        <div className="text-center p-20 glass-panel rounded-3xl border border-slate-800/50">
           <Rocket className="w-12 h-12 text-slate-600 mx-auto mb-4" />
           <p className="text-slate-400 font-mono text-sm">No simulation records found in MongoDB.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session, i) => (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               transition={{ delay: i * 0.1 }}
               key={session.sessionId} 
               className="bg-[#0a0f1d] hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all p-6 rounded-3xl group relative overflow-hidden"
             >
                <div className="absolute top-0 right-0 p-4">
                  <span className={`text-[10px] font-bold px-3 py-1 uppercase rounded-full border ${
                    session.currentDifficulty === "Hard" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                    session.currentDifficulty === "Medium" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                    "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  }`}>
                    {session.currentDifficulty}
                  </span>
                </div>
                
                <h4 className="text-sm font-bold text-white mb-1 mt-1 truncate max-w-[80%]">{session.role}</h4>
                <p className="text-[10px] text-slate-500 font-mono mb-6">{new Date(session.createdAt).toLocaleDateString()} • {session.history.length} Qs</p>
                
                <div className="space-y-4">
                   <div>
                     <p className="text-[9px] uppercase font-bold text-red-400 border-b border-red-500/20 pb-1 mb-1.5 flex items-center justify-between">
                        Weaknesses <span className="px-1.5 bg-red-500/20 rounded">{session.globalWeaknesses.length}</span>
                     </p>
                     {session.globalWeaknesses.slice(0, 2).map((w, idx) => (
                        <p key={idx} className="text-xs text-slate-400 truncate">× {w}</p>
                     ))}
                     {session.globalWeaknesses.length === 0 && <p className="text-xs text-slate-600 italic">None logged.</p>}
                   </div>
                   
                   <div>
                     <p className="text-[9px] uppercase font-bold text-emerald-400 border-b border-emerald-500/20 pb-1 mb-1.5 flex items-center justify-between">
                        Strengths <span className="px-1.5 bg-emerald-500/20 rounded">{session.globalStrengths.length}</span>
                     </p>
                     {session.globalStrengths.slice(0, 2).map((s, idx) => (
                        <p key={idx} className="text-xs text-slate-400 truncate">✓ {s}</p>
                     ))}
                     {session.globalStrengths.length === 0 && <p className="text-xs text-slate-600 italic">None logged.</p>}
                   </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center group-hover:border-cyan-500/20 transition-all">
                   <div className="flex gap-1 items-end">
                      {session.history.map((h, idx) => (
                         <div key={idx} className={`w-3 h-3 rounded-full ${h.evaluation.score >= 7 ? "bg-emerald-500/40" : h.evaluation.score >= 5 ? "bg-amber-500/40" : "bg-red-500/40"}`} />
                      ))}
                   </div>
                   <span className="text-[10px] text-cyan-400 uppercase font-mono tracking-widest">LOG: {session.status}</span>
                </div>
             </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
