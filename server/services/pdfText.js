const { PDFParse } = require("pdf-parse");

/** Extracts plain text from a PDF buffer (pdf-parse v2 API). */
async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return String(result?.text || "").trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}

module.exports = { extractPdfText };
