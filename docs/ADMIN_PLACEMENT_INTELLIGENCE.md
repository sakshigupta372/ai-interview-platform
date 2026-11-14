# NEXUS.AI — Admin & Placement Intelligence

> Living document. Date: 2026-10-26. **Status: [Planned] — not yet implemented.**

## Current state — [Verified]
No admin/recruiter features exist. No roles, no requirements, no matching, no batch analytics. All current data is per-candidate interview sessions + cached roadmaps.

## Planned scope — [Planned]

### Roles & access
Candidate · Interviewer/Recruiter · Placement Administrator. Enforced on **backend** APIs (depends on Phase 1 auth). URL/UI hiding is not a security boundary.

### Company Requirement Builder
`JobRequirement`: name, target role, per-dimension thresholds, mandatory skills, optional filters, optional min overall readiness; create/edit/duplicate/archive/view; persisted in MongoDB. Not every role needs every dimension.

### Candidate Matching Engine
Compare requirement vs candidate's latest *sufficiently-supported* `SkillProfile`:
- **Eligibility** (gated by mandatory thresholds) shown **separately** from a documented **match %**.
- Per-skill requirement vs candidate score, pass/fail, missing/insufficient evidence, supporting history, shortlist action.
- Transparent configurable rules; no protected/irrelevant personal attributes used in ranking.

### Candidate Management
Search/filter (paginated), profile + skill breakdown, assessment history, requirement matching, shortlist management, comparison, exportable reports. Real DB records only.

### Placement & Skill Analytics
Real aggregates with defined denominators: registered vs assessed candidates, average skill scores, per-skill distributions, candidate×skill heatmap, common weaknesses, strongest skills per batch, improvement earlier→later, counts meeting a given requirement, shortlisted by role/company. Filters by period/role/skill/batch/requirement. No double-counting; consistent aggregation across cards and charts; meaningful empty states.

## Status summary
Design only. Implementation begins in Phase 3, after auth (Phase 1) and the skill profile (Phase 2).
