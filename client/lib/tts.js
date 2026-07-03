// ElevenLabs TTS wrapper — falls back to browser speechSynthesis if no key provided

const VOICE_IDS = {
  "Harsh Tech Lead":        "TxGEqnHWrfWFTfGW9XjX", // Josh — deep, professional male
  "Friendly Microsoft HR":  "21m00Tcm4TlvDq8ikWAM", // Rachel — warm female
  "Chaotic Startup Founder":"AZnzlk1XvdvUeBnXmlld", // Domi — energetic
};

export function getVoiceId(persona) {
  return VOICE_IDS[persona] || VOICE_IDS["Harsh Tech Lead"];
}

export const EL_KEY = "nexus_elevenlabs_key";
export function loadElevenLabsKey() { return typeof window !== "undefined" ? sessionStorage.getItem(EL_KEY) || "" : ""; }
export function saveElevenLabsKey(k) { sessionStorage.setItem(EL_KEY, k); }

let currentAudio = null;

export function cancelSpeech() {
  if (currentAudio) { try { currentAudio.pause(); } catch {} currentAudio = null; }
  if (typeof window !== "undefined") try { window.speechSynthesis?.cancel(); } catch {}
}

export async function speak(text, persona, elevenLabsKey, { onStart, onEnd } = {}) {
  cancelSpeech();
  onStart?.();

  if (elevenLabsKey?.trim().length > 10) {
    try {
      const voiceId = getVoiceId(persona);
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": elevenLabsKey.trim(), "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.75 },
        }),
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      await new Promise((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
        audio.play().catch(resolve);
      });
      onEnd?.();
      return;
    } catch (e) {
      console.warn("ElevenLabs failed, falling back to browser TTS:", e.message);
    }
  }

  // Browser fallback
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!synth) { onEnd?.(); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 0.9;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  synth.speak(u);
}
