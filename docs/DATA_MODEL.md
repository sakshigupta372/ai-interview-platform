# NEXUS.AI — Data Model

> Living document. Date: 2026-10-26.
> Status tags: **[Verified]** exists in code · **[Planned]** not yet built.

## Existing collections — [Verified in `server/models/`]

### Session (`session.model.js`)
- `sessionId` (string, unique), `clerkId` (string|null), `role` (string)
- `currentQuestion` (string), `currentDifficulty` (string, default "Medium")
- `globalStrengths[]`, `globalWeaknesses[]` (strings)
- `history[]`: `{ question, answer, difficulty, evaluation { score, correctness, clarity, confidence, suggestions, ideal_answer, detected_strengths[], detected_weaknesses[], suggested_next_difficulty, (coding: time_complexity, space_complexity) } }`
- `status`: "active" | "completed"; timestamps on.

### Roadmap (`roadmap.model.js`)
- `clerkId` (indexed), `targetRole`
- `stats { sessionCount, avgScore, topWeaknesses[{text,count}], topStrengths[{text,count}] }`
- `weakness_analysis { summary, patterns[{theme,frequency,impact,root_cause}], priority_areas[] }`
- `learning_roadmap[{ week, focus, topics[], resources[], goals[] }]`
- `recommended_projects[{ title, description, skills_addressed[], difficulty, estimated_weeks }]`; timestamps on.

## Current limitations — [Verified]
- No `User`/role entity → no candidate/interviewer/admin distinction.
- Scores are raw per-answer 0–10; no normalization, confidence, or evidence-sufficiency.
- Strengths/weaknesses are free-text strings, not a structured skill taxonomy.

## Planned additions — [Planned]

### User / role — [Planned]
`clerkId`, `role` (candidate | interviewer | placement_admin), profile metadata, consent/retention flags.

### SkillProfile — [Planned] (shared substrate)
Per user, per dimension (Technical, Coding, Aptitude, Communication, Problem Solving, System Design, HR/Behavioural, Overall Readiness):
`score` (0–100 normalized), `assessmentCount`, `lastAssessedAt`, `trend[]`, `supportingSessions[]`, `confidence`/`evidenceSufficient` (bool), `improvementAreas[]`.
Rules: **unassessed ≠ 0**; low-evidence scores flagged, not shown as reliable; recompute on session completion; historical results preserved.

### JobRequirement — [Planned]
`name`, `targetRole`, `thresholds{dimension:min}`, `mandatorySkills[]`, `optionalFilters`, `minOverallReadiness?`, `status` (active/archived), owner (interviewer).

### MatchResult / Shortlist — [Planned]
Match: requirement↔candidate, eligibility (mandatory-gated) **separate from** documented match %, per-skill pass/fail, missing-evidence, supporting history. Shortlist: role/company groupings of candidates.

### KnowledgeDoc (RAG) — [Planned]
`content`, `chunk`, `embedding`, `metadata{source,topic,role,skill}`, access scope.

### Scoring methodology & limitations — [Planned]
To be fully specified with normalization formulas, denominators, and confidence thresholds in Phase 2.
