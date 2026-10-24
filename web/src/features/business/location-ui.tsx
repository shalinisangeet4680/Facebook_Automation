"use client";

import type { CSSProperties, ReactNode } from "react";

import "./location.css";

export function Spin({ light }: { light?: boolean }) {
  return <span className={light ? "gb-lp-spin gb-lp-spin-light" : "gb-lp-spin"} aria-hidden />;
}

export function Section({
  title,
  desc,
  action,
  children,
}: {
  title: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="gb-lp-section">
      <div className="gb-lp-section-head">
        <div className="gb-lp-section-text">
          <h2 className="gb-title gb-lp-section-title">{title}</h2>
          {desc ? <span className="gb-sub">{desc}</span> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SettingRow({
  label,
  desc,
  children,
}: {
  label: ReactNode;
  desc?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="gb-lp-setrow gb-row">
      <div className="gb-lp-setrow-text">
        <span className="gb-lp-setrow-label">{label}</span>
        {desc ? <span className="gb-faint">{desc}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <label className="gb-lp-field" style={style}>
      <span className="gb-lp-label">{label}</span>
      {children}
      {hint ? <span className="gb-faint">{hint}</span> : null}
    </label>
  );
}
