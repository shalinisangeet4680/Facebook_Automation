"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  usePlayRules,
  usePlayTemplates,
  usePlayWorkspace,
  useRemovePlayApp,
  useSaveRules,
  useUpdatePlayApp,
  useUpdatePlayWorkspace,
} from "@/lib/api/queries";
import type { PlayAppDetail, PlayRuleInput, PlaySettings } from "@/lib/api/types";

import { rowBorder } from "./tokens";
import { Banner, Section, SettingRow, Spinner, Toggle, useToast } from "./ui";

const csv = (list?: string[]) => (list ?? []).join(", ");
const words = (s: string) =>
  s
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

export function AdvancedSections({
  app,
  settings,
  save,
}: {
  app: PlayAppDetail;
  settings: PlaySettings;
  save: (patch: Partial<PlaySettings>, message?: string) => void;
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <span className="rp-label">Advanced</span>
        <span style={{ flex: 1, height: 1, background: "#E6E4DF" }} />
      </div>
      <AdvancedRules app={app} />
      <Placeholders app={app} />
      <Safeguards settings={settings} save={save} />
      <AiAndIntegrations />
      <RemoveApp app={app} />
    </>
  );
}

function summary(rule: PlayRuleInput, templateName: (id?: string) => string) {
  const c = rule.conditions;
  const parts = [
    c.edited ? "edited after a reply" : "",
    c.stars?.length ? `${c.stars.join(",")}★` : "",
    c.keywordsAny?.length
      ? `mentions ${c.keywordsAny.slice(0, 3).join(", ")}${c.keywordsAny.length > 3 ? "…" : ""}`
      : "",
    c.keywordsNone?.length ? `not ${c.keywordsNone.slice(0, 2).join(", ")}` : "",
    c.languages?.length ? `in ${c.languages.join(", ")}` : "",
    c.appVersions?.length ? `on ${c.appVersions.join(", ")}` : "",
  ].filter(Boolean);
  const action =
    rule.action.type === "template"
      ? `${templateName(rule.action.templateId)} · ${rule.mode === "auto" ? "auto" : "approval"}${rule.delayMinutes ? ` · ${rule.delayMinutes}m` : ""}`
      : rule.action.type === "claude"
        ? "Ask Claude via the connector"
        : "Skip";
  return { when: parts.length ? parts.join(" · ") : "every review", action };
}

