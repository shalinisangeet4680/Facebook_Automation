"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange?: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className="rp-toggle"
      onClick={(e) => {
        e.stopPropagation();
        onChange?.();
      }}
    >
      <span />
    </button>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  small,
  mono,
  label,
  pad,
}: {
  value: T;
  options: { id: T; label: ReactNode; n?: ReactNode }[];
  onChange: (id: T) => void;
  small?: boolean;
  mono?: boolean;
  label: string;
  pad?: number;
}) {
  return (
    <div className="rp-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          className={`rp-seg-btn${value === o.id ? "rp-seg-on" : ""}`}
          style={{
            ...(small ? { padding: "5px 11px", fontSize: 12.5 } : {}),
            ...(pad ? { padding: `6px ${pad}px` } : {}),
            ...(mono ? { fontFamily: "var(--rp-mono)" } : {}),
          }}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {o.n !== undefined ? (
            <span style={{ fontFamily: "var(--rp-mono)", color: "#6C6962" }}>{o.n}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ size = 12, dark }: { size?: number; dark?: boolean }) {
  return (
    <span
      className="rp-spin"
      aria-hidden
      style={{
        width: size,
        height: size,
        ...(dark ? { borderColor: "#CFE3D8", borderTopColor: "#0F6B4A" } : {}),
      }}
    />
  );
}

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 className="rp-serif" style={{ fontSize: 36, lineHeight: 1 }}>
          {title}
        </h1>
        {sub ? <span style={{ color: "#55534E", fontSize: 13.5 }}>{sub}</span> : null}
      </div>
      {actions ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>
      ) : null}
    </div>
  );
}

export function SettingRow({
  label,
  desc,
  children,
  first,
}: {
  label: ReactNode;
  desc?: ReactNode;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 20,
        padding: "14px 16px",
        borderTop: first ? "none" : "1px solid #EFEDE8",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 260px" }}
      >
        <span style={{ fontWeight: 500, fontSize: 13.5 }}>{label}</span>
        {desc ? <span style={{ fontSize: 12.5, color: "#6C6962" }}>{desc}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Section({
  title,
  desc,
  children,
  action,
}: {
  title: ReactNode;
  desc?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 600 }}>{title}</span>
          {desc ? <span style={{ fontSize: 13, color: "#6C6962" }}>{desc}</span> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Banner({
  tone,
  title,
  children,
  action,
}: {
  tone: "error" | "warn" | "info";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const [bg, fg] =
    tone === "error"
      ? ["#FDF0EE", "#7A1A12"]
      : tone === "warn"
        ? ["#FBF3E2", "#8A5A00"]
        : ["#F1F5F2", "#0F6B4A"];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        gap: 14,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderRadius: 10,
        background: bg,
        color: fg,
        fontSize: 13,
        lineHeight: 1.5,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: "1 1 260px" }}
      >
        {title ? <span style={{ fontWeight: 600 }}>{title}</span> : null}
        {children ? <span>{children}</span> : null}
      </div>
      {action}
    </div>
  );
}

export function Skel({
  h = 14,
  w = "100%",
  r = 6,
}: {
  h?: number;
  w?: number | string;
  r?: number;
}) {
  return <div className="rp-shimmer" style={{ height: h, width: w, borderRadius: r }} />;
}

const ToastContext = createContext<(text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: string) => {
    if (timer.current) clearTimeout(timer.current);
    setText(t);
    setKey((k) => k + 1);
    timer.current = setTimeout(() => setText(null), 2600);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {text ? (
        <div key={key} className="rp-toast" role="status" aria-live="polite">
          {text}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
