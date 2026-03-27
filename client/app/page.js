"use client"

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, BrainCircuit, Timer, Zap, ShieldAlert, CheckCircle2, ChevronRight, BarChart3, Mic, MicOff, Volume2, UserCog, Rocket, Building2, Lightbulb, UserRound, ArrowRight } from "lucide-react";

const TypewriterText = ({ text, delay = 15, onComplete }) => {
  const [displayedContent, setDisplayedContent] = useState("");

  useEffect(() => {
    setDisplayedContent("");
    let i = 0;
    const intervalId = setInterval(() => {
      setDisplayedContent((old) => old + text.charAt(i));
      i++;
      if (i >= text.length) {
         clearInterval(intervalId);
         if (onComplete) onComplete();
      }
    }, delay);
    return () => clearInterval(intervalId);
  }, [text, delay]);

  return <p className="whitespace-pre-wrap leading-relaxed text-cyan-50">{displayedContent}</p>;
};

export default function Home() {
  const [stage, setStage] = useState("role-selection");
  const [role, setRole] = useState("");
  const [persona, setPersona] = useState("Harsh Tech Lead"); 
  const [company, setCompany] = useState("Agnostic"); 
  const [interviewType, setInterviewType] = useState("Technical"); // New Tabs!
  
  const [sessionId, setSessionId] = useState("");
  const [timerMode, setTimerMode] = useState("Pressure Mode"); 
  const [currentDifficulty, setCurrentDifficulty] = useState("Medium");
  const [strengths, setStrengths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);
  
  const [liveClarity, setLiveClarity] = useState(0);
  const [liveConfidence, setLiveConfidence] = useState(0);

  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [chatHistory, setChatHistory] = useState([]); 
  
  const [isTyping, setIsTyping] = useState(false);
  const [isAdjustingDifficulty, setIsAdjustingDifficulty] = useState(false); // New Adaptive Hint!
  
  const [finalSummary, setFinalSummary] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false); // TTS State
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // --- Setup Voice Synthesis & Recognition ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setAnswer((prev) => currentTranscript);
        };
        recognitionRef.current.onerror = () => setIsRecording(false);
        recognitionRef.current.onend = () => setIsRecording(false);
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
       alert("Your browser does not support Voice Input. Please use Google Chrome or Microsoft Edge.");
       return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      if (synthRef.current?.speaking) synthRef.current.cancel(); // Stop AI if speaking
      setAnswer(""); 
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const speakAiResponse = (text) => {
    if (!synthRef.current) return;
    setIsAiSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to make it sound slightly robotic/AI like but clear
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    
    utterance.onend = () => setIsAiSpeaking(false);
    synthRef.current.speak(utterance);
  };

  // --- Live Typing Analysis ---
  useEffect(() => {
    if (answer.trim().length === 0) {
      setLiveClarity(0);
      setLiveConfidence(0);
      return;
    }
    const words = answer.trim().split(/\s+/).length;
    const clarityScore = Math.min(100, words * 2.5);
    const hesitantWords = (answer.match(/\b(hmm|uh|um|think|maybe|probably|guess)\b/gi) || []).length;
    const confidenceScore = Math.max(0, Math.min(100, (words * 2) - (hesitantWords * 15)));

    setLiveClarity(clarityScore);
    setLiveConfidence(confidenceScore);
  }, [answer]);

  // --- Timer Logic ---
  const [timeLeft, setTimeLeft] = useState(120);
  const timerRef = useRef(null);

  useEffect(() => {
    let startingTime = 120;
    if (timerMode === "Practice Mode") startingTime = 9999;
    else if (timerMode === "Rapid Fire") startingTime = 30;

    if (stage === "interview" && !isTyping && timerMode !== "Practice Mode" && !isAiSpeaking) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
             clearInterval(timerRef.current);
             submitAnswer("User ran out of time.");
             return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [stage, isTyping, isAiSpeaking, currentQuestion, timerMode]);

  const startInterview = async () => {
    if (!role) return;
    setIsTyping(true);
    setStage("interview");
    
    let timeConfig = 120;
    if (timerMode === "Practice Mode") timeConfig = 9999;
    if (timerMode === "Rapid Fire") timeConfig = 30;

    const complexRoleContext = `A ${persona} acting as a ${interviewType} interviewer at ${company}, interviewing a candidate for a ${role} position. Format strictly.`;

    try {
      const res = await axios.post("http://localhost:5000/interview/start", { role: complexRoleContext });
      setSessionId(res.data.sessionId);
      setCurrentQuestion(res.data.question);
      setChatHistory([{ role: "ai", text: res.data.question, isInitial: true }]);
      setTimeLeft(timeConfig);
      setCurrentDifficulty("Medium");
      
      // Auto-speak the very first question!
      speakAiResponse(res.data.question);
    } catch (err) {
      console.error(err);
      alert("Make sure the backend is running on port 5000!");
      setStage("role-selection");
    } finally {
      setIsTyping(false);
    }
  };

  const submitAnswer = async (forcedAnswer = null) => {
    if (isRecording) toggleRecording(); 
    if (synthRef.current?.speaking) synthRef.current.cancel(); 
    
    const userAns = forcedAnswer || answer;
    if (!userAns.trim()) return;
    
    clearInterval(timerRef.current); 

    const historyWithUser = [...chatHistory, { role: "user", text: userAns }];
    setChatHistory(historyWithUser);
    setAnswer("");
    setIsTyping(true);
    
    // Simulate analyzing before adjusting difficulty UI
    setTimeout(() => { setIsAdjustingDifficulty(true); }, 1500);

    try {
      const res = await axios.post("http://localhost:5000/interview/answer", {
        sessionId,
        answer: userAns
      });

      const updatedHistory = [...historyWithUser];
      updatedHistory[updatedHistory.length - 1].evaluation = res.data.evaluation;

      if (res.data.sessionSummary) {
        setStrengths(res.data.sessionSummary.globalStrengths || []);
        setWeaknesses(res.data.sessionSummary.globalWeaknesses || []);
        setCurrentDifficulty(res.data.sessionSummary.currentDifficulty || "Medium");
      }

      if (res.data.isComplete) {
        setFinalSummary(res.data.sessionSummary);
        setStage("dashboard");
      } else {
        updatedHistory.push({ role: "ai", text: res.data.nextQuestion, isFollowUp: true });
        setCurrentQuestion(res.data.nextQuestion);
        setChatHistory(updatedHistory);
        
        let newTime = 120;
        if (timerMode === "Practice Mode") newTime = 9999;
        if (timerMode === "Rapid Fire") newTime = 30;
        setTimeLeft(newTime); 

        // Auto Voice AI Response
        speakAiResponse(res.data.nextQuestion);
      }
    } catch (err) {
        console.error(err);
    } finally {
      setIsTyping(false);
      setIsAdjustingDifficulty(false);
    }
  };

  const chatEndRef = useRef(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping, isAdjustingDifficulty]);


  const getDifficultyColor = (diff) => {
    if (diff === "Easy") return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (diff === "Hard") return "text-red-400 border-red-500/30 bg-red-500/10";
    return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden text-slate-100 flex flex-col justify-center items-center font-sans z-0">
      
      <div className="absolute inset-0 z-[-2]">
         <div className="cyberpunk-bg opacity-30"></div>
         <div className="absolute top-0 w-full h-[60%] bg-gradient-to-b from-[#020617] to-transparent z-10" />
      </div>

      <main className="relative z-10 container mx-auto px-4 h-full min-h-screen flex flex-col justify-center items-center py-6">
        
        {/* === STAGE 1: ROLE SELECTION === */}
        <AnimatePresence mode="wait">
          {stage === "role-selection" && (
            <motion.div 
              key="role"
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9, filter: "blur(10px)" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel p-10 rounded-3xl w-full max-w-2xl text-center animated-border bg-[#0a0f1d]/80"
            >
              <div className="flex justify-center mb-6">
                 <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/30 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
                    <BrainCircuit className="w-8 h-8 text-cyan-400 animate-pulse" />
                 </div>
              </div>
              
              <h1 className="text-3xl font-black mb-2 tracking-tight drop-shadow-md">
                Agentic <span className="text-gradient">Engine</span> V4
              </h1>
              <p className="text-cyan-100/70 mb-8 text-sm max-w-md mx-auto">
                Configure your Multi-Agent pipeline, designate company parameters, and initialize your specific interview environment.
              </p>
              
              {/* NEW: Multi-Agent Interview Type Tabs */}
              <div className="flex bg-[#020617] p-1 rounded-xl mb-6 shadow-inner border border-purple-500/20">
                 {["Technical", "HR & Culture", "System Design"].map((type) => (
                    <button 
                      key={type}
                      onClick={() => setInterviewType(type)}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${interviewType === type ? "bg-gradient-to-r from-cyan-500/30 to-purple-500/30 text-white shadow-lg border border-cyan-500/50" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      {type} 
                    </button>
                 ))}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                 <div className="text-left">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 mb-2 block flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Target Company</label>
                   <select 
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full bg-[#020617] border border-cyan-500/30 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400 text-slate-300 transition-all font-medium text-xs shadow-inner appearance-none cursor-pointer"
                   >
                     <option value="Agnostic">General / Agnostic</option>
                     <option value="Google">Google (FAANG Style)</option>
                     <option value="Amazon">Amazon (Leadership Principles)</option>
                     <option value="Stripe">Stripe (Developer Focus)</option>
                   </select>
                 </div>

                 <div className="text-left">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 mb-2 block flex items-center gap-1.5"><UserCog className="w-3 h-3" /> Interviewer Tone</label>
                   <select 
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      className="w-full bg-[#020617] border border-cyan-500/30 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400 text-slate-300 transition-all font-medium text-xs shadow-inner appearance-none cursor-pointer"
                   >
                     <option value="Harsh Tech Lead">Strict & Harsh</option>
                     <option value="Friendly Microsoft HR">Friendly & Positive</option>
                     <option value="Chaotic Startup Founder">Intense Startup Founder</option>
                   </select>
                 </div>
                 
                 <div className="text-left md:col-span-2 lg:col-span-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 mb-2 block flex items-center gap-1.5"><Timer className="w-3 h-3" /> Timer Mode</label>
                   <select 
                      value={timerMode}
                      onChange={(e) => setTimerMode(e.target.value)}
                      className="w-full bg-[#020617] border border-cyan-500/30 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400 text-slate-300 transition-all font-medium text-xs shadow-inner appearance-none cursor-pointer"
                   >
                     <option value="Practice Mode">Practice Mode (Off)</option>
                     <option value="Pressure Mode">Pressure Mode (120s)</option>
                     <option value="Rapid Fire">Rapid Fire (30s)</option>
                   </select>
                 </div>
              </div>

              <div className="space-y-6 text-left relative z-20">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  <input 
                    type="text" 
                    placeholder="Enter Job Target (e.g. Senior Frontend Dev)" 
                    className="relative w-full bg-[#020617] border border-cyan-500/40 rounded-xl px-6 py-5 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-white placeholder-slate-600 transition-all font-bold text-sm shadow-inner"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && startInterview()}
                  />
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => startInterview()}
                  disabled={!role || isTyping}
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold py-5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_30px_rgba(192,132,252,0.4)] disabled:opacity-50 tracking-widest uppercase text-xs"
                >
                  {isTyping ? <Loader2 className="animate-spin" /> : <><Mic className="w-4 h-4 fill-current/30" /> Boot Voice Simulation</>}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* === STAGE 2: LIVE INTERVIEW (3-Column Layout) === */}
          {stage === "interview" && (
            <motion.div 
              key="interview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full h-[90vh] grid grid-cols-1 lg:grid-cols-4 gap-6"
            >
              {/* Left Column / Main Area (The Chat) */}
              <div className="lg:col-span-3 flex flex-col glass-panel rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(34,211,238,0.1)] border border-cyan-500/20">
                {/* Header */}
                <div className="border-b border-purple-500/20 p-4 bg-slate-900/60 backdrop-blur-md flex items-center justify-between z-10 w-full">
                  <div className="flex items-center gap-4">
                     <div className="relative">
                       {isRecording && <div className="absolute inset-0 bg-red-500 blur-lg rounded-full animate-ping opacity-60" />}
                       <div className={`relative w-10 h-10 rounded-full flex items-center justify-center border-2 ${isRecording ? 'bg-red-900 border-red-500' : 'bg-[#020617] border-cyan-400'}`}>
                         {isRecording ? <Mic className="w-4 h-4 text-red-400 animate-pulse" /> : <BrainCircuit className="w-5 h-5 text-cyan-400" />}
                       </div>
                     </div>
                     <div>
                       <h2 className="font-bold text-md text-white tracking-wide">{persona} <span className="text-[10px] text-slate-500 uppercase ml-1">@{company}</span></h2>
                       <p className="text-xs text-slate-400 flex items-center gap-1">
                         <span className={`w-1.5 h-1.5 rounded-full ${isAiSpeaking ? 'bg-purple-500 animate-ping' : isRecording ? 'bg-red-500 animate-pulse' : 'bg-emerald-400 animate-pulse'}`}></span> {isAiSpeaking ? "Transmitting Audio..." : isRecording ? "Listening..." : `${interviewType} Flow`}
                       </p>
                     </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest ${getDifficultyColor(currentDifficulty)}`}>
                       Lvl: {currentDifficulty}
                    </div>
                    {timerMode !== "Practice Mode" && (
                    <div className={`px-4 py-1.5 rounded-xl border flex items-center gap-2 font-mono font-bold text-sm transition-colors duration-500 ${
                      timeLeft <= 15 ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse" 
                      : "bg-[#020617]/50 border-slate-700 text-slate-300"
                    }`}>
                      <Timer className="w-4 h-4" />
                      {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                    )}
                  </div>
                </div>

                {/* Chat Flow Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth relative z-10 w-full" style={{ scrollbarColor: '#c084fc transparent' }}>
                  {chatHistory.map((msg, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: msg.role === "ai" ? -10 : 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      key={i} 
                      className={`flex w-full ${msg.role === "ai" ? "justify-start" : "justify-end"} ${msg.isFollowUp ? "pl-10 relative" : ""}`}
                    >
                      {msg.isFollowUp && (
                         <div className="absolute left-4 top-0 bottom-[-20px] w-[2px] bg-slate-800" />
                      )}
                      {msg.isFollowUp && msg.role === "ai" && (
                         <div className="absolute left-4 top-8 w-6 h-[2px] bg-slate-800" />
                      )}

                      <div className={`max-w-[85%] rounded-2xl p-5 relative ${
                        msg.role === "ai" 
                        ? "bg-[#0a0f1d] border-l-2 border-cyan-400 shadow-md border-y border-r border-cyan-500/10 rounded-tl-xl rounded-bl-none" 
                        : "bg-gradient-to-br from-[#1e293b] to-[#0f172a] border-r-2 border-purple-500 rounded-tr-xl rounded-br-none shadow-lg border-y border-l border-purple-500/20"
                      }`}>
                        {msg.role === 'ai' && i === chatHistory.length - 1 && !msg.evaluation && !isTyping ? (
                           <TypewriterText text={msg.text} delay={20} />
                        ) : (
                           <p className={`whitespace-pre-wrap leading-relaxed text-sm ${msg.role === 'ai' ? 'text-cyan-50' : 'text-slate-100'}`}>
                             {msg.text}
                           </p>
                        )}
                        
                        {msg.evaluation && (
                          <motion.div className="mt-4 pt-4 border-t border-slate-800">
                             <div className="flex flex-col mb-3 bg-[#020617]/50 p-3 rounded-lg border border-purple-500/20">
                               <div className="flex justify-between items-center w-full mb-2">
                                  <span className="text-xs uppercase text-slate-400 font-bold tracking-widest">Neural Score</span>
                                  <span className={`font-black text-md px-2 rounded-sm ${msg.evaluation.score >= 7 ? "text-emerald-400" : msg.evaluation.score >= 5 ? "text-amber-400" : "text-red-400"}`}>
                                    {msg.evaluation.score}/10
                                  </span>
                               </div>
                               <p className="text-xs text-slate-400 italic">"{msg.evaluation.suggestions}"</p>
                             </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  
                  {isTyping && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start flex-col gap-2">
                      <div className="bg-[#0a0f1d] w-fit border border-cyan-500/20 rounded-xl rounded-bl-none p-4 flex items-center justify-center gap-2 shadow-sm">
                         <div className="flex gap-[2px] items-end h-4">
                           <div className="w-1 bg-cyan-400 rounded-sm animate-[pulse_0.4s_infinite_0ms] h-[40%]" />
                           <div className="w-1 bg-cyan-400 rounded-sm animate-[pulse_0.3s_infinite_100ms] h-[100%]" />
                           <div className="w-1 bg-cyan-400 rounded-sm animate-[pulse_0.5s_infinite_200ms] h-[60%]" />
                         </div>
                         <span className="text-[10px] font-mono text-cyan-400/80 uppercase ml-2">Analyzing Audio & Text Vectors...</span>
                      </div>
                      
                      {/* NEW: Adaptive UI Indicator */}
                      {isAdjustingDifficulty && (
                         <div className="flex items-center gap-2 ml-4 opacity-70">
                            <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                            <span className="text-[10px] text-purple-300 font-mono italic">Interviewer is adjusting difficulty branch...</span>
                         </div>
                      )}
                    </motion.div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* --- NEW: Structure Hint UI --- */}
                {!isTyping && !isRecording && (
                   <div className="px-6 py-2 bg-[#020617] text-[10px] text-cyan-300/60 font-mono flex items-center gap-2 border-t border-slate-800">
                      <Lightbulb className="w-3 h-3 text-amber-400" /> 
                      <span>SUGGESTED FORMAT:</span>
                      {interviewType === "Technical" && <span className="bg-slate-800 px-2 py-0.5 rounded">1. Core Concept</span> <span className="bg-slate-800 px-2 py-0.5 rounded">2. Technical Implementation</span> <span className="bg-slate-800 px-2 py-0.5 rounded">3. Edge Cases / Scaling</span>}
                      {interviewType === "System Design" && <span className="bg-slate-800 px-2 py-0.5 rounded">1. Requirements</span> <span className="bg-slate-800 px-2 py-0.5 rounded">2. High-Level Arch</span> <span className="bg-slate-800 px-2 py-0.5 rounded">3. Database / Bottlenecks</span>}
                      {interviewType === "HR & Culture" && <span className="bg-slate-800 px-2 py-0.5 rounded">1. Situation</span> <span className="bg-slate-800 px-2 py-0.5 rounded">2. Task/Action</span> <span className="bg-slate-800 px-2 py-0.5 rounded">3. Measured Result (STAR)</span>}
                   </div>
                )}

                {/* Input Terminal */}
                <div className="p-4 bg-[#0a0f1d] border-t border-purple-500/20 backdrop-blur-xl z-20">
                  <div className="relative flex gap-3 items-end">
                    <button 
                      onClick={toggleRecording}
                      className={`shrink-0 w-14 h-14 flex justify-center items-center rounded-xl transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)] ${
                        isRecording ? "bg-red-500/20 border border-red-500 text-red-400" : "bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50"
                      }`}
                    >
                      {isRecording ? <Mic className="w-6 h-6 animate-pulse" /> : <MicOff className="w-6 h-6" />}
                    </button>

                    <div className="relative flex-1">
                      <textarea 
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Say it out loud or type here..."
                        className={`w-full bg-[#020617] border rounded-xl px-4 py-4 pr-16 focus:outline-none min-h-[56px] resize-none font-mono text-xs text-slate-200 focus:border-cyan-400/50 ${isRecording ? 'border-red-500/50' : 'border-slate-700'}`}
                        spellCheck="false"
                      />
                      <button 
                        onClick={() => submitAnswer()}
                        disabled={!answer.trim() || isTyping}
                        className="absolute right-2 bottom-2 w-10 h-10 bg-purple-600 hover:bg-purple-500 flex justify-center items-center rounded-lg disabled:opacity-30 transition-all"
                      >
                        <Zap className="w-4 h-4 text-white fill-current" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Suggestion Keywords while typing */}
                  {answer.length > 5 && (
                     <div className="flex gap-2 mt-3 ml-[4.5rem] items-center text-[9px] uppercase tracking-widest text-slate-500 font-bold">
                        <span>Auto-Detect:</span>
                        {answer.toLowerCase().includes("react") && <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/30">React.js</span>}
                        {answer.toLowerCase().includes("database") && <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/30">Schema Struct</span>}
                        {answer.toLowerCase().includes("api") && <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30">RESTful Protocol</span>}
                     </div>
                  )}
                </div>
              </div>

              {/* Right Column / Live Evaluation Panel */}
              <div className="hidden lg:flex flex-col gap-6">
                 
                 <div className="glass-panel p-5 rounded-3xl h-1/3 flex flex-col border border-slate-800">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-4 flex items-center gap-2">
                       <Activity className="w-4 h-4 text-cyan-400" /> Real-time Speech Sensors
                    </h3>
                    
                    <div className="flex-1 space-y-6">
                       <div>
                          <div className="flex justify-between text-xs mb-2">
                             <span className="text-slate-300">Clarity & Depth</span>
                             <span className="font-mono text-cyan-400">{Math.floor(liveClarity)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                             <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${liveClarity}%` }} />
                          </div>
                       </div>
                       
                       <div>
                          <div className="flex justify-between text-xs mb-2">
                             <span className="text-slate-300">Confidence Tone</span>
                             <span className="font-mono text-purple-400">{Math.floor(liveConfidence)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                             <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${liveConfidence}%` }} />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Memory Recall & Weakness Detection Hub */}
                 <div className="glass-panel p-5 rounded-3xl flex-1 flex flex-col border border-slate-800 overflow-hidden relative">
                    {/* Recall overlay if previous weakness exists */}
                    {weaknesses.length > 0 && (
                       <div className="absolute top-0 right-0 left-0 bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2 mb-4 animate-pulse">
                          <Brain className="w-3 h-3 text-red-400" />
                          <span className="text-[9px] text-red-200 uppercase tracking-widest font-bold">AI Recall: Target struggles with {weaknesses[0].substring(0, 15)}...</span>
                       </div>
                    )}

                    <h3 className={`text-xs uppercase tracking-widest font-bold text-slate-400 mb-4 flex items-center gap-2 ${weaknesses.length > 0 ? "mt-10" : ""}`}>
                       <Target className="w-4 h-4 text-emerald-400" /> Neural Profiling
                    </h3>
                    
                    <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
                       <div>
                         <p className="text-[10px] uppercase font-bold text-red-400 mb-2 border-b border-red-500/20 pb-1">Identified Weaknesses</p>
                         {weaknesses.length === 0 ? (
                           <p className="text-xs text-slate-600 italic">No weaknesses detected yet.</p>
                         ) : (
                           <ul className="space-y-1">
                             {weaknesses.map((w, idx) => (
                               <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1">
                                 <span className="text-red-500 font-bold">×</span> {w}
                               </li>
                             ))}
                           </ul>
                         )}
                       </div>

                       <div>
                         <p className="text-[10px] uppercase font-bold text-emerald-400 mb-2 border-b border-emerald-500/20 pb-1">Verified Strengths</p>
                         {strengths.length === 0 ? (
                           <p className="text-xs text-slate-600 italic">No strengths logged yet.</p>
                         ) : (
                           <ul className="space-y-1">
                             {strengths.map((s, idx) => (
                               <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1">
                                 <span className="text-emerald-500 font-bold">✓</span> {s}
                               </li>
                             ))}
                           </ul>
                         )}
                       </div>
                    </div>
                 </div>

              </div>
            </motion.div>
          )}

          {/* === STAGE 3: DASHBOARD === */}
          {stage === "dashboard" && finalSummary && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-4xl glass-panel text-left rounded-3xl p-10 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-8 border-b border-slate-700/50 pb-6">
                 <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight uppercase">Simulation Report</h2>
                    <p className="text-cyan-400 font-mono text-sm mt-1">{company} • {interviewType}</p>
                 </div>
              </div>
              <div className="text-center mt-20">
                <p className="text-emerald-400 font-bold">Dashboard generated successfully. Ready for deployment.</p>
              </div>
              <div className="mt-8 flex justify-center">
                 <button 
                  onClick={() => window.location.reload()}
                  className="bg-cyan-500 hover:bg-cyan-400 text-[#020617] font-bold py-3 px-8 rounded-xl transition-all"
                >
                  Return to Nexus
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
