"use client";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const LANGUAGES = ["javascript", "python", "java", "cpp", "typescript", "go", "rust", "csharp"];

export default function CodeEditor({ value, onChange, language, onLanguageChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <select
          value={language}
          onChange={e => onLanguageChange(e.target.value)}
          style={{ background: "#FBFAF7", border: "1px solid #E3E5F1", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#0E1A3A", outline: "none", cursor: "pointer" }}
        >
          {LANGUAGES.map(l => <option key={l} value={l} style={{ background: "#fff" }}>{l}</option>)}
        </select>
        <span style={{ fontSize: 10, color: "#596079", fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          ⟩_ Coding Mode
        </span>
      </div>
      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #E3E5F1", minHeight: 260 }}>
        <MonacoEditor
          height="260px"
          language={language}
          theme="vs"
          value={value}
          onChange={v => onChange(v || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}
