export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function chunkText(text, size) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const chunks = [];
  let buf = "";
  for (const w of words) {
    if ((buf + " " + w).trim().length > size) {
      if (buf) chunks.push(buf);
      buf = w;
    } else {
      buf = buf ? `${buf} ${w}` : w;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function fetchMp3(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

async function googleTTS(text, tl) {
  const parts = await Promise.all(
    chunkText(text, 160).map((chunk) => {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(chunk)}`;
      return fetchMp3(url);
    })
  );
  return Buffer.concat(parts);
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {}
  const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, 900);
  const language = body.language || "English";
  if (!text) return Response.json({ error: "text required" }, { status: 400 });

  const backend = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
  try {
    const r = await fetch(`${backend}/interview/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 200) {
        return new Response(buf, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      }
    }
  } catch {}

  try {
    const buf = await googleTTS(text, language === "Hindi" ? "hi" : "en");
    return new Response(buf, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json({ error: e.message || "TTS failed" }, { status: 502 });
  }
}
