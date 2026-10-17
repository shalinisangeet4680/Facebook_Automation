"use client";

import { AlertTriangle, Check, Copy, X } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

import { copyText, Spinner } from "@/features/replyly/ui";

export const MUTED = "#6C6962";
export const SOFT = "#55534E";

export type CheckState = "pending" | "running" | "passed" | "warning" | "failed";

const TONES = {
  neutral: ["#EFEDE8", SOFT],
  success: ["#EAF3EE", "#0F6B4A"],
  warn: ["#FBF3E2", "#8A5A00"],
  danger: ["#FDF0EE", "#B42318"],
  info: ["#ECEFF6", "#3B4A6B"],
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const [bg, fg] = TONES[tone];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export const cardHead: CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid #EFEDE8",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

export function CardTitle({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 200px" }}
    >
      <h3 style={{ fontWeight: 600, fontSize: 14.5, margin: 0 }}>{title}</h3>
      {sub ? <span style={{ fontSize: 12.5, color: MUTED }}>{sub}</span> : null}
    </div>
  );
}

const DOT: Record<CheckState, CSSProperties> = {
  pending: { border: "1px solid #E6E4DF", background: "#fff" },
  running: { background: "#EAF3EE" },
  passed: { background: "#0F6B4A", color: "#fff" },
  warning: { background: "#B7791F", color: "#fff" },
  failed: { background: "#B42318", color: "#fff" },
};

const MESSAGE_COLOR: Record<CheckState, string> = {
  pending: MUTED,
  running: MUTED,
  passed: MUTED,
  warning: "#8A5A00",
  failed: "#B42318",
};

export function CheckRow({
  state,
  label,
  message,
  first,
}: {
  state: CheckState;
  label: string;
  message?: string;
  first?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 0",
        borderTop: first ? "none" : "1px solid #EFEDE8",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          marginTop: 1,
          borderRadius: 999,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          transition: "background .3s",
          ...DOT[state],
        }}
      >
        {state === "running" ? (
          <Spinner size={10} dark />
        ) : state === "passed" ? (
          <Check size={12} strokeWidth={3} />
        ) : state === "warning" ? (
          <AlertTriangle size={11} strokeWidth={2.5} />
        ) : state === "failed" ? (
          <X size={12} strokeWidth={3} />
        ) : null}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: state === "pending" ? "#6C6962" : "#191917",
          }}
        >
          {label}
        </span>
        {message && state !== "pending" && state !== "running" ? (
          <span style={{ fontSize: 12.5, color: MESSAGE_COLOR[state] }}>{message}</span>
        ) : null}
      </div>
    </div>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rp-btn-light"
      style={{ padding: "6px 11px", gap: 6, fontSize: 12.5 }}
      onClick={async () => {
        if (!(await copyText(value))) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check size={13} color="#0F6B4A" /> : <Copy size={13} />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
