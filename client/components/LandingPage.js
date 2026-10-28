"use client";

import { useEffect, useRef, useState } from "react";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Key, Mic, Code2, Network, GraduationCap, Briefcase, Building2, RefreshCw, MessageSquare, Sparkles } from "lucide-react";
import "@/app/landing.css";

function useLandingMotion() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = root.querySelectorAll(".rv");

    if (reduce) {
      nodes.forEach((el) => el.classList.add("is-in"));
      return;
    }

    root.classList.add("js-motion");

    const reveal = (el) => {
      if (el.classList.contains("is-in")) return;
      el.classList.add("is-in");
    };

    const revealPassed = () => {
      const line = window.innerHeight * 0.9;
      nodes.forEach((el) => {
        if (el.getBoundingClientRect().top < line) reveal(el);
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target);
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
    );
    nodes.forEach((el) => io.observe(el));

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        root.style.setProperty("--scroll", `${(y / max) * 100}%`);
        root.style.setProperty("--par", String(Math.min(y, 720)));
        root.classList.toggle("is-scrolled", y > 16);
        revealPassed();
        ticking = false;
      });
    };
    onScroll();
    const kick = window.setTimeout(revealPassed, 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", revealPassed);

    return () => {
      io.disconnect();
      window.clearTimeout(kick);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", revealPassed);
    };
  }, []);

  return rootRef;
}

const NAV_LINKS = [
  ["#how", "How it works"],
  ["#practice", "Practice"],
  ["#audience", "Who it's for"],
  ["#faq", "FAQ"],
];

const STEPS = [
  ["01", "Practice", "Sit a mock interview for the role you want — technical, HR, system design, or coding."],
  ["02", "Understand", "Every answer is scored with notes on what landed and what to fix."],
  ["03", "Improve", "Drill the gaps the session found instead of starting from zero."],
  ["04", "Get ready", "Walk into the real round knowing the bar, not guessing it."],
];

const ROUNDS = [
  ["Technical", "Technical interview practice", "DSA, debugging, and follow-ups that adapt to what you just said — closer to a real interviewer than a question bank."],
  ["HR & Culture", "HR and behavioural interview practice", "Tell-me-about-a-time questions with STAR structure, pacing, and culture-fit follow-ups used in campus and product-company rounds."],
  ["System Design", "System design interview practice", "Capacity, APIs, data stores, and trade-offs. Practice explaining the design out loud, not only drawing boxes."],
  ["Coding Round", "Coding interview practice", "A live editor with hidden tests. See the exact case you missed instead of a generic “try again”."],
];

const AUDIENCE = [
  ["Students in placement season", "Use NEXUS.AI as a mock interview lab before company drives. Practise DSA, HR, and coding rounds on your own time, then walk into the real slot with a baseline — not a first attempt."],
  ["Professionals switching roles", "Rehearse senior frontend, backend, or system-design interviews without booking a peer. Company-style tone and scored feedback show whether you are actually interview-ready."],
  ["Colleges and placement cells", "Give a cohort a shared practice loop: same round types, measurable scores, and a mentor that remembers each student’s sessions. Useful as a lab, not only as a website."],
];

const WHYS = [
  ["Company-style questions", "Pick Google, Amazon, a startup, or a general round. The interviewer persona and the bar shift with the company instead of staying generic."],
  ["Feedback you can use", "Each answer is scored with what to keep and what to fix. The next session can drill the weak spot instead of repeating the same mix."],
  ["A mentor that remembers", "Ask what to revise before Thursday’s HR mock. Answers draw on your own transcripts, not a blank chat window."],
];

const COMPARE = [
  ["Structured rounds (technical, HR, design, coding)", "Yes", "Only if you prompt it", "Usually one format"],
  ["Score plus what to fix", "Yes, after each answer", "Chat critique, no rubric", "Peer opinion"],
  ["Company-style tone", "Built in", "Prompt-dependent", "Depends on the partner"],
  ["Live coding editor", "Yes", "No", "Sometimes"],
  ["Remembers your past sessions", "Yes", "Only in that chat", "No"],
  ["Free to start", "Yes — your own Gemini key", "Yes", "Often limited"],
];

