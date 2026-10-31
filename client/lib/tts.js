// Interviewer voice plays MP3 (same-origin /api/speak).
// Chrome speechSynthesis is fire-and-forget only — it was hanging
// the fallback when `speaking` stayed true with no audio.

export const EL_KEY = "nexus_elevenlabs_key";
export function loadElevenLabsKey() {
  return typeof window !== "undefined" ? sessionStorage.getItem(EL_KEY) || "" : "";
}
export function saveElevenLabsKey(k) {
  sessionStorage.setItem(EL_KEY, k);
}

export function getVoiceId() {
  return "TxGEqnHWrfWFTfGW9XjX";
}

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let audioCtx = null;
let silentOsc = null;
let bufferSource = null;
let player = null;
let speakGen = 0;
let chainGen = 0;
let playChain = Promise.resolve();
let voiceRate = 1.5;
const audioCache = new Map();

const ACKS = {
  English: ["Okay.", "Got it.", "Alright."],
  Hindi: ["Theek hai.", "Achha.", "Chalo."],
  Hinglish: ["Okay.", "Achha.", "Chalo."],
};

function ackList(language) {
  return ACKS[language] || ACKS.English;
}
const SPEED_KEY = "nexus_voice_speed";

export function getVoiceSpeed() {
  return voiceRate;
}

export function setVoiceSpeed(rate) {
  const n = Number(rate);
  voiceRate = n === 2 || n === 1.5 || n === 1 ? n : 1.5;
  if (typeof window !== "undefined") sessionStorage.setItem(SPEED_KEY, String(voiceRate));
  if (player) player.playbackRate = voiceRate;
  if (bufferSource) {
    try { bufferSource.playbackRate.value = voiceRate; } catch {}
  }
}

export function loadVoiceSpeed() {
  if (typeof window === "undefined") return voiceRate;
  const saved = Number(sessionStorage.getItem(SPEED_KEY));
  if (saved === 1 || saved === 1.5 || saved === 2) voiceRate = saved;
  return voiceRate;
}

function getPlayer() {
  if (typeof window === "undefined") return null;
  if (!player) {
    player = new Audio();
    player.preload = "auto";
    player.crossOrigin = "anonymous";
  }
  return player;
}

export function cleanForSpeech(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[_#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cancelSpeech() {
  speakGen += 1;
  chainGen += 1;
  playChain = Promise.resolve();
  if (bufferSource) {
    try { bufferSource.stop(); } catch {}
    bufferSource = null;
  }
  if (player) {
    try {
      player.pause();
      player.removeAttribute("src");
      player.load();
    } catch {}
  }
  if (typeof window !== "undefined") {
    try { window.speechSynthesis?.cancel(); } catch {}
  }
}

function ensureAudioContext() {
  if (typeof window === "undefined") return null;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    if (!silentOsc && audioCtx) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.00001;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      silentOsc = osc;
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Must run inside a click. Unlocks HTMLAudio + WebAudio. */
export function unlockSpeech() {
  if (typeof window === "undefined") return;
  const ctx = ensureAudioContext();
  const el = getPlayer();
  if (el) {
    el.muted = false;
    el.volume = 1;
    try {
      el.src = SILENT_WAV;
      const p = el.play();
      if (p?.catch) p.catch(() => {});
    } catch {}
  }
  try { window.speechSynthesis?.resume(); } catch {}
  return ctx;
}

export function primeInterviewerVoice() {
  const ctx = unlockSpeech() || ensureAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 523.25;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch {}
}

export const holdSpeech = primeInterviewerVoice;

async function fetchSpeech(text, language) {
  const key = `${language}|${text}`;
  if (audioCache.has(key)) return audioCache.get(key);

  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });
  if (!res.ok) throw new Error(`speak ${res.status}`);
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) throw new Error("empty audio");
  audioCache.set(key, buf);
  if (audioCache.size > 10) audioCache.delete(audioCache.keys().next().value);
  return buf;
}

export function prefetchSpeech(text, language = "English") {
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;
  fetchSpeech(cleaned, language).catch(() => {});
}

export function warmupAcks(language = "English") {
  ackList(language).forEach((p) => fetchSpeech(p, language).catch(() => {}));
}

function chainPlay(fn) {
  const g = chainGen;
  playChain = playChain.then(async () => {
    if (g !== chainGen) return;
    await fn();
  }).catch(() => {});
  return playChain;
}

