"use client";

import Image from "next/image";
import { type ReactNode, useEffect } from "react";

export type IconName =
  | "home"
  | "reviews"
  | "posts"
  | "templates"
  | "locations"
  | "ai"
  | "search"
  | "photo"
  | "list"
  | "link"
  | "pin"
  | "calendar"
  | "send"
  | "trash"
  | "more"
  | "chevron";

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M2.5 7.2 8 2.5l5.5 4.7V13.5h-11z" />,
  reviews: <path d="M2.5 3.5h11v7.5H7l-3 2.5V11H2.5z" />,
  posts: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
      <path d="M5.5 6.5h5M5.5 9.5h3" />
    </>
  ),
  templates: <path d="M8 2.2l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 10.9l-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z" />,
  locations: (
    <>
      <path d="M8 14s4.5-4.2 4.5-7.8a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z" />
      <circle cx="8" cy="6.3" r="1.6" />
    </>
  ),
  ai: (
    <>
      <path d="M8 2l1.4 3.6L13 7l-3.6 1.4L8 12l-1.4-3.6L3 7l3.6-1.4z" />
      <path d="M12.5 11.5l.5 1.3 1.3.5-1.3.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </>
  ),
  photo: (
    <>
      <rect x="2" y="2.7" width="12" height="10.6" rx="1.7" />
      <circle cx="6" cy="6.7" r="1.2" />
      <path d="m14 10.7-3.3-3.3-6 6" />
    </>
  ),
  list: <path d="M6 4h7.3M6 8h7.3M6 12h7.3M2.7 4h.01M2.7 8h.01M2.7 12h.01" />,
  link: (
    <path d="M6.7 9.3a2.7 2.7 0 0 0 3.8 0l2-2a2.7 2.7 0 0 0-3.8-3.8l-.7.7M9.3 6.7a2.7 2.7 0 0 0-3.8 0l-2 2a2.7 2.7 0 0 0 3.8 3.8l.7-.7" />
  ),
  pin: (
    <>
      <path d="M8 14s4.7-4.1 4.7-7.7a4.7 4.7 0 0 0-9.4 0C3.3 9.9 8 14 8 14z" />
      <circle cx="8" cy="6.3" r="1.7" />
    </>
  ),
  calendar: (
    <>
      <rect x="2.3" y="3.3" width="11.4" height="10" rx="1.7" />
      <path d="M2.3 6.7h11.4M5.3 2v2.7M10.7 2v2.7" />
    </>
  ),
  send: (
    <>
      <path d="M2.7 8 13.3 2.7l-2.6 10.6L8 8.7z" />
      <path d="m8 8.7 5.3-6" />
    </>
  ),
  trash: <path d="M2.7 4.7h10.6M6 4.7v-2h4v2M4 4.7l.7 8.6h6.6l.7-8.6M6.7 7.3v4M9.3 7.3v4" />,
  more: (
    <>
      <circle cx="8" cy="3.3" r=".9" />
      <circle cx="8" cy="8" r=".9" />
      <circle cx="8" cy="12.7" r=".9" />
    </>
  ),
  chevron: <path d="m6 3.5 4.5 4.5L6 12.5" />,
};

export function Icon({
  name,
  size = 16,
  stroke = 1.6,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="gb-logo" style={{ width: size, height: size, borderRadius: size * 0.28 }}>
      <svg
        width={size / 2}
        height={size / 2}
        viewBox="0 0 16 16"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M8 15V8M8 8 3.5 2.5M8 8l4.5-5.5" />
      </svg>
    </span>
  );
}

export function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
      <path
        fill="#FFC107"
        d="M43.6 20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-4z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-4z"
      />
    </svg>
  );
}

export function Stars({ n, size = 13 }: { n: number; size?: number }) {
  const on = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <span className="gb-stars" style={{ fontSize: size }} aria-label={`${on} stars`}>
      <span className="gb-stars-on">{"★".repeat(on)}</span>
      <span className="gb-stars-off">{"★".repeat(5 - on)}</span>
    </span>
  );
}

export function Avatar({
  name,
  photo,
  size = 32,
}: {
  name: string;
  photo?: string | null;
  size?: number;
}) {
  return (
    <span className="gb-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {photo ? (
        <Image
          unoptimized
          src={photo}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      ) : (
        (name.trim()[0] ?? "?").toUpperCase()
      )}
    </span>
  );
}

export function Swatch({
  color,
  label,
  size = 36,
  round,
}: {
  color: string;
  label: string;
  size?: number;
  round?: boolean;
}) {
  return (
    <span
      className="gb-swatch"
      aria-hidden
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.38,
        borderRadius: round ? size / 2 : size * 0.25,
      }}
    >
      {(label.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  fill,
}: {
  value: T;
  options: { id: T; label: ReactNode; n?: ReactNode }[];
  onChange: (id: T) => void;
  label: string;
  fill?: boolean;
}) {
  return (
    <div className={fill ? "gb-seg gb-seg-fill" : "gb-seg"} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          className="gb-seg-btn"
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {o.n !== undefined ? <span className="gb-seg-n">{o.n}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="gb-switch"
      disabled={disabled}
      onClick={() => onChange(!on)}
    />
  );
}

export function Skel({
  h = 16,
  w = "100%",
  r = 10,
}: {
  h?: number;
  w?: number | string;
  r?: number;
}) {
  return <div className="gb-skel" style={{ height: h, width: w, borderRadius: r }} />;
}

export function Notice({
  tone,
  children,
  action,
}: {
  tone: "error" | "warn" | "ok";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`gb-notice gb-notice-${tone}`} role={tone === "error" ? "alert" : undefined}>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {action}
    </div>
  );
}

export function AllDone({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="gb-empty gb-dots" style={{ flex: 1, minHeight: 220, borderRadius: 12 }}>
      <span className="gb-check-big" aria-hidden>
        ✓
      </span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
      {children}
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
}

export function Drawer({
  onClose,
  label,
  children,
}: {
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  useEscape(onClose);
  return (
    <div className="gb-overlay">
      <div className="gb-scrim" onClick={onClose} aria-hidden />
      <div className="gb-drawer" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function Modal({
  onClose,
  label,
  children,
}: {
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  useEscape(onClose);
  return (
    <div className="gb-overlay gb-modal-wrap">
      <div
        className="gb-scrim"
        onClick={onClose}
        aria-hidden
        style={{ background: "rgba(17,17,16,.35)" }}
      />
      <div className="gb-modal" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function Sparkbars({ values, height = 32 }: { values: number[]; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ height, display: "flex", alignItems: "flex-end", gap: 2 }} aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(8, (v / max) * 100)}%`,
            borderRadius: 2,
            background: i === values.length - 1 ? "var(--gb-green)" : "#cfe5da",
            transition: "height .3s",
          }}
        />
      ))}
    </div>
  );
}

export const agoShort = (iso: string | null | undefined, now = Date.now()) => {
  if (!iso) return "";
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo` : `${Math.round(mo / 12)}y`;
};
