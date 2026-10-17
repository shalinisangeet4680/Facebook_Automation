"use client";

import { Pause, Play } from "lucide-react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import type { GuideStep } from "@/lib/api/types";

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
        style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ position: "relative", minWidth: 0 }}>
          <BrowserFrame url={URLS[step.id] ?? "business.facebook.com"}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                style={{ position: "absolute", inset: 0 }}
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
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                zIndex: 40,
                width: 32,
                height: 32,
                borderRadius: 999,
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(25,25,23,.7)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="Guide steps"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))",
            gap: 8,
            minWidth: 0,
          }}
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
                style={{
                  position: "relative",
                  overflow: "hidden",
                  minWidth: 0,
                  padding: "8px 10px",
                  borderRadius: 8,
                  textAlign: "left",
                  cursor: "pointer",
                  border: `1px solid ${active ? "#191917" : "#E6E4DF"}`,
                  background: active ? "#fff" : "#FAF9F7",
                  color: "#191917",
                  transition: "border-color .15s, background .15s",
                }}
              >
                <span
                  className="rp-mono"
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: active ? "#0F6B4A" : "#6C6962",
                  }}
                >
                  Step {i + 1}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: active ? "#191917" : "#6C6962",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.title}
                </span>
                {active && playing ? (
                  <motion.span
                    key={`${s.id}-${index}`}
                    style={{
                      position: "absolute",
                      left: 0,
                      bottom: 0,
                      height: 2,
                      background: "#0F6B4A",
                    }}
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
