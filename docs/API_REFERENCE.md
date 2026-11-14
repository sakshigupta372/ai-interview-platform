# NEXUS.AI — API Reference

> Living document. Date: 2026-10-26.
> Status tags: **[Verified]** present in code · **[Planned]** not yet built.
> ⚠️ Authorization column reflects **current** state; routes marked "none (trusts request)" are a known critical gap (audit §6) to be fixed in Phase 1.

## Interview — [Verified] `server/routes/interview.js`

| Method | Path | Body / Params | Auth today |
|---|---|---|---|
| POST | `/interview/stream-start` | `{role, clerkId, userApiKey, resumeContext?, isCodingRound?, candidateName?, drillFocus?, language?}` → SSE | key check only |
| POST | `/interview/evaluate` | `{sessionId, answer, userApiKey, isCodingRound?, language?}` | none (trusts sessionId) |
| POST | `/interview/stream-next` | `{sessionId, answer, userApiKey, resumeContext?, isCodingRound?, candidateName?, evaluationScore?, nextDifficulty?, language?}` → SSE | none |
| POST | `/interview/answer` (legacy) | `{sessionId, answer, userApiKey, resumeContext?, isCodingRound?, candidateName?}` | none |
| GET | `/interview/session/:id` | — | none (trusts :id) |
| GET | `/interview/user/:clerkId` | — | **none — returns any user's sessions** |
| DELETE | `/interview/session/:id` | — | **none — deletes any session** |

## Resume — [Verified] `server/routes/resume.js`
| POST | `/resume/parse` | multipart `resume` (PDF ≤5MB) + `userApiKey` | key check only |

## Mentor — [Verified] `server/routes/mentor.js`
| GET | `/mentor/:clerkId` | — | none (trusts :clerkId) |
| POST | `/mentor/generate` | `{clerkId, userApiKey, targetRole?}` | none |

## Coach — [Verified] `server/routes/coach.js`
| POST | `/coach/analyze/:clerkId` | `{userApiKey, targetRole?}` | key check only; trusts :clerkId |

## Health — [Verified]
| GET | `/` | — | public |

## Planned endpoints — [Planned]
- `/admin/requirements` CRUD, `/admin/candidates`, `/admin/analytics`, `/admin/shortlists` — role-gated.
- `/skills/profile` (authenticated self), `/match` (requirement↔candidate).
- `/mentor/rag` grounded generation with source list.
- All planned routes authenticated + authorized server-side; large lists paginated.

_Contracts will be documented with request/response schemas as each is built._
