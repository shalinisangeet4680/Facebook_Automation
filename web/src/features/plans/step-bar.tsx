"use client";

import { MUTED } from "./plan-sections";

export function StepBar({
  steps,
  step,
  onGo,
  canGo,
  label,
}: {
  steps: { title: string }[];
  step: number;
  onGo: (step: number) => void;
  canGo?: (step: number) => boolean;
  label?: string;
}) {
  return (
    <nav aria-label="Progress" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12.5, color: MUTED }}>
        Step {step + 1} of {steps.length}
        {label ? ` · ${label}` : ""}
      </span>
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
          gap: 6,
        }}
      >
        {steps.map((s, i) => {
          const past = i < step;
          const current = i === step;
          const open = !current && (canGo ? canGo(i) : past);
          return (
            <li key={s.title}>
              <button
                type="button"
                disabled={!open}
                onClick={() => onGo(i)}
                aria-current={current ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}${past ? " (done, go back)" : open ? " (go to step)" : ""}`}
                style={{
                  width: "100%",
                  height: 6,
                  padding: 0,
                  border: "none",
                  borderRadius: 999,
                  background: past || current ? "#0F6B4A" : "#E6E4DF",
                  opacity: current ? 1 : past ? 0.55 : 1,
                  cursor: open ? "pointer" : "default",
                }}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
