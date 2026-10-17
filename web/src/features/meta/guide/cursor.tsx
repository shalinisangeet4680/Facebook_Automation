"use client";

import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

export interface CursorStop {
  x: number;
  y: number;
  click?: boolean;
}

export function Cursor({
  stops,
  duration,
  delay = 0.2,
}: {
  stops: CursorStop[];
  duration: number;
  delay?: number;
}) {
  const times = stops.map((_, i) => (stops.length === 1 ? 1 : i / (stops.length - 1)));
  const clicks = stops
    .map((s, i) => ({ ...s, at: delay + duration * times[i]! }))
    .filter((s) => s.click);
  return (
    <>
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          zIndex: 30,
          marginTop: -4,
          marginLeft: -4,
          pointerEvents: "none",
        }}
        initial={{ left: `${stops[0]!.x}%`, top: `${stops[0]!.y}%`, opacity: 0 }}
        animate={{
          left: stops.map((s) => `${s.x}%`),
          top: stops.map((s) => `${s.y}%`),
          opacity: 1,
        }}
        transition={{
          left: { duration, delay, times, ease: "easeInOut" },
          top: { duration, delay, times, ease: "easeInOut" },
          opacity: { duration: 0.2, delay },
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))" }}
        >
          <path
            d="M4 2.5 19.5 11l-6.6 1.6L10 19.5z"
            fill="#111"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
      {clicks.map((c, i) => (
        <motion.span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            zIndex: 20,
            width: 32,
            height: 32,
            left: `${c.x}%`,
            top: `${c.y}%`,
            x: "-50%",
            y: "-50%",
            borderRadius: 999,
            border: "2px solid #0866ff",
            background: "rgba(8,102,255,.2)",
            pointerEvents: "none",
          }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.4], opacity: [0.9, 0] }}
          transition={{ duration: 0.55, delay: c.at, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

export function Reveal({
  delay,
  children,
  style,
  from = 8,
}: {
  delay: number;
  children: ReactNode;
  style?: CSSProperties;
  from?: number;
}) {
  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, y: from }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Pulse({ delay, style }: { delay: number; style: CSSProperties }) {
  return (
    <motion.span
      aria-hidden
      style={{
        position: "absolute",
        borderRadius: 8,
        outline: "2px solid #0866ff",
        outlineOffset: 2,
        pointerEvents: "none",
        ...style,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0.6] }}
      transition={{ delay, duration: 1.2, times: [0, 0.2, 0.8, 1] }}
    />
  );
}