const FAQS = [
  ["What is an AI mock interview?", "An AI mock interview is a practice session with an interviewer that asks follow-ups, keeps time, and scores your answers. NEXUS.AI runs technical, HR, system design, and coding rounds so you can rehearse before a real placement or job interview."],
  ["How is NEXUS.AI different from ChatGPT?", "ChatGPT will answer if you paste a question. NEXUS.AI runs a structured interview: a chosen round, company tone, a timer, scored feedback, and an optional coding editor. You practise the loop you will face, not a chat."],
  ["Which interview rounds can I practise?", "Technical (DSA and debugging), HR and culture (behavioural / STAR), system design, and a coding round with hidden tests. You pick the round on this page and the Agentic Engine opens with that type selected."],
  ["Do I need a Gemini API key?", "Yes. NEXUS.AI uses your own Gemini key in the browser. It is not stored on our servers. You can create a free key in Google AI Studio and paste it once per session."],
  ["Is NEXUS.AI free?", "The product is free to use with your own Gemini API key. Optional voice keys (ElevenLabs, Deepgram) are not required — the browser can handle speech if you skip them."],
  ["Can colleges use this for placements?", "Yes. Placement cells can point students at the same practice flow — mock interviews, scores, and a mentor — as a lab before company drives. Faculty-facing cohort tools are on the roadmap; students can start today."],
  ["Does it work for DSA and system design?", "Yes. Technical rounds cover data structures, algorithms, and debugging with follow-ups. System design rounds ask you to reason about scale, APIs, and trade-offs out loud."],
  ["Is my API key stored on your servers?", "No. The Gemini key stays in your browser session. We do not log it on the backend."],
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "NEXUS.AI",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      description: "AI mock interview practice for placements — technical, HR, system design, and coding rounds with scored feedback.",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <rect x="1" y="1" width="28" height="28" rx="9" fill="#0E1A3A"></rect>
      <path d="M10 20.5V9.5l10 11V9.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"></path>
      <circle cx="20" cy="9.5" r="2.6" fill="#4A3DF0" stroke="#fff" strokeWidth="1.2"></circle>
    </svg>
  );
}

function Arrow() {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6"></path>
    </svg>
  );
}

function RoundArt({ type }) {
  if (type === "Technical") {
    return (
      <svg className="scene" viewBox="0 0 280 120" aria-hidden="true">
        <rect x="16" y="18" width="248" height="84" rx="14" fill="#ECEBFE" />
        <circle cx="70" cy="60" r="18" fill="#fff" stroke="#4A3DF0" strokeWidth="2" />
        <circle cx="140" cy="38" r="12" fill="#fff" stroke="#4A3DF0" strokeWidth="2" />
        <circle cx="140" cy="82" r="12" fill="#fff" stroke="#4A3DF0" strokeWidth="2" />
        <circle cx="210" cy="60" r="18" fill="#4A3DF0" />
        <path d="M88 60h32M140 50v20M152 38h40M152 82h40" stroke="#4A3DF0" strokeWidth="2" fill="none" />
        <text x="210" y="64" textAnchor="middle" fill="#fff" fontSize="11" fontFamily="ui-monospace,monospace">Q</text>
      </svg>
    );
  }
  if (type === "HR & Culture") {
    return (
      <svg className="scene" viewBox="0 0 280 120" aria-hidden="true">
        <rect x="16" y="18" width="248" height="84" rx="14" fill="#E2F2EE" />
        <rect x="36" y="36" width="110" height="52" rx="16" fill="#fff" stroke="#0B6B60" strokeWidth="1.6" />
        <rect x="134" y="44" width="110" height="48" rx="16" fill="#0B6B60" />
        <text x="91" y="66" textAnchor="middle" fill="#0B6B60" fontSize="11" fontWeight="700">STAR</text>
        <text x="189" y="72" textAnchor="middle" fill="#fff" fontSize="10">Tell me about…</text>
      </svg>
    );
  }
  if (type === "System Design") {
    return (
      <svg className="scene" viewBox="0 0 280 120" aria-hidden="true">
        <rect x="16" y="18" width="248" height="84" rx="14" fill="#FCEEDD" />
        <rect x="32" y="46" width="52" height="28" rx="6" fill="#fff" stroke="#9A4507" strokeWidth="1.5" />
        <rect x="114" y="36" width="52" height="48" rx="6" fill="#fff" stroke="#9A4507" strokeWidth="1.5" />
        <rect x="196" y="30" width="52" height="28" rx="6" fill="#fff" stroke="#9A4507" strokeWidth="1.5" />
        <rect x="196" y="66" width="52" height="28" rx="6" fill="#9A4507" />
        <path d="M84 60h30M166 50h30M222 58v8" stroke="#9A4507" strokeWidth="1.6" fill="none" markerEnd="none" />
        <text x="58" y="64" textAnchor="middle" fill="#9A4507" fontSize="9">Client</text>
        <text x="140" y="64" textAnchor="middle" fill="#9A4507" fontSize="9">API</text>
        <text x="222" y="48" textAnchor="middle" fill="#9A4507" fontSize="9">Cache</text>
        <text x="222" y="84" textAnchor="middle" fill="#fff" fontSize="9">DB</text>
      </svg>
    );
  }
  return (
    <svg className="scene" viewBox="0 0 280 120" aria-hidden="true">
      <rect x="16" y="18" width="248" height="84" rx="14" fill="#EFF0FB" />
      <rect x="36" y="32" width="208" height="56" rx="8" fill="#0E1A3A" />
      <text x="52" y="54" fill="#7CE0C3" fontSize="10" fontFamily="ui-monospace,monospace">7/8 tests passed</text>
      <text x="52" y="72" fill="#AEB4FF" fontSize="10" fontFamily="ui-monospace,monospace">failed: empty input</text>
      <rect x="168" y="44" width="60" height="8" rx="4" fill="#4A3DF0" />
    </svg>
  );
}

