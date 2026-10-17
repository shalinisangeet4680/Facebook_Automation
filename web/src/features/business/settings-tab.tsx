"use client";

import Link from "next/link";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpLocationDetail,
  type GbpLocationUpdate,
  type GbpRatingRule,
  useBusinessSuggestions,
  useBusinessTemplates,
  useRemoveLocation,
  useUpdateLocation,
} from "@/lib/api/business";
import { Select } from "@/features/replyly/select";
import { DELAYS, MODE_DESC, MODES, stars, TONES } from "@/features/replyly/tokens";
import { Section, Seg, SettingRow, Spinner, Toggle, useToast } from "@/features/replyly/ui";
import { useRouter } from "next/navigation";

const MUTED = "#6C6962";
const MODE_NAME = { auto: "Auto", approval: "Approval", manual: "Manual" } as const;
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const PLACEHOLDERS = [
  ["team_name", "Sign-off", "Dr. Sharma & team"],
  ["phone", "Phone", "+91 …"],
  ["support_email", "Email", "care@yourbusiness.in"],
  ["website", "Website", "https://"],
] as const;

export function SettingsTab({ location }: { location: GbpLocationDetail }) {
  const toast = useToast();
  const router = useRouter();
  const update = useUpdateLocation(location.id);
  const remove = useRemoveLocation();
  const templates = useBusinessTemplates(location.id);
  const suggestions = useBusinessSuggestions(location.id);
  const s = location.settings;
  const [vars, setVars] = useState(location.variables);
  const [words, setWords] = useState(s.neverAutoWords.join(", "));

  const save = (body: GbpLocationUpdate, done = "Saved") =>
    update.mutate(body, {
      onSuccess: () => toast(done),
      onError: (err) => toast(errorMessage(err)),
    });
  const setting = (settings: NonNullable<GbpLocationUpdate["settings"]>) => save({ settings });
  const rule = (r: GbpRatingRule, change: Partial<GbpRatingRule>) =>
    save({
      ratingRules: s.ratingRules.map((x) => (x.rating === r.rating ? { ...x, ...change } : x)),
    });

  const options = [
    { value: "ai", label: "AI-written reply" },
    ...(templates.data?.data ?? [])
      .filter((t) => !t.hidden)
      .map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 860 }}>
      <Section
        title="Reply rules by rating"
        desc="Pick how each star rating is answered and which template the AI starts from."
      >
        <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
          {[...s.ratingRules]
            .sort((a, b) => b.rating - a.rating)
            .map((r, i) => (
              <div
                key={r.rating}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 16px",
                  borderTop: i ? "1px solid #EFEDE8" : "none",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ color: "#C9A227", letterSpacing: 1, width: 80 }}>
                  {stars(r.rating)}
                </span>
                <Seg
                  label={`${r.rating}-star mode`}
                  value={r.mode}
                  small
                  onChange={(m) => rule(r, { mode: m })}
                  options={MODES.map((m) => ({ id: m, label: MODE_NAME[m] }))}
                />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Select
                    label={`${r.rating}-star template`}
                    value={r.templateId ?? "ai"}
                    block
                    align="start"
                    onChange={(v) => rule(r, { templateId: v === "ai" ? null : v })}
                    options={options}
                  />
                </div>
              </div>
            ))}
        </div>
        <span style={{ fontSize: 12.5, color: MUTED }}>
          {MODES.map((m) => `${MODE_NAME[m]}: ${MODE_DESC[m]}`).join(" ")}
        </span>
      </Section>

      <Section title="Voice">
        <div className="rp-card">
          <SettingRow first label="Tone" desc="How replies sound.">
            <Seg
              label="Tone"
              value={s.tone}
              small
              onChange={(tone) => setting({ tone })}
              options={TONES.map(([id, label]) => ({ id, label }))}
            />
          </SettingRow>
          <SettingRow
            label="Personalize"
            desc="AI mentions what the customer said instead of sending the template word for word."
          >
            <Toggle
              on={s.personalize}
              label="Personalize"
              onChange={() => setting({ personalize: !s.personalize })}
            />
          </SettingRow>
          <SettingRow
            label="Reply in the customer’s language"
            desc="Hindi reviews get Hindi replies."
          >
            <Toggle
              on={s.translate}
              label="Reply in the customer’s language"
              onChange={() => setting({ translate: !s.translate })}
            />
          </SettingRow>
          <SettingRow label="Delay before auto-replies" desc="A short pause reads more human.">
            <Select
              label="Delay"
              value={s.delay}
              minWidth={140}
              onChange={(v) => setting({ delay: v as typeof s.delay })}
              options={DELAYS.map(([value, label]) => ({ value, label }))}
            />
          </SettingRow>
          <SettingRow label="Skip star-only reviews" desc="Don’t reply to ratings without text.">
            <Toggle
              on={s.skipEmpty}
              label="Skip star-only reviews"
              onChange={() => setting({ skipEmpty: !s.skipEmpty })}
            />
          </SettingRow>
        </div>
        <span style={{ fontSize: 12.5, color: MUTED }}>
          AI drafting, the daily AI draft limit and the Slack channel are shared across TreeVook.
          Change them in{" "}
          <Link href="/settings#ai" style={{ color: "#0F6B4A" }}>
            Settings → AI & automation
          </Link>
          .
        </span>
      </Section>

      <Section title="Safeguards">
        <div className="rp-card">
          <SettingRow
            first
            label="Quiet hours"
            desc={
              s.quietHours
                ? `Auto-replies wait between ${s.quietHours.start} and ${s.quietHours.end}.`
                : "Auto-replies can post any time."
            }
          >
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {s.quietHours ? (
                <>
                  <Select
                    label="Quiet from"
                    value={s.quietHours.start}
                    minWidth={96}
                    onChange={(v) => setting({ quietHours: { start: v, end: s.quietHours!.end } })}
                    options={HOURS.map((h) => ({ value: h, label: h }))}
                  />
                  <Select
                    label="Quiet until"
                    value={s.quietHours.end}
                    minWidth={96}
                    onChange={(v) =>
                      setting({ quietHours: { start: s.quietHours!.start, end: v } })
                    }
                    options={HOURS.map((h) => ({ value: h, label: h }))}
                  />
                </>
              ) : null}
              <Toggle
                on={Boolean(s.quietHours)}
                label="Quiet hours"
                onChange={() =>
                  setting({ quietHours: s.quietHours ? null : { start: "22:00", end: "08:00" } })
                }
              />
            </span>
          </SettingRow>
          <SettingRow
            label="Daily limit"
            desc="Most automatic replies per day. The rest wait for approval."
          >
            <Select
              label="Daily limit"
              value={String(s.dailyAutoLimit)}
              minWidth={96}
              onChange={(v) => setting({ dailyAutoLimit: Number(v) })}
              options={[5, 10, 20, 50, 100, 200].map((n) => ({
                value: String(n),
                label: String(n),
              }))}
            />
          </SettingRow>
          <SettingRow
            label="Safety pause"
            desc="If the rating drops sharply in a day, auto-replies wait for approval for 24 hours."
          >
            <Toggle
              on={s.autoPause}
              label="Safety pause"
              onChange={() => setting({ autoPause: !s.autoPause })}
            />
          </SettingRow>
          <SettingRow
            label="Alert on 1–2 star reviews"
            desc="Send them to your Slack channel with the AI draft."
          >
            <Toggle
              on={s.escalate}
              label="Alert on low ratings"
              onChange={() => setting({ escalate: !s.escalate })}
            />
          </SettingRow>
          <SettingRow
            label="Never auto-reply when a review mentions"
            desc="These always wait for you."
          >
            <input
              className="rp-input"
              style={{ minWidth: 260 }}
              value={words}
              onChange={(e) => setWords(e.target.value)}
              onBlur={() => {
                const list = words
                  .split(",")
                  .map((w) => w.trim())
                  .filter(Boolean);
                if (list.join(",") !== s.neverAutoWords.join(","))
                  setting({ neverAutoWords: list });
              }}
            />
          </SettingRow>
        </div>
      </Section>

      <Section title="Placeholders" desc="Values templates fill in, like {team_name} and {phone}.">
        <div
          className="rp-card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
        >
          {PLACEHOLDERS.map(([key, labelText, hint]) => {
            const suggestion = suggestions.data?.data.find(
              (x) => x.key === key && x.value !== vars[key],
            );
            return (
              <label
                key={key}
                className="rp-field"
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span className="rp-label">{labelText}</span>
                  <span
                    className="rp-mono"
                    style={{ fontSize: 11, color: MUTED }}
                  >{`{${key}}`}</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <input
                    className="rp-input"
                    value={vars[key] ?? ""}
                    placeholder={hint}
                    onChange={(e) => setVars((v) => ({ ...v, [key]: e.target.value }))}
                  />
                  {suggestion && !vars[key] ? (
                    <button
                      type="button"
                      className="rp-btn-text"
                      style={{ alignSelf: "flex-start", fontSize: 12 }}
                      onClick={() => setVars((v) => ({ ...v, [key]: suggestion.value }))}
                    >
                      Use “{suggestion.value}” from{" "}
                      {suggestion.source === "past_replies" ? "your past replies" : "your profile"}
                    </button>
                  ) : null}
                </span>
              </label>
            );
          })}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "8px 14px" }}
              disabled={
                update.isPending || JSON.stringify(vars) === JSON.stringify(location.variables)
              }
              onClick={() => save({ variables: vars }, "Placeholders saved")}
            >
              {update.isPending ? <Spinner size={11} /> : null}
              Save placeholders
            </button>
          </div>
        </div>
      </Section>

      <Section
        title="Remove location"
        desc="Stops syncing and deletes this location’s reviews, drafts and posts from TreeVook. Nothing changes on Google."
      >
        <div>
          <button
            type="button"
            className="rp-btn-danger"
            style={{ padding: "8px 14px" }}
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Remove ${location.title} from TreeVook?`))
                remove.mutate(location.id, {
                  onSuccess: () => {
                    toast("Location removed");
                    router.replace("/business/locations");
                  },
                  onError: (err) => toast(errorMessage(err)),
                });
            }}
          >
            Remove location
          </button>
        </div>
      </Section>
    </div>
  );
}
