#!/usr/bin/env python3
"""
Run 20 full NEXUS.AI agent turns against a live backend and record real timings.

A turn is:
  1) question generation  POST /interview/stream-start  (first turn of a session)
                          POST /interview/stream-next   (later turns)
  2) answer evaluation + next-difficulty decision
                          POST /interview/evaluate
     Difficulty is not a separate LLM/HTTP step in this repo.

There is no LangGraph graph in this codebase. Per-step times are the Express routes above.

Env:
  NEXUS_BENCH_BASE_URL   default http://127.0.0.1:5000
  GEMINI_API_KEY or NEXUS_BENCH_API_KEY
  NEXUS_BENCH_TURNS      default 20
  NEXUS_BENCH_CLEANUP    default 1 (DELETE created sessions)
"""

from __future__ import annotations

import json
import os
import statistics
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = os.environ.get("NEXUS_BENCH_BASE_URL", "http://127.0.0.1:5000").rstrip("/")
API_KEY = (os.environ.get("NEXUS_BENCH_API_KEY") or os.environ.get("GEMINI_API_KEY") or "").strip()
TURN_COUNT = int(os.environ.get("NEXUS_BENCH_TURNS", "20"))
CLEANUP = os.environ.get("NEXUS_BENCH_CLEANUP", "1") != "0"
ROLE = "A Harsh Tech Lead acting as a Technical interviewer at a tech company (Role-focused prep), for a Backend Engineer position."
ANSWERS = [
    "I would start from the requirements, pick a simple API contract, then add caching and a queue if write load grows. I would measure latency before adding complexity.",
    "For retries I use exponential backoff with jitter and a max attempt cap so a downstream outage does not stampede the service.",
    "I would index the query path, check explain plans, and only denormalize after I see a real hot read.",
    "I separate auth from business logic, validate input on the server, and keep secrets in environment variables.",
    "I would add structured logs, request ids, and a health check, then alert on error rate and p95 latency.",
]

MODEL = "gemini-2.5-flash"
OUT_PATH = Path(__file__).resolve().parent / "bench_results.json"


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    idx = (len(ordered) - 1) * (p / 100.0)
    lo = int(idx)
    hi = min(lo + 1, len(ordered) - 1)
    frac = idx - lo
    return ordered[lo] * (1.0 - frac) + ordered[hi] * frac


def request_json(method: str, path: str, payload: dict | None = None, timeout: float = 120.0) -> tuple[int, dict | None, float, str | None]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            elapsed = time.perf_counter() - started
            if not body:
                return resp.status, {}, elapsed, None
            try:
                return resp.status, json.loads(body), elapsed, None
            except json.JSONDecodeError:
                return resp.status, {"text": body}, elapsed, None
    except urllib.error.HTTPError as err:
        elapsed = time.perf_counter() - started
        raw = err.read().decode("utf-8", errors="replace")
        parsed = None
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return err.code, parsed, elapsed, raw or str(err)
    except Exception as err:
        elapsed = time.perf_counter() - started
        return 0, None, elapsed, str(err)


def request_sse(path: str, payload: dict, timeout: float = 120.0) -> tuple[int, dict, float, str | None]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
    )
    started = time.perf_counter()
    events: list[dict] = []
    raw_error = None
    status = 0
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = resp.status
            text = resp.read().decode("utf-8", errors="replace")
            elapsed = time.perf_counter() - started
            for line in text.splitlines():
                if not line.startswith("data: "):
                    continue
                try:
                    events.append(json.loads(line[6:]))
                except json.JSONDecodeError:
                    continue
    except urllib.error.HTTPError as err:
        elapsed = time.perf_counter() - started
        status = err.code
        raw_error = err.read().decode("utf-8", errors="replace") or str(err)
        try:
            events.append(json.loads(raw_error))
        except Exception:
            events.append({"type": "error", "error": raw_error})
    except Exception as err:
        elapsed = time.perf_counter() - started
        raw_error = str(err)

    full_question = ""
    session_id = None
    error = raw_error
    for ev in events:
        if ev.get("type") == "session":
            session_id = ev.get("sessionId")
        elif ev.get("type") == "chunk":
            full_question += ev.get("text") or ""
        elif ev.get("type") == "done":
            full_question = ev.get("fullQuestion") or full_question
        elif ev.get("type") == "error" or ev.get("error"):
            error = ev.get("error") or error
    return status, {"sessionId": session_id, "fullQuestion": full_question, "events": events}, elapsed, error


