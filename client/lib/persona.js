export const TONES = [
  { id: "Harsh Tech Lead", label: "Strict & direct" },
  { id: "Friendly Microsoft HR", label: "Warm & structured" },
  { id: "Chaotic Startup Founder", label: "Fast & casual" },
];

export function toneLabel(persona) {
  return TONES.find((t) => t.id === persona)?.label || "Professional";
}

export function interviewerTitle(company, interviewType) {
  const co = !company || company === "Agnostic" ? "" : company;
  const round = interviewType === "HR & Culture" ? "HR"
    : interviewType === "Coding Round" ? "Coding"
    : interviewType;
  return co ? `${co} ${round} Interviewer` : `${round} Interviewer`;
}

export function interviewerPromptRole(persona, interviewType, companyLabel, tagline, role) {
  const tone = toneLabel(persona).toLowerCase();
  return `A ${tone} ${interviewType} interviewer at ${companyLabel} (${tagline}), for a ${role} position. Do not mention Microsoft, a tech-lead title, or any company other than ${companyLabel}.`;
}