/** Instant "Okay" on submit so the gap is not silent. */
export function playAck(language = "English") {
  const phrases = ackList(language);
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  const key = `${language}|${phrase}`;
  const cached = audioCache.get(key);
  if (cached) {
    chainPlay(() => playViaElement(cached));
    return;
  }
  tryBrowserSpeak(phrase, language);
  fetchSpeech(phrase, language).catch(() => {});
}

export function enqueueSpeak(text, language = "English", { onStart, onEnd } = {}) {
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;
  const g = chainGen;
  chainPlay(async () => {
    if (g !== chainGen) return;
    onStart?.();
    try {
      const buf = await fetchSpeech(cleaned, language);
      if (g !== chainGen) return;
      let ok = await playViaElement(buf);
      if (!ok && g === chainGen) {
        try { ok = await playViaContext(buf); } catch {}
      }
      if (!ok && g === chainGen) tryBrowserSpeak(cleaned, language);
    } catch (e) {
      console.warn("enqueueSpeak:", e.message);
      if (g === chainGen) tryBrowserSpeak(cleaned, language);
    } finally {
      if (g === chainGen) onEnd?.();
    }
  });
}

export function flushSpokenSentences(fullText, spokenUpTo, language, hooks, { final = false } = {}) {
  const text = String(fullText || "");
  let start = Math.max(0, spokenUpTo || 0);
  if (start > text.length) start = text.length;
  const rest = text.slice(start);
  if (!rest) return start;
  if (final) {
    if (cleanForSpeech(rest)) enqueueSpeak(rest, language, hooks);
    return text.length;
  }
  const match = rest.match(/^[\s\S]{8,}?[.!?…](\s|$)/);
  if (!match) return start;
  enqueueSpeak(match[0], language, hooks);
  return start + match[0].length;
}

function playViaElement(arrayBuffer) {
  const el = getPlayer();
  if (!el) return Promise.resolve(false);
  const url = URL.createObjectURL(new Blob([arrayBuffer], { type: "audio/mpeg" }));
  return new Promise((resolve) => {
    const finish = (ok) => {
      el.onended = null;
      el.onerror = null;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    try { el.pause(); } catch {}
    el.muted = false;
    el.volume = 1;
    el.playbackRate = voiceRate;
    el.onended = () => finish(true);
    el.onerror = () => finish(false);
    el.src = url;
    const p = el.play();
    el.playbackRate = voiceRate;
    if (p?.catch) {
      p.catch((err) => {
        console.warn("audio.play():", err?.message || err);
        finish(false);
      });
    }
  });
}

async function playViaContext(arrayBuffer) {
  const ctx = ensureAudioContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") await ctx.resume();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  if (bufferSource) {
    try { bufferSource.stop(); } catch {}
  }
  const src = ctx.createBufferSource();
  src.buffer = audioBuffer;
  src.playbackRate.value = voiceRate;
  src.connect(ctx.destination);
  bufferSource = src;
  return new Promise((resolve) => {
    src.onended = () => {
      if (bufferSource === src) bufferSource = null;
      resolve(true);
    };
    try {
      src.start();
    } catch {
      bufferSource = null;
      resolve(false);
    }
  });
}

function tryBrowserSpeak(text, language) {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!s) return;
  try {
    s.cancel();
    s.resume();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language === "Hindi" ? "hi-IN" : "en-US";
    u.rate = 1.05;
    u.volume = 1;
    s.speak(u);
  } catch {}
}

export async function speak(text, _persona, _elevenLabsKey, { onStart, onEnd } = {}, language = "English") {
  const cleaned = cleanForSpeech(text);
  if (!cleaned) {
    onEnd?.();
    return false;
  }

  const gen = ++speakGen;
  if (bufferSource) {
    try { bufferSource.stop(); } catch {}
    bufferSource = null;
  }
  ensureAudioContext();
  onStart?.();

  const stillMine = () => gen === speakGen;

  try {
    const buf = await fetchSpeech(cleaned, language);
    if (!stillMine()) return;
    let ok = await playViaElement(buf);
    if (!ok && stillMine()) {
      try {
        ok = await playViaContext(buf);
      } catch (e) {
        console.warn("AudioContext TTS:", e.message);
      }
    }
    if (!ok && stillMine()) tryBrowserSpeak(cleaned, language);
    if (stillMine()) onEnd?.();
    return ok;
  } catch (e) {
    console.warn("TTS failed:", e.message);
    if (stillMine()) {
      tryBrowserSpeak(cleaned, language);
      onEnd?.();
    }
    return false;
  }
}
