import { Lock } from "lucide-react";
import type { ReactNode } from "react";

export function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div
      style={{
        overflow: "hidden",
        borderRadius: 14,
        border: "1px solid #E6E4DF",
        background: "#fff",
        boxShadow: "0 18px 40px -24px rgba(25,25,23,.3)",
      }}
    >
      <div
        style={{
          height: 38,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 14px",
          background: "#F4F2EE",
          borderBottom: "1px solid #E6E4DF",
        }}
      >
        <span style={{ display: "flex", gap: 6 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: 999, background: c }} />
          ))}
        </span>
        <span
          style={{
            margin: "0 auto",
            height: 24,
            maxWidth: "70%",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 12px",
            borderRadius: 6,
            background: "#fff",
            fontSize: 11.5,
            color: "#6C6962",
          }}
        >
          <Lock size={11} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {url}
          </span>
        </span>
        <span style={{ width: 38 }} />
      </div>
      <div
        style={{
          position: "relative",
          aspectRatio: "16 / 10",
          overflow: "hidden",
          background: "#f6f7f9",
          color: "#1c1e21",
        }}
      >
        {children}
      </div>
    </div>
  );
}
