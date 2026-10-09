"use client";

import { motion } from "motion/react";

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
        className="pointer-events-none absolute z-30 -mt-1 -ml-1"
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
          className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
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
          className="pointer-events-none absolute z-20 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0866ff] bg-[#0866ff]/20"
          style={{ left: `${c.x}%`, top: `${c.y}%` }}
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
  className,
  from = 8,
}: {
  delay: number;
  children: React.ReactNode;
  className?: string;
  from?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: from }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Pulse({ delay, className }: { delay: number; className?: string }) {
  return (
    <motion.span
      aria-hidden
      className={`pointer-events-none absolute rounded-[8px] ring-2 ring-[#0866ff] ring-offset-2 ring-offset-transparent ${className ?? ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0.6] }}
      transition={{ delay, duration: 1.2, times: [0, 0.2, 0.8, 1] }}
    />
  );
}