function AdvancedRules({ app }: { app: PlayAppDetail }) {
  const toast = useToast();
  const rules = usePlayRules(app.id);
  const templates = usePlayTemplates(app.id);
  const saveRules = useSaveRules(app.id);
  const [draft, setDraft] = useState<PlayRuleInput[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const list: PlayRuleInput[] =
    draft ?? (rules.data?.data ?? []).map((r) => ({ ...r, action: { ...r.action } }));
  const name = (id?: string) =>
    templates.data?.data.find((t) => t.id === id)?.name ?? "Missing template";
  const firstTemplate = templates.data?.data[0]?.id;

  const change = (next: PlayRuleInput[]) => setDraft(next);
  const commit = () =>
    saveRules.mutate(list, {
      onSuccess: () => {
        setDraft(null);
        setEditing(null);
        toast("Advanced rules saved");
      },
      onError: (err) => toast(errorMessage(err)),
    });

  return (
    <Section
      title="Advanced rules"
      desc="Keyword rules run before the per-rating rules. The first match wins."
      action={
        <button
          type="button"
          className="rp-btn-light"
          onClick={() => {
            change([
              ...list,
              {
                name: "New rule",
                enabled: true,
                conditions: { keywordsAny: [] },
                action: firstTemplate
                  ? { type: "template", templateId: firstTemplate }
                  : { type: "skip" },
                mode: "approval",
                delayMinutes: 30,
              },
            ]);
            setEditing(list.length);
          }}
        >
          Add rule
        </button>
      }
    >
      <div className="rp-card" style={{ borderRadius: 12 }}>
        {!list.length ? (
          <div style={{ padding: "16px", fontSize: 13, color: "#6C6962" }}>
            {rules.isPending
              ? "Loading…"
              : "No advanced rules. Every review follows its star rating."}
          </div>
        ) : null}
        {list.map((r, i) => {
          const s = summary(r, name);
          const set = (patch: Partial<PlayRuleInput>) =>
            change(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={i} style={{ borderTop: rowBorder(i) }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 16px",
                  flexWrap: "wrap",
                }}
              >
                <span className="rp-mono" style={{ fontSize: 11.5, color: "#6C6962", width: 18 }}>
                  {i + 1}
                </span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    flex: "1 1 240px",
                    minWidth: 0,
                  }}
                >
                  <span style={{ fontWeight: 500, fontSize: 13.5 }}>{r.name}</span>
                  <span style={{ fontSize: 12.5, color: "#6C6962" }}>
                    When {s.when} → {s.action}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    type="button"
                    className="rp-btn-quiet"
                    aria-label="Move up"
                    disabled={!i}
                    onClick={() =>
                      change(
                        list.map((x, j) => (j === i - 1 ? list[i]! : j === i ? list[i - 1]! : x)),
                      )
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rp-btn-quiet"
                    aria-label="Move down"
                    disabled={i === list.length - 1}
                    onClick={() =>
                      change(
                        list.map((x, j) => (j === i + 1 ? list[i]! : j === i ? list[i + 1]! : x)),
                      )
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rp-btn-light"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    onClick={() => setEditing(editing === i ? null : i)}
                  >
                    {editing === i ? "Close" : "Edit"}
                  </button>
                  <Toggle
                    label={`${r.name} enabled`}
                    on={r.enabled}
                    onChange={() => set({ enabled: !r.enabled })}
                  />
                </div>
              </div>
              {editing === i ? (
                <div
                  style={{
                    padding: "4px 16px 16px 48px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                    gap: 12,
                  }}
                >
                  <Field label="Name">
                    <input
                      className="rp-input"
                      value={r.name}
                      onChange={(e) => set({ name: e.target.value })}
                    />
                  </Field>
                  <Field label="Stars">
                    <div style={{ display: "flex", gap: 4 }}>
                      {[1, 2, 3, 4, 5].map((n) => {
                        const on = r.conditions.stars?.includes(n) ?? false;
                        return (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              set({
                                conditions: {
                                  ...r.conditions,
                                  stars: on
                                    ? (r.conditions.stars ?? []).filter((x) => x !== n)
                                    : [...(r.conditions.stars ?? []), n],
                                },
                              })
                            }
                            className="rp-mono"
                            style={{
                              padding: "4px 9px",
                              borderRadius: 999,
                              border: `1px solid ${on ? "#191917" : "#E6E4DF"}`,
                              background: on ? "#191917" : "#fff",
                              color: on ? "#fff" : "#55534E",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            {n}★
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Mentions any of">
                    <input
                      className="rp-input"
                      defaultValue={csv(r.conditions.keywordsAny)}
                      onBlur={(e) =>
                        set({ conditions: { ...r.conditions, keywordsAny: words(e.target.value) } })
                      }
                      placeholder="crash, refund"
                    />
                  </Field>
                  <Field label="But none of">
                    <input
                      className="rp-input"
                      defaultValue={csv(r.conditions.keywordsNone)}
                      onBlur={(e) =>
                        set({
                          conditions: { ...r.conditions, keywordsNone: words(e.target.value) },
                        })
                      }
                    />
                  </Field>
                  <Field label="Languages">
                    <input
                      className="rp-input"
                      defaultValue={csv(r.conditions.languages)}
                      onBlur={(e) =>
                        set({ conditions: { ...r.conditions, languages: words(e.target.value) } })
                      }
                      placeholder="en, hi"
                    />
                  </Field>
                  <Field label="Only edited reviews">
                    <Toggle
                      label="Only edited reviews"
                      on={Boolean(r.conditions.edited)}
                      onChange={() =>
                        set({
                          conditions: {
                            ...r.conditions,
                            edited: r.conditions.edited ? undefined : true,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Then">
                    <select
                      className="rp-select"
                      value={r.action.type === "template" ? r.action.templateId : r.action.type}
                      onChange={(e) => {
                        const v = e.target.value;
                        set({
                          action:
                            v === "claude" || v === "skip"
                              ? { type: v }
                              : { type: "template", templateId: v },
                        });
                      }}
                    >
                      {(templates.data?.data ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          Reply with {t.name}
                        </option>
                      ))}
                      <option value="claude">Ask Claude via the connector</option>
                      <option value="skip">Skip, don’t reply</option>
                    </select>
                  </Field>
                  {r.action.type === "template" ? (
                    <>
                      <Field label="Mode">
                        <select
                          className="rp-select"
                          value={r.mode}
                          onChange={(e) => set({ mode: e.target.value as "auto" | "approval" })}
                        >
                          <option value="approval">Approval</option>
                          <option value="auto">Auto</option>
                        </select>
                      </Field>
                      <Field label="Wait (minutes)">
                        <input
                          className="rp-input rp-mono"
                          type="number"
                          min={0}
                          max={1440}
                          value={r.delayMinutes}
                          onChange={(e) =>
                            set({
                              delayMinutes: Math.max(
                                0,
                                Math.min(1440, Number(e.target.value) || 0),
                              ),
                            })
                          }
                        />
                      </Field>
                    </>
                  ) : null}
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button
                      type="button"
                      className="rp-btn-light rp-btn-danger"
                      onClick={() => {
                        change(list.filter((_, j) => j !== i));
                        setEditing(null);
                      }}
                    >
                      Delete rule
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {draft ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              padding: "12px 16px",
              borderTop: "1px solid #EFEDE8",
            }}
          >
            <button
              type="button"
              className="rp-btn-quiet"
              onClick={() => {
                setDraft(null);
                setEditing(null);
              }}
            >
              Discard
            </button>
            <button
              type="button"
              className="rp-btn"
              disabled={saveRules.isPending}
              onClick={commit}
            >
              {saveRules.isPending ? <Spinner /> : null}
              Save rules
            </button>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label
      style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#6C6962" }}
    >
      {label}
      {children}
    </label>
  );
}

const SUGGESTED: [string, string][] = [
  ["support_email", "help@yourapp.com"],
  ["developer_name", "Sam from the team"],
  ["support_phone", "+1 555 0100"],
  ["support_url", "https://yourapp.com/help"],
];

function Placeholders({ app }: { app: PlayAppDetail }) {
  const toast = useToast();
  const update = useUpdatePlayApp(app.id);
  const [values, setValues] = useState<Record<string, string>>(app.variables);
  const [extra, setExtra] = useState("");
  const [source, setSource] = useState(app.variables);
  if (source !== app.variables) {
    setSource(app.variables);
    setValues(app.variables);
  }
  const keys = [...new Set([...SUGGESTED.map(([k]) => k), ...Object.keys(values)])];
  const dirty = JSON.stringify(values) !== JSON.stringify(app.variables);
  return (
    <Section
      title="Placeholder values"
      desc="What {support_email}, {developer_name} and your own placeholders turn into for this app. {user_name}, {app_name}, {rating} and {version} fill in automatically."
    >
      <div className="rp-card" style={{ borderRadius: 12 }}>
        {keys.map((k, i) => (
          <div
            key={k}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(140px,200px) 1fr",
              gap: 12,
              alignItems: "center",
              padding: "10px 16px",
              borderTop: rowBorder(i),
            }}
          >
            <span className="rp-mono" style={{ fontSize: 12.5, color: "#0F6B4A" }}>{`{${k}}`}</span>
            <input
              className="rp-input"
              aria-label={k}
              placeholder={SUGGESTED.find(([s]) => s === k)?.[1] ?? ""}
              value={values[k] ?? ""}
              onChange={(e) => setValues({ ...values, [k]: e.target.value })}
            />
          </div>
        ))}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderTop: "1px solid #EFEDE8",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <form
            style={{ display: "flex", gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              const k = extra
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "_");
              if (k) setValues({ ...values, [k]: values[k] ?? "" });
              setExtra("");
            }}
          >
            <input
              className="rp-input rp-mono"
              aria-label="New placeholder name"
              placeholder="refund_policy_url"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
            <button type="submit" className="rp-btn-light">
              Add placeholder
            </button>
          </form>
          <button
            type="button"
            className="rp-btn"
            disabled={!dirty || update.isPending}
            onClick={() =>
              update.mutate(
                {
                  variables: Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim())),
                },
                {
                  onSuccess: () => toast("Placeholder values saved"),
                  onError: (err) => toast(errorMessage(err)),
                },
              )
            }
          >
            Save values
          </button>
        </div>
      </div>
    </Section>
  );
}

function Safeguards({
  settings,
  save,
}: {
  settings: PlaySettings;
  save: (patch: Partial<PlaySettings>, message?: string) => void;
}) {
  const [limit, setLimit] = useState(String(settings.dailyAutoLimit));
  const [never, setNever] = useState(settings.neverAutoWords.join(", "));
  const [tz, setTz] = useState(settings.timezone);
  const [source, setSource] = useState(settings);
  if (source !== settings) {
    setSource(settings);
    setLimit(String(settings.dailyAutoLimit));
    setNever(settings.neverAutoWords.join(", "));
    setTz(settings.timezone);
  }
  const quiet = settings.quietHours;
  return (
    <Section
      title="Safeguards"
      desc="Automatic replies hold for your approval when any of these apply."
    >
      <div className="rp-card" style={{ borderRadius: 12 }}>
        <SettingRow
          first
          label="Quiet hours"
          desc="Automatic replies wait until the morning in your time zone."
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {quiet ? (
              <>
                <input
                  className="rp-input rp-mono"
                  type="time"
                  aria-label="Quiet from"
                  value={quiet.start}
                  onChange={(e) => save({ quietHours: { ...quiet, start: e.target.value } })}
                />
                <span style={{ color: "#6C6962" }}>to</span>
                <input
                  className="rp-input rp-mono"
                  type="time"
                  aria-label="Quiet until"
                  value={quiet.end}
                  onChange={(e) => save({ quietHours: { ...quiet, end: e.target.value } })}
                />
              </>
            ) : null}
            <Toggle
              label="Quiet hours"
              on={Boolean(quiet)}
              onChange={() => save({ quietHours: quiet ? null : { start: "22:00", end: "08:00" } })}
            />
          </div>
        </SettingRow>
        <SettingRow label="Time zone" desc="Used for quiet hours and daily charts.">
          <input
            className="rp-input rp-mono"
            aria-label="Time zone"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            onBlur={() =>
              tz !== settings.timezone && save({ timezone: tz.trim() }, "Time zone saved")
            }
            style={{ width: 180 }}
          />
        </SettingRow>
        <SettingRow
          label="Daily automatic replies"
          desc="Past this many in 24 hours, new replies wait for approval."
        >
          <input
            className="rp-input rp-mono"
            type="number"
            min={0}
            max={500}
            aria-label="Daily automatic replies"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            onBlur={() =>
              Number(limit) !== settings.dailyAutoLimit &&
              save(
                { dailyAutoLimit: Math.max(0, Math.min(500, Number(limit) || 0)) },
                "Daily limit saved",
              )
            }
            style={{ width: 90 }}
          />
        </SettingRow>
        <SettingRow
          label="Never auto-reply when a review mentions"
          desc="Comma separated. Legal threats, fraud and safety words are included."
        >
          <textarea
            className="rp-input"
            aria-label="Never auto-reply words"
            rows={2}
            value={never}
            onChange={(e) => setNever(e.target.value)}
            onBlur={() => save({ neverAutoWords: words(never) }, "Words saved")}
            style={{ flex: "1 1 280px", resize: "vertical", lineHeight: 1.5 }}
          />
        </SettingRow>
        <SettingRow
          label="Reply again when a review is edited"
          desc="Drafts a new reply when someone changes their review after you answered."
        >
          <Toggle
            label="Reply to edited reviews"
            on={settings.replyToEdited}
            onChange={() => save({ replyToEdited: !settings.replyToEdited })}
          />
        </SettingRow>
      </div>
    </Section>
  );
}

function AiAndIntegrations() {
  const toast = useToast();
  const ws = usePlayWorkspace();
  const update = useUpdatePlayWorkspace();
  const [key, setKey] = useState("");
  const [hook, setHook] = useState("");
  const [channel, setChannel] = useState("");
  const w = ws.data;
  const [source, setSource] = useState<string | null | undefined>(undefined);
  if (w && source !== w.slackChannel) {
    setSource(w.slackChannel);
    setChannel(w.slackChannel ?? "");
  }
  if (!w) return null;
  const run = (body: Parameters<typeof update.mutate>[0], message: string, after?: () => void) =>
    update.mutate(body, {
      onSuccess: () => {
        toast(message);
        after?.();
      },
      onError: (err) => toast(errorMessage(err)),
    });
  return (
    <Section title="AI & integrations" desc="Shared by every app in this workspace.">
      <div className="rp-card" style={{ borderRadius: 12 }}>
        <SettingRow
          first
          label="AI drafting"
          desc={
            w.aiMode === "off"
              ? "Off: drafts use your templates as written, and AI-written ratings wait for Claude through the connector."
              : w.aiMode === "own"
                ? `Uses your Anthropic key${w.aiKeyHint ? ` (${w.aiKeyHint})` : ""} with ${w.model}.`
                : w.platformAi
                  ? `Included: ${w.draftsToday} of ${w.dailyDrafts} drafts used today, with ${w.model}.`
                  : "Replyly’s key isn’t set up on this server. Use your own key, or draft through the connector."
          }
        >
          <select
            className="rp-select"
            aria-label="AI drafting"
            value={w.aiMode}
            onChange={(e) =>
              run({ aiMode: e.target.value as "platform" | "own" | "off" }, "AI drafting updated")
            }
          >
            <option value="platform">Replyly AI</option>
            <option value="own">My Anthropic key</option>
            <option value="off">Off</option>
          </select>
        </SettingRow>
        {w.aiMode === "own" ? (
          <SettingRow
            label="Anthropic API key"
            desc="Stored encrypted. Drafts are billed to your Anthropic account."
          >
            <form
              style={{ display: "flex", gap: 8, flex: "1 1 280px" }}
              onSubmit={(e) => {
                e.preventDefault();
                run({ aiKey: key.trim() }, "API key saved", () => setKey(""));
              }}
            >
              <input
                className="rp-input rp-mono"
                type="password"
                autoComplete="off"
                aria-label="Anthropic API key"
                placeholder={w.aiKeyHint ?? "sk-ant-…"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button type="submit" className="rp-btn" disabled={!key.trim()}>
                Save
              </button>
            </form>
          </SettingRow>
        ) : null}
        <SettingRow
          label="Slack escalation"
          desc={
            w.slackConnected
              ? `1★ reviews post to ${w.slackChannel ?? "your Slack channel"} when Escalate is on.`
              : "Add an incoming webhook so 1★ reviews reach your team."
          }
        >
          <form
            style={{ display: "flex", gap: 8, flex: "1 1 360px", flexWrap: "wrap" }}
            onSubmit={(e) => {
              e.preventDefault();
              run(
                {
                  ...(hook.trim() ? { slackWebhook: hook.trim() } : {}),
                  slackChannel: channel.trim() || null,
                },
                "Slack saved",
                () => setHook(""),
              );
            }}
          >
            <input
              className="rp-input rp-mono"
              aria-label="Slack webhook URL"
              placeholder={
                w.slackConnected
                  ? "Webhook saved · paste to replace"
                  : "https://hooks.slack.com/services/…"
              }
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              style={{ flex: "1 1 220px", minWidth: 0 }}
            />
            <input
              className="rp-input rp-mono"
              aria-label="Slack channel"
              placeholder="#support"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              style={{ width: 120 }}
            />
            <button type="submit" className="rp-btn">
              Save
            </button>
            {w.slackConnected ? (
              <button
                type="button"
                className="rp-btn-light rp-btn-danger"
                onClick={() => run({ slackWebhook: null }, "Slack disconnected")}
              >
                Disconnect
              </button>
            ) : null}
          </form>
        </SettingRow>
      </div>
      {update.error ? <Banner tone="error">{errorMessage(update.error)}</Banner> : null}
    </Section>
  );
}

function RemoveApp({ app }: { app: PlayAppDetail }) {
  const remove = useRemovePlayApp();
  const router = useRouter();
  const toast = useToast();
  const [sure, setSure] = useState(false);
  return (
    <Section
      title="Remove app"
      desc="Stops syncing and deletes this app’s reviews, drafts and rules from Replyly. Replies already on Google Play stay."
    >
      <div style={{ display: "flex", gap: 8 }}>
        {sure ? (
          <>
            <button
              type="button"
              className="rp-btn"
              style={{ background: "#B42318" }}
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(app.id, {
                  onSuccess: () => {
                    toast(`${app.title} removed`);
                    router.push("/reviews");
                  },
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              Remove {app.title}
            </button>
            <button type="button" className="rp-btn-light" onClick={() => setSure(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="rp-btn-light rp-btn-danger"
            onClick={() => setSure(true)}
          >
            Remove app…
          </button>
        )}
      </div>
    </Section>
  );
}
