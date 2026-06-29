"use client";

import { COMPANIES } from "@/lib/companies";

export default function CompanyPicker({ value, onChange }) {
  return (
    <div>
      <span style={labelStyle}>Target company</span>
      <div className="company-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {COMPANIES.map((co) => {
          const selected = value === co.id;
          return (
            <button
              key={co.id}
              type="button"
              onClick={() => onChange(co.id)}
              title={co.tagline}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "12px 6px",
                borderRadius: 12,
                border: selected ? `1.5px solid ${co.color}` : "1px solid rgba(255,255,255,0.08)",
                background: selected ? `${co.color}18` : "rgba(255,255,255,0.02)",
                cursor: "pointer",
                transition: "all .2s",
                boxShadow: selected ? `0 0 20px ${co.color}33` : "none",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: selected ? co.color : "rgba(255,255,255,0.06)",
                  color: selected ? "#fff" : "rgba(255,255,255,0.55)",
                  fontWeight: 800,
                  fontSize: co.initials.length > 1 ? 10 : 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  letterSpacing: "-0.02em",
                }}
              >
                {co.initials}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: selected ? "#fff" : "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>
                {co.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.28)",
  marginBottom: 10,
  display: "block",
};
