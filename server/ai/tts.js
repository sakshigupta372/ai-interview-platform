const MAX_CHARS = 900;

function chunkText(text, size) {
  const words = text.split(/\s+/).filter(Boolean);
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

async function fetchMp3(url, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

async function googleTranslateTTS(text, tl) {
  const chunks = chunkText(text, 160);
  const parts = await Promise.all(
    chunks.map((chunk) => {
      const url =
        `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(chunk)}`;
      return fetchMp3(url, { Referer: "https://translate.google.com/" });
    })
  );
  return Buffer.concat(parts);
}

async function streamElementsTTS(text) {
  const chunks = chunkText(text, 280);
  const parts = await Promise.all(
    chunks.map((chunk) => {
      const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(chunk)}`;
      return fetchMp3(url);
    })
  );
  return Buffer.concat(parts);
}

async function synthesizeSpeech(rawText, language = "English") {
  const text = String(rawText || "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (!text) throw new Error("empty text");

  const isHindi = language === "Hindi";
  if (isHindi) {
    try {
      return await googleTranslateTTS(text, "hi");
    } catch (e) {
      console.warn("Hindi Google TTS failed:", e.message);
      return await streamElementsTTS(text);
    }
  }

  try {
    return await Promise.any([
      googleTranslateTTS(text, "en"),
      streamElementsTTS(text),
    ]);
  } catch {
    throw new Error("All TTS providers failed");
  }
}

module.exports = { synthesizeSpeech };