function AudienceArt({ who }) {
  if (who.startsWith("Students")) {
    return (
      <div className="who-art peri">
        <GraduationCap size={28} />
        <svg className="who-bg" viewBox="0 0 160 70" aria-hidden="true">
          <path d="M8 58 L80 18 L152 58" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="48" y="40" width="64" height="22" rx="3" fill="currentColor" opacity=".12" />
        </svg>
      </div>
    );
  }
  if (who.startsWith("Professionals")) {
    return (
      <div className="who-art peri">
        <Briefcase size={28} />
        <svg className="who-bg" viewBox="0 0 160 70" aria-hidden="true">
          <rect x="20" y="22" width="120" height="36" rx="6" fill="currentColor" opacity=".1" />
          <path d="M40 40h80" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
    );
  }
  return (
    <div className="who-art peri">
      <Building2 size={28} />
      <svg className="who-bg" viewBox="0 0 160 70" aria-hidden="true">
        <rect x="30" y="20" width="28" height="40" rx="2" fill="currentColor" opacity=".12" />
        <rect x="66" y="12" width="28" height="48" rx="2" fill="currentColor" opacity=".18" />
        <rect x="102" y="26" width="28" height="34" rx="2" fill="currentColor" opacity=".12" />
      </svg>
    </div>
  );
}

function RoundIcon({ type }) {
  if (type === "Technical") return <Mic size={16} />;
  if (type === "HR & Culture") return <MessageSquare size={16} />;
  if (type === "System Design") return <Network size={16} />;
  return <Code2 size={16} />;
}

function Mark({ text }) {
  const t = text.toLowerCase();
  const kind = t.startsWith("yes") || t === "built in" ? "yes" : t === "no" ? "no" : "mid";
  return (
    <span className={`mk mk-${kind}`}>
      <i />
      {text}
    </span>
  );
}