def main() -> None:
    created_sessions: list[str] = []
    turns: list[dict] = []
    errors = 0
    retries_observed = 0
    session_id = None
    next_difficulty = "Medium"

    health_status, health_body, health_ms, health_err = request_json("GET", "/", timeout=20.0)
    environment = {
        "base_url": BASE_URL,
        "health_http_status": health_status,
        "health_error": health_err,
        "health_body": health_body.get("text") if isinstance(health_body, dict) and "text" in health_body else health_body,
        "api_key_present": len(API_KEY) > 10,
        "langgraph_present_in_repo": False,
        "difficulty_is_separate_llm_step": False,
        "model_hardcoded_in_repo": MODEL,
    }
    for i in range(TURN_COUNT):
        turn: dict = {
            "turn": i + 1,
            "session_id": session_id,
            "ok": False,
            "error": None,
            "http_status_question": None,
            "http_status_evaluate": None,
            "latency_ms": {},
        }
        answer = ANSWERS[i % len(ANSWERS)]

        if session_id is None:
            status, payload, elapsed, err = request_sse(
                "/interview/stream-start",
                {
                    "role": ROLE,
                    "clerkId": "bench-script",
                    "userApiKey": API_KEY or None,
                    "candidateName": "Bench",
                    "isCodingRound": False,
                    "language": "English",
                },
            )
            turn["http_status_question"] = status
            turn["latency_ms"]["question_generation"] = round(elapsed * 1000, 2)
            session_id = payload.get("sessionId")
            question = payload.get("fullQuestion") or ""
            if session_id:
                created_sessions.append(session_id)
            if err or not session_id or not question:
                errors += 1
                turn["error"] = err or "stream-start did not return sessionId and question"
                turns.append(turn)
                session_id = None
                continue
        else:
            status, payload, elapsed, err = request_sse(
                "/interview/stream-next",
                {
                    "sessionId": session_id,
                    "answer": answer,
                    "userApiKey": API_KEY or None,
                    "evaluationScore": 6,
                    "nextDifficulty": next_difficulty,
                    "candidateName": "Bench",
                    "isCodingRound": False,
                    "language": "English",
                },
            )
            turn["http_status_question"] = status
            turn["latency_ms"]["follow_up_generation"] = round(elapsed * 1000, 2)
            question = payload.get("fullQuestion") or ""
            if err or not question:
                errors += 1
                turn["error"] = err or "stream-next did not return a question"
                turns.append(turn)
                session_id = None
                continue

        turn["session_id"] = session_id
        ev_status, ev_payload, ev_elapsed, ev_err = request_json(
            "POST",
            "/interview/evaluate",
            {
                "sessionId": session_id,
                "answer": answer,
                "userApiKey": API_KEY or None,
                "isCodingRound": False,
                "language": "English",
            },
        )
        turn["http_status_evaluate"] = ev_status
        turn["latency_ms"]["evaluate_and_difficulty"] = round(ev_elapsed * 1000, 2)
        if ev_err or not ev_payload or "evaluation" not in ev_payload:
            errors += 1
            turn["error"] = ev_err or "evaluate did not return evaluation"
            turns.append(turn)
            if ev_payload and ev_payload.get("isComplete"):
                session_id = None
            continue

        evaluation = ev_payload.get("evaluation") or {}
        next_difficulty = ev_payload.get("nextDifficulty") or evaluation.get("suggested_next_difficulty") or next_difficulty
        question_ms = turn["latency_ms"].get("question_generation") or turn["latency_ms"].get("follow_up_generation") or 0.0
        turn["latency_ms"]["full_turn"] = round(question_ms + turn["latency_ms"]["evaluate_and_difficulty"], 2)
        turn["score"] = evaluation.get("score")
        turn["suggested_next_difficulty"] = evaluation.get("suggested_next_difficulty")
        turn["ok"] = True
        turns.append(turn)

        if ev_payload.get("isComplete"):
            session_id = None
            next_difficulty = "Medium"

    if CLEANUP:
        for sid in created_sessions:
            request_json("DELETE", f"/interview/session/{sid}", timeout=20.0)

    full_ok = [t["latency_ms"]["full_turn"] for t in turns if t.get("ok") and "full_turn" in t.get("latency_ms", {})]
    q_ok = [t["latency_ms"]["question_generation"] for t in turns if t.get("ok") and "question_generation" in t.get("latency_ms", {})]
    fu_ok = [t["latency_ms"]["follow_up_generation"] for t in turns if t.get("ok") and "follow_up_generation" in t.get("latency_ms", {})]
    ev_ok = [t["latency_ms"]["evaluate_and_difficulty"] for t in turns if t.get("ok") and "evaluate_and_difficulty" in t.get("latency_ms", {})]
    gen_ok = q_ok + fu_ok

    summary = {
        "measured_at": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "environment": environment,
        "requested_turns": TURN_COUNT,
        "completed_ok_turns": sum(1 for t in turns if t.get("ok")),
        "error_count": errors,
        "retry_count_from_client": retries_observed,
        "retry_count_note": "Server-side Gemini 429 retries are not exposed on the HTTP response. Client issued no retries.",
        "latency_ms": {
            "full_turn": {"n": len(full_ok), "p50": percentile(full_ok, 50), "p95": percentile(full_ok, 95)},
            "question_or_follow_up_generation": {"n": len(gen_ok), "p50": percentile(gen_ok, 50), "p95": percentile(gen_ok, 95)},
            "question_generation_stream_start_only": {"n": len(q_ok), "p50": percentile(q_ok, 50), "p95": percentile(q_ok, 95)},
            "follow_up_generation_stream_next_only": {"n": len(fu_ok), "p50": percentile(fu_ok, 50), "p95": percentile(fu_ok, 95)},
            "evaluate_and_difficulty": {"n": len(ev_ok), "p50": percentile(ev_ok, 50), "p95": percentile(ev_ok, 95)},
            "difficulty_decision_alone": {
                "n": 0,
                "p50": None,
                "p95": None,
                "reason": "suggested_next_difficulty is a field inside evaluateAnswer, not a separate agent step.",
            },
        },
        "turns": turns,
        "created_session_ids": created_sessions,
        "cleaned_up": CLEANUP,
    }

    OUT_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    def fmt(v):
        return "n/a" if v is None else f"{v:.2f}"

    print("NEXUS.AI bench")
    print(f"model={MODEL}  base={BASE_URL}  key_present={environment['api_key_present']}")
    print(f"ok_turns={summary['completed_ok_turns']}/{TURN_COUNT}  errors={errors}  client_retries={retries_observed}")
    print("")
    print(f"{'step':<42} {'n':>4} {'p50_ms':>12} {'p95_ms':>12}")
    print("-" * 74)
    for name, block in summary["latency_ms"].items():
        print(f"{name:<42} {block['n']:>4} {fmt(block['p50']):>12} {fmt(block['p95']):>12}")
    print("")
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
