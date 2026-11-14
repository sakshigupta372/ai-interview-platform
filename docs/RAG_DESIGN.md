# NEXUS.AI — RAG Design

> Living document. Date: 2026-10-26. **Status: [Planned] — not yet implemented.**

## Purpose
Ground Nexus Mentor recommendations in retrieved learning material instead of relying solely on the LLM's internal knowledge, with real source attribution.

## Planned workflow
1. Identify candidate weakness from Phase 2 skill-profile evidence (not free-text guesses).
2. Build a retrieval query from weakness + target role.
3. Search a curated knowledge base.
4. Retrieve + rank relevant passages/resources.
5. Pass retrieved context to Gemini.
6. Generate explanation / practice plan / exercise.
7. Show the actual sources used to the candidate.
8. Track learning progress; recommend reassessment.

## Store choice (to decide in Phase 4)
Preference: **MongoDB Atlas Vector Search** to avoid introducing a new service (keeps the "no unnecessary microservices" and "no new paid dependency" constraints). Alternative: lightweight local index. Decision + rationale recorded here when made.

## Content types (planned)
Technical notes, coding explanations, interview prep, system design concepts, communication exercises, curated resources, approved company-specific material.

## Safeguards (planned)
- Document chunking + metadata + updatable ingestion.
- Source attribution; **no fabricated citations**; "no sources found" fallback.
- Per-user data isolation and access control (depends on Phase 1).
- Prompt-injection defense on ingested/retrieved content.
- Rate/cost limits on retrieval + generation.

## Status summary
Nothing here is built yet. Current mentor/coach use Gemini knowledge only.