export default function LandingPage({ onStart, userId, isLoaded, userApiKey, onChangeKey }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useLandingMotion();

  const start = (type) => onStart?.(typeof type === "string" ? type : undefined);

  return (
    <div className="nx" ref={rootRef} style={{ "--indigo": "#4A3DF0" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="scroll-progress" aria-hidden="true" />
      <header className="nav">
        <div className="wrap nav-in">
          <a className="logo" href="#top" aria-label="NEXUS.AI home">
            <LogoMark />
            <span>NEXUS<b>.AI</b></span>
          </a>
          <nav className="nav-links" aria-label="Primary">
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href}>{label}</a>
            ))}
          </nav>
          <div className="nav-cta">
            {isLoaded && !userId && (
              <SignInButton mode="modal">
                <button type="button" className="login">Log in</button>
              </SignInButton>
            )}
            {isLoaded && userId && (
              <div className="nav-user">
                <button type="button" className="login hide-m" onClick={() => { window.location.href = "/mentor"; }}>Mentor</button>
                <button type="button" className="login hide-m" onClick={() => { window.location.href = "/profile"; }}>History</button>
                {userApiKey && onChangeKey && (
                  <button type="button" className="login hide-m" onClick={onChangeKey} aria-label="Change API key" title="Change Gemini API Key">
                    <Key size={14} />
                  </button>
                )}
                <UserButton />
              </div>
            )}
            <button type="button" className="btn btn-p" onClick={() => start()}>
              Start
              <Arrow />
            </button>
            <button className="menu-btn" type="button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d={menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}></path></svg>
            </button>
          </div>
        </div>
        <div className={menuOpen ? "mobile-drawer open" : "mobile-drawer"}>
          {NAV_LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>
          ))}
          {isLoaded && !userId && (
            <SignInButton mode="modal">
              <button type="button" onClick={() => setMenuOpen(false)}>Log in</button>
            </SignInButton>
          )}
          {isLoaded && userId && (
            <>
              <button type="button" onClick={() => { setMenuOpen(false); window.location.href = "/mentor"; }}>Mentor</button>
              <button type="button" onClick={() => { setMenuOpen(false); window.location.href = "/profile"; }}>History</button>
            </>
          )}
        </div>
      </header>

      <section className="hero hero-compact" id="top">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <h1 className="disp in d1">AI mock interviews for placements.</h1>
            <p className="lead in d2">Practice technical, HR, system design, and coding rounds with an AI interviewer. Get scored on every answer — then know what to fix before the real one.</p>
            <div className="ctas in d3">
              <button type="button" className="btn btn-p" onClick={() => start()}>
                Start Your Journey
                <Arrow />
              </button>
              <a className="btn btn-g" href="#how">How it works</a>
            </div>
            <ol className="hero-loop in d4" aria-label="How NEXUS.AI works">
              {STEPS.map(([n, label], i) => (
                <li key={n}>
                  <span className="orb">{n}</span>
                  <b>{label}</b>
                  {i < STEPS.length - 1 && <i className="join" aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </div>

          <div className="hero-preview in d2" aria-hidden="true">
            <div className="card">
              <div className="c-head">
                <span className="live"><i></i>Live</span>
                <span className="mono c-sub">Q3 / 5</span>
              </div>
              <p className="c-title" style={{ marginTop: 8 }}>Technical · Senior Frontend</p>
              <p className="q">“How would you keep a product page fast when the catalog has a million SKUs?”</p>
              <div className="wave">
                <span style={{ height: "40%" }}></span>
                <span style={{ height: "75%", animationDelay: ".1s" }}></span>
                <span style={{ height: "55%", animationDelay: ".2s" }}></span>
                <span style={{ height: "95%", animationDelay: ".3s" }}></span>
                <span style={{ height: "60%", animationDelay: ".4s" }}></span>
                <span style={{ height: "80%", animationDelay: ".5s" }}></span>
                <span className="mono c-sub" style={{ width: "auto", background: "none", animation: "none", marginLeft: "auto", opacity: 1 }}>01:12</span>
              </div>
            </div>
            <div className="card">
              <p className="c-title">After this session</p>
              <div className="bars">
                <div className="bar-row"><span>Problem solving</span><div className="track"><span style={{ width: "81%" }}></span></div><b>81</b></div>
                <div className="bar-row"><span>Communication</span><div className="track"><span style={{ width: "76%", animationDelay: "1.1s" }}></span></div><b>76</b></div>
                <div className="bar-row warn"><span>System design</span><div className="track"><span style={{ width: "54%", animationDelay: "1.2s" }}></span></div><b>54</b></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lean" id="how">
        <div className="wrap">
          <div className="lean-head rv">
            <p className="eyebrow"><i></i>How it works</p>
            <h2 className="disp h2-sm">A mock interview loop, not a chatbot.</h2>
            <p className="lead">NEXUS.AI runs a timed round, scores each answer, and points you at the next drill. You rehearse the same loop you will face in a placement or job interview.</p>
          </div>
          <ol className="loop rv">
            {STEPS.map(([n, title, body], i) => (
              <li key={n} className="loop-node">
                <span className="loop-orb">{n}</span>
                {i < STEPS.length - 1 && <span className="loop-line" aria-hidden="true" />}
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
          <p className="loop-return rv">
            <RefreshCw size={16} />
            Then it loops — each session feeds the next drill instead of starting over.
          </p>
        </div>
      </section>

      <section className="lean lean-tint" id="practice">
        <div className="wrap">
          <div className="lean-head rv">
            <p className="eyebrow"><i></i>Interview rounds</p>
            <h2 className="disp h2-sm">Pick a round and start practising.</h2>
            <p className="lead">Each card opens the Agentic Engine with that interview type already selected.</p>
          </div>
          <div className="type-grid rv">
            {ROUNDS.map(([type, title, body]) => (
              <article key={type} className="type-card">
                <div className={`type-art art-${type === "HR & Culture" ? "hr" : type === "System Design" ? "sys" : type === "Coding Round" ? "code" : "tech"}`} aria-hidden="true">
                  <RoundArt type={type} />
                </div>
                <div className="type-body">
                  <p className="type-k"><RoundIcon type={type} /> {type === "Coding Round" ? "Coding" : type}</p>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <button type="button" className="type-go" onClick={() => start(type)}>
                    Start this round <Arrow />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lean" id="audience">
        <div className="wrap">
          <div className="lean-head rv">
            <p className="eyebrow"><i></i>Who it&apos;s for</p>
            <h2 className="disp h2-sm">Built for the people who actually sit interviews.</h2>
          </div>
          <ul className="audience-grid rv">
            {AUDIENCE.map(([title, body]) => (
              <li key={title} className="who-card">
                <AudienceArt who={title} />
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lean lean-tint" id="why">
        <div className="wrap">
          <div className="lean-head rv">
            <p className="eyebrow"><i></i>Why NEXUS</p>
            <h2 className="disp h2-sm">Built to make the next attempt better.</h2>
          </div>
          <ul className="why-flow rv">
            {WHYS.map(([title, body], i) => (
              <li key={title} className="why-step">
                <span className="why-orb"><Sparkles size={16} /></span>
                {i < WHYS.length - 1 && <span className="why-line" aria-hidden="true" />}
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lean" id="compare">
        <div className="wrap">
          <div className="lean-head rv">
            <p className="eyebrow"><i></i>Compare</p>
            <h2 className="disp h2-sm">NEXUS.AI vs ChatGPT vs a peer mock.</h2>
            <p className="lead">A chatbot can talk. A peer can listen. An interview simulator has to run the round.</p>
          </div>
          <div className="compare-wrap rv">
            <table className="compare">
              <caption className="sr-only">Feature comparison of NEXUS.AI, ChatGPT, and peer mock interviews</caption>
              <thead>
                <tr>
                  <th scope="col">What you get</th>
                  <th scope="col">NEXUS.AI</th>
                  <th scope="col">ChatGPT</th>
                  <th scope="col">Peer mock</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([feat, a, b, c]) => (
                  <tr key={feat}>
                    <th scope="row">{feat}</th>
                    <td><Mark text={a} /></td>
                    <td><Mark text={b} /></td>
                    <td><Mark text={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="lean lean-tint" id="faq">
        <div className="wrap">
          <div className="lean-head rv">
            <p className="eyebrow"><i></i>FAQ</p>
            <h2 className="disp h2-sm">Questions people ask before they start.</h2>
          </div>
          <div className="faq-list rv">
            {FAQS.map(([q, a]) => (
              <details key={q} className="faq-item">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="cta cta-slim" id="start">
        <div className="wrap">
          <div className="cta-box rv">
            <h2 className="disp">Ready when you are.</h2>
            <p className="lead" style={{ margin: "12px auto 0" }}>Start a mock interview — about 15 minutes — and get scored feedback at the end.</p>
            <div className="ctas" style={{ justifyContent: "center" }}>
              <button type="button" className="btn btn-p" onClick={() => start()}>
                Start Your Journey
                <Arrow />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="foot foot-slim">
        <div className="wrap">
          <div className="ft-slim">
            <a className="logo" href="#top">
              <svg width="28" height="28" viewBox="0 0 30 30" aria-hidden="true">
                <rect x="1" y="1" width="28" height="28" rx="9" fill="#FFFFFF"></rect>
                <path d="M10 20.5V9.5l10 11V9.5" stroke="#0E1A3A" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"></path>
                <circle cx="20" cy="9.5" r="2.6" fill="#4A3DF0" stroke="#fff" strokeWidth="1.2"></circle>
              </svg>
              <span>NEXUS<b>.AI</b></span>
            </a>
            <nav aria-label="Footer">
              <a href="#how">How it works</a>
              <a href="#practice">Interview rounds</a>
              <a href="#audience">Who it&apos;s for</a>
              <a href="#compare">Compare</a>
              <a href="#faq">FAQ</a>
              {isLoaded && !userId && (
                <SignInButton mode="modal">
                  <button type="button" className="login">Log in</button>
                </SignInButton>
              )}
              <button type="button" onClick={() => start()}>Start a mock interview</button>
            </nav>
          </div>
          <div className="ft-bot">
            <span>© 2026 NEXUS.AI</span>
            <nav aria-label="Legal"><a href="#why">Privacy</a><a href="#why">Terms</a></nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
