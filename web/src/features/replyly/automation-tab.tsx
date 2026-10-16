"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { usePlayTemplates, usePlayWorkspace, useUpdatePlayApp } from "@/lib/api/queries";
import type { PlayAppDetail, PlaySettings } from "@/lib/api/types";

import { AdvancedSections } from "./advanced";
import { Select } from "./select";
import {
  DELAYS,
  MODE_DESC,
  MODE_LABEL,
  MODE_STYLE,
  MODES,
  rowBorder,
  sortTemplates,
  stars,
  TONES,
  type RatingMode,
} from "./tokens";
import { Section, SettingRow, Toggle, useToast } from "./ui";

type Settings = PlaySettings;

const BEHAVIOR = [
  [
    "translate",
    "Reply in the reviewer’s language",
    "Detects 40+ languages; templates are translated before posting.",
  ],
  [
    "personalize",
    "Let AI personalize templates",
    "Mentions specifics from the review instead of a fixed message.",
  ],
  ["skipEmpty", "Skip star-only reviews", "Don’t reply to ratings with no written text."],
  ["escalate", "Escalate 1★ reviews", "Send to Slack #support with the AI draft attached."],
  ["autoPause", "Safety pause", "Pause auto-replies if rating drops 0.3 in 24h."],
] as const;

export function AutomationTab({ app }: { app: PlayAppDetail }) {
  const toast = useToast();
  const update = useUpdatePlayApp(app.id);
  const templates = usePlayTemplates(app.id);
  const workspace = usePlayWorkspace();
  const [settings, setSettings] = useState<Settings>(app.settings);
  const [source, setSource] = useState(app.settings);
  if (source !== app.settings) {
    setSource(app.settings);
    setSettings(app.settings);
  }

  function save(patch: Partial<Settings>, message?: string) {
    const before = settings;
    setSettings({ ...settings, ...patch });
    update.mutate(
      { settings: patch },
      {
        onSuccess: () => {
          if (message) toast(message);
        },
        onError: (err) => {
          setSettings(before);
          toast(errorMessage(err));
        },
      },
    );
  }

  const rules = [...settings.ratingRules].sort((a, b) => b.rating - a.rating);
  const modes = new Set(rules.map((r) => r.mode));
  const current = modes.size === 1 ? [...modes][0]! : null;
  const options = [
    ...sortTemplates(
      (templates.data?.data ?? []).filter(
        (t) => !t.hidden || rules.some((r) => r.templateId === t.id),
      ),
    ).map((t) => ({
      id: t.id,
      name: t.name + (t.builtIn ? "" : " (yours)"),
    })),
    { id: "ai", name: "AI-written, no template" },
  ];
  const slack = workspace.data?.slackChannel ?? "#support";
  const aiReady = workspace.data?.aiReady ?? true;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Section title="Reply mode" desc="Applies to every rating. Fine-tune per rating below.">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
            gap: 10,
          }}
        >
          {MODES.map((m) => {
            const on = current === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  save(
                    { ratingRules: rules.map((r) => ({ ...r, mode: m })) },
                    `Every rating set to ${MODE_LABEL[m]}`,
                  )
                }
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 12,
                  border: `1.5px solid ${on ? "#191917" : "#E6E4DF"}`,
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  color: "#191917",
                }}
              >
                <span
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontWeight: 600 }}>{MODE_LABEL[m]}</span>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: `1.5px solid ${on ? "#191917" : "#E6E4DF"}`,
                      boxSizing: "border-box",
                      background: on ? "#191917" : "#fff",
                    }}
                  />
                </span>
                <span style={{ fontSize: 12.5, color: "#55534E", lineHeight: 1.45 }}>
                  {MODE_DESC[m]}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Rules by rating" desc="Which mode and template each star rating uses.">
        <div className="rp-card" style={{ borderRadius: 12 }}>
          {rules.map((r, i) => (
            <div
              key={r.rating}
              className="rp-rating-row"
              style={{
                display: "grid",
                gridTemplateColumns: "110px auto minmax(160px,1fr)",
                gap: 16,
                alignItems: "center",
                padding: "12px 16px",
                borderTop: rowBorder(i),
              }}
            >
              <span
                style={{ color: "#C9A227", letterSpacing: 1, fontSize: 13 }}
                aria-label={`${r.rating} stars`}
              >
                {stars(r.rating)}
              </span>
              <div
                role="radiogroup"
                aria-label={`Mode for ${r.rating}-star reviews`}
                style={{
                  display: "flex",
                  padding: 2,
                  borderRadius: 8,
                  background: "#F4F2EE",
                  gap: 2,
                  justifySelf: "start",
                }}
              >
                {MODES.map((m: RatingMode) => {
                  const on = r.mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() =>
                        save({
                          ratingRules: rules.map((y) =>
                            y.rating === r.rating ? { ...y, mode: m } : y,
                          ),
                        })
                      }
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "none",
                        background: on ? "#fff" : "transparent",
                        color: on ? MODE_STYLE[MODE_LABEL[m]]![1] : "#55534E",
                        boxShadow: on ? "0 1px 2px rgba(0,0,0,.08)" : "none",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      {MODE_LABEL[m]}
                    </button>
                  );
                })}
              </div>
              <Select
                block
                label={`Template for ${r.rating}-star reviews`}
                value={r.templateId ?? "ai"}
                onChange={(v) =>
                  save({
                    ratingRules: rules.map((y) =>
                      y.rating === r.rating ? { ...y, templateId: v === "ai" ? null : v } : y,
                    ),
                  })
                }
                options={options.map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Behavior">
        <div className="rp-card" style={{ borderRadius: 12 }}>
          {BEHAVIOR.map(([k, label, desc], i) => (
            <SettingRow
              key={k}
              first={i === 0}
              label={label}
              desc={
                k === "escalate"
                  ? workspace.data?.slackConnected
                    ? `Send to Slack ${slack} with the AI draft attached.`
                    : "Send to Slack with the AI draft attached. Connect Slack under AI & integrations below."
                  : (k === "translate" || k === "personalize") && !aiReady
                    ? `${desc} Needs AI drafting, which is off.`
                    : desc
              }
            >
              <Toggle label={label} on={settings[k]} onChange={() => save({ [k]: !settings[k] })} />
            </SettingRow>
          ))}
          <SettingRow
            label="Posting delay"
            desc="Wait before posting so replies read human, and so you can catch mistakes."
          >
            <Select
              label="Posting delay"
              minWidth={120}
              value={settings.delay}
              onChange={(v) => save({ delay: v as Settings["delay"] })}
              options={DELAYS.map(([v, l]) => ({ value: v, label: l }))}
            />
          </SettingRow>
          <SettingRow label="Voice" desc="Tone the AI uses when personalizing templates.">
            <Select
              label="Voice"
              minWidth={140}
              value={settings.tone}
              onChange={(v) => save({ tone: v as Settings["tone"] })}
              options={TONES.map(([v, l]) => ({ value: v, label: l }))}
            />
          </SettingRow>
        </div>
      </Section>

      <AdvancedSections app={app} settings={settings} save={save} />
    </div>
  );
}
