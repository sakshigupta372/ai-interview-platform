export const APP_NAME = "NEXUS.AI";

const GEMINI_KEY = "nexus_gemini_key";
const LEGACY_GEMINI_KEY = "careerforge_gemini_key";

export function loadGeminiKey() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(GEMINI_KEY) || sessionStorage.getItem(LEGACY_GEMINI_KEY);
}

export function saveGeminiKey(key) {
  sessionStorage.setItem(GEMINI_KEY, key.trim());
  sessionStorage.removeItem(LEGACY_GEMINI_KEY);
}

// Parsed resume summary (name, skills, projects...) kept in this browser so the
// interview can personalise questions. The PDF itself is never stored.
const RESUME_KEY = "nexus_resume_context";

export function loadResumeContext() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveResumeContext(ctx) {
  if (typeof window === "undefined") return;
  if (ctx) localStorage.setItem(RESUME_KEY, JSON.stringify(ctx));
  else localStorage.removeItem(RESUME_KEY);
}
