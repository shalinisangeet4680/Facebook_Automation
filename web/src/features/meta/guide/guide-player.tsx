"use client";

import { Pause, Play } from "lucide-react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import type { GuideStep } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { BrowserFrame } from "./frame";
import {
  SceneAddSystemUser,
  SceneAssignAssets,
  SceneCopyToken,
  SceneCreateApp,
  SceneGenerateToken,
  SceneOpenSettings,
} from "./scenes";

const STEP_MS = 6500;

const URLS: Record<string, string> = {
  open_business_settings: "business.facebook.com/latest/home",
  create_app: "developers.facebook.com/apps",
  add_system_user: "business.facebook.com/settings/system-users",
  assign_assets: "business.facebook.com/settings/system-users",
  generate_token: "business.facebook.com/settings/system-users",
  paste_token: "business.facebook.com/settings/system-users",
};

function Scene({ id, permissions }: { id: string; permissions: string[] }) {
  switch (id) {
    case "open_business_settings":
      return <SceneOpenSettings />;
    case "create_app":
      return <SceneCreateApp />;
    case "add_system_user":
      return <SceneAddSystemUser />;
    case "assign_assets":
      return <SceneAssignAssets />;
    case "generate_token":
      return <SceneGenerateToken permissions={permissions} />;
    default:
      return <SceneCopyToken />;
  }
}

export function GuidePlayer({
  steps,
  permissions,
  index,
  onIndexChange,
}: {
  steps: GuideStep[];
  permissions: string[];
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const playing = !paused && !hovered && !reduce;
  const step = steps[index]!;

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => onIndexChange((index + 1) % steps.length), STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, index, steps.length, onIndexChange]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="grid min-w-0 gap-4"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="relative min-w-0">
          <BrowserFrame url={URLS[step.id] ?? "business.facebook.com"}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Scene id={step.id} permissions={permissions} />
              </motion.div>
            </AnimatePresence>
          </BrowserFrame>
          {!reduce ? (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play guide" : "Pause guide"}
              className="absolute right-3 bottom-3 z-40 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/75"
            >
              {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            </button>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="Guide steps"
          className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") onIndexChange(Math.min(steps.length - 1, index + 1));
            if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
          }}
        >
          {steps.map((s, i) => {
            const active = i === index;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onIndexChange(i)}
                className={cn(
                  "group relative overflow-hidden rounded-[var(--radius-control)] border px-2.5 py-2 text-left transition-colors",
                  active
                    ? "border-accent bg-accent-soft/50"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <span
                  className={cn(
                    "text-caption block font-semibold tabular-nums",
                    active ? "text-accent" : "text-subtle",
                  )}
                >
                  Step {i + 1}
                </span>
                <span
                  className={cn(
                    "text-small mt-0.5 block truncate font-medium",
                    active ? "text-foreground" : "text-muted",
                  )}
                >
                  {s.title}
                </span>
                {active && playing ? (
                  <motion.span
                    key={`${s.id}-${index}`}
                    className="bg-accent absolute bottom-0 left-0 h-0.5"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </MotionConfig>
  );
}
