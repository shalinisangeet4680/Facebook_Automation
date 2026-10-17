"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RadioGroup } from "radix-ui";
import { useId, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  useAutomationSettings,
  useConnectedApps,
  useMe,
  useMetaConnection,
  useSettings,
  useSignOutEverywhere,
  useUpdateAutomationSettings,
  useUpdateProfile,
  useUpdateWorkspace,
} from "@/lib/api/queries";
import type { AutomationSettings, AutomationSettingsUpdate, Settings } from "@/lib/api/types";
import { ConfirmDialog } from "@/features/replyly/dialog";
import {
  Banner,
  PageHead,
  SettingRow,
  Skel,
  Spinner,
  Toggle,
  useToast,
} from "@/features/replyly/ui";

const MUTED = "#6C6962";
const DIVIDER = "1px solid #EFEDE8";

const PILLS = {
  good: { bg: "#EAF3EE", fg: "#0F6B4A" },
  bad: { bg: "#FDF0EE", fg: "#B42318" },
  off: { bg: "#EFEDE8", fg: "#55534E" },
};

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

function Pill({ tone, children }: { tone: keyof typeof PILLS; children: ReactNode }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        background: PILLS[tone].bg,
        color: PILLS[tone].fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Panel({
  id,
  title,
  desc,
  children,
}: {
  id?: string;
  title: string;
  desc?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      style={{ display: "flex", flexDirection: "column", gap: 12, scrollMarginTop: 24 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 id={headingId} style={{ fontWeight: 600, fontSize: 15 }}>
          {title}
        </h2>
        {desc ? <span style={{ fontSize: 13, color: MUTED }}>{desc}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
  style,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
  style?: CSSProperties;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...style }}>
      <label htmlFor={id} style={{ fontSize: 12.5, fontWeight: 500, color: "#55534E" }}>
        {label}
      </label>
      {children({
        id,
        "aria-describedby": note ? noteId : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {note ? (
        <span
          id={noteId}
          style={{ fontSize: 12, color: error ? "#B42318" : MUTED, lineHeight: 1.45 }}
        >
          {note}
        </span>
      ) : null}
    </div>
  );
}

const INPUT: CSSProperties = { width: "100%", padding: "9px 11px", fontSize: 13.5 };

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

export function SettingsPage() {
  const settings = useSettings();
  return (
    <div
      className="rp-in"
      style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 860 }}
    >
      <PageHead
        title="Settings"
        sub="Your workspace, spending guardrails, AI, profile and connections."
      />
      {settings.isPending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skel h={260} r={14} />
          <Skel h={140} r={14} />
        </div>
      ) : settings.isError ? (
        <Banner
          tone="error"
          title="Couldn’t load settings"
          action={
            <button type="button" className="rp-btn-light" onClick={() => void settings.refetch()}>
              Try again
            </button>
          }
        >
          {errorMessage(settings.error)}
        </Banner>
      ) : (
        <>
          <WorkspaceForm
            key={JSON.stringify([settings.data.workspace, settings.data.budget])}
            settings={settings.data}
          />
          <Connections />
          <AutomationSection />
          <Security />
          <ProfileForm key={JSON.stringify(settings.data.profile)} settings={settings.data} />
        </>
      )}
    </div>
  );
}

function WorkspaceForm({ settings }: { settings: Settings }) {
  const toast = useToast();
  const update = useUpdateWorkspace();
  const { budget } = settings;
  const [name, setName] = useState(settings.workspace.name);
  const [maxDaily, setMaxDaily] = useState(String(budget.maxDailyBudget));
  const [monthly, setMonthly] = useState(
    budget.monthlyBudget === null ? "" : String(budget.monthlyBudget),
  );
  const [target, setTarget] = useState(
    budget.targetCostPerResult === null ? "" : String(budget.targetCostPerResult),
  );

  const maxDailyValue = Number(maxDaily);
  const monthlyValue = optionalNumber(monthly);
  const targetValue = optionalNumber(target);
  const errors = {
    name: name.trim().length < 2 ? "Use at least 2 characters." : null,
    maxDaily:
      !Number.isFinite(maxDailyValue) || maxDailyValue <= 0
        ? "Enter an amount."
        : maxDailyValue > budget.platformMaxDailyBudget
          ? `The most allowed is ${money(budget.platformMaxDailyBudget, budget.currency)}.`
          : null,
    monthly:
      monthlyValue === null
        ? null
        : Number.isNaN(monthlyValue) || monthlyValue <= 0
          ? "Enter an amount or leave it empty."
          : monthlyValue < maxDailyValue
            ? "Should be at least the daily limit."
            : null,
    target:
      targetValue === null
        ? null
        : Number.isNaN(targetValue) || targetValue <= 0
          ? "Enter an amount or leave it empty."
          : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const dirty =
    name !== settings.workspace.name ||
    maxDailyValue !== budget.maxDailyBudget ||
    monthlyValue !== budget.monthlyBudget ||
    targetValue !== budget.targetCostPerResult;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    update.mutate(
      {
        name: name.trim(),
        maxDailyBudget: maxDailyValue,
        monthlyBudget: monthlyValue,
        targetCostPerResult: targetValue,
      },
      {
        onSuccess: () => toast("Settings saved"),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  return (
    <Panel
      title="Workspace and budget"
      desc="These limits apply everywhere: in TreeVook, in Claude and in suggestions."
    >
      <form
        onSubmit={submit}
        noValidate
        className="rp-card"
        style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}
      >
        <Field label="Workspace name" error={errors.name} style={{ maxWidth: 420 }}>
          {(p) => (
            <input
              {...p}
              className="rp-input"
              style={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="organization"
            />
          )}
        </Field>
        <div style={{ ...GRID, paddingTop: 18, borderTop: DIVIDER }}>
          <Field
            label={`Daily limit per campaign (${budget.currency})`}
            error={errors.maxDaily}
            hint={`Nothing can be set above this. Platform maximum ${money(budget.platformMaxDailyBudget, budget.currency)}.`}
          >
            {(p) => (
              <input
                {...p}
                className="rp-input"
                style={INPUT}
                type="number"
                inputMode="decimal"
                min={1}
                value={maxDaily}
                onChange={(e) => setMaxDaily(e.target.value)}
              />
            )}
          </Field>
          <Field
            label={`Monthly ad budget (${budget.currency})`}
            error={errors.monthly}
            hint="Optional. Used for pacing alerts."
          >
            {(p) => (
              <input
                {...p}
                className="rp-input"
                style={INPUT}
                type="number"
                inputMode="decimal"
                min={1}
                placeholder="No monthly budget"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
              />
            )}
          </Field>
          <Field
            label={`Target cost per result (${budget.currency})`}
            error={errors.target}
            hint="Optional. What a lead or sign-up is worth paying. Suggestions compare against it."
          >
            {(p) => (
              <input
                {...p}
                className="rp-input"
                style={INPUT}
                type="number"
                inputMode="decimal"
                min={1}
                placeholder="Use account average"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className="rp-btn" disabled={!dirty || invalid || update.isPending}>
            {update.isPending ? <Spinner /> : null}
            Save changes
          </button>
        </div>
      </form>
    </Panel>
  );
}

function ConnectionRow({
  first,
  name,
  status,
  pill,
  href,
  action,
}: {
  first?: boolean;
  name: string;
  status: ReactNode;
  pill?: ReactNode;
  href: string;
  action: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderTop: first ? "none" : DIVIDER,
        flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4F2EE",
          border: "1px solid #E6E4DF",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {name.slice(0, 1)}
      </span>
      <span
        style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 180px", minWidth: 0 }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 500, fontSize: 13.5 }}>{name}</span>
          {pill}
        </span>
        <span style={{ fontSize: 12.5, color: MUTED, overflowWrap: "anywhere" }}>{status}</span>
      </span>
      <Link
        href={href}
        className="rp-btn-light"
        style={{ padding: "6px 12px", fontSize: 12.5 }}
        aria-label={`${action} ${name} connection`}
      >
        {action}
      </Link>
    </div>
  );
}

function Connections() {
  const meta = useMetaConnection();
  const apps = useConnectedApps();
  const metaState = meta.data?.status;
  const count = apps.data?.data.length ?? 0;
  return (
    <Panel title="Connections">
      <div className="rp-card">
        <ConnectionRow
          first
          name="Meta"
          href="/setup/connect-meta"
          action={metaState === "active" || metaState === "invalid" ? "Manage" : "Connect"}
          status={
            metaState === "active"
              ? `Connected as ${meta.data?.systemUser?.name ?? "system user"}`
              : metaState === "invalid"
                ? "Token stopped working"
                : meta.isPending
                  ? "Checking…"
                  : "Not connected"
          }
          pill={
            meta.data ? (
              <Pill
                tone={metaState === "active" ? "good" : metaState === "invalid" ? "bad" : "off"}
              >
                {metaState === "active"
                  ? "Active"
                  : metaState === "invalid"
                    ? "Needs attention"
                    : "Off"}
              </Pill>
            ) : null
          }
        />
        <ConnectionRow
          name="Claude"
          href="/claude"
          action="Manage"
          status={
            apps.data
              ? `${count} connected app${count === 1 ? "" : "s"}`
              : apps.isError
                ? "Couldn’t check connected apps"
                : "Checking…"
          }
          pill={
            apps.data ? <Pill tone={count ? "good" : "off"}>{count ? "Active" : "Off"}</Pill> : null
          }
        />
      </div>
    </Panel>
  );
}

const AI_MODES: [AutomationSettings["aiMode"], string, string][] = [
  ["platform", "TreeVook AI", "Included, with a daily limit"],
  ["own", "My Anthropic key", "Billed to your Anthropic account"],
  ["off", "Off", "Templates as written"],
];

function aiSummary(a: AutomationSettings) {
  if (a.aiMode === "off")
    return "Drafts use your templates as written. AI-written ratings wait for Claude through the connector.";
  if (a.aiMode === "own")
    return a.aiKeyHint
      ? `Drafts use your Anthropic key (${a.aiKeyHint}) with ${a.model}.`
      : "Add your Anthropic key below to start drafting with AI.";
  if (!a.platformAi)
    return "TreeVook AI isn’t set up on this server. Use your own key, or draft through the connector.";
  return `${a.draftsToday} of ${a.dailyDrafts} AI drafts used in the last 24 hours, across Play Reviews and Google Business, with ${a.model}.`;
}

function AutomationSection() {
  const automation = useAutomationSettings();
  return (
    <Panel
      id="ai"
      title="AI & automation"
      desc="Shared by Play Reviews, Google Business and every agent connected to this workspace."
    >
      {automation.isPending ? (
        <Skel h={300} r={14} />
      ) : automation.isError ? (
        <Banner
          tone="error"
          title="Couldn’t load AI settings"
          action={
            <button
              type="button"
              className="rp-btn-light"
              onClick={() => void automation.refetch()}
            >
              Try again
            </button>
          }
        >
          {errorMessage(automation.error)}
        </Banner>
      ) : (
        <AutomationForm key={automation.data.slackChannel ?? ""} settings={automation.data} />
      )}
    </Panel>
  );
}

function AutomationForm({ settings }: { settings: AutomationSettings }) {
  const toast = useToast();
  const update = useUpdateAutomationSettings();
  const modeLabel = useId();
  const [key, setKey] = useState("");
  const [hook, setHook] = useState("");
  const [channel, setChannel] = useState(settings.slackChannel ?? "");

  const save = (body: AutomationSettingsUpdate, message: string, after?: () => void) =>
    update.mutate(body, {
      onSuccess: () => {
        toast(message);
        after?.();
      },
      onError: (err) => toast(errorMessage(err)),
    });

  return (
    <div className="rp-card">
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <span id={modeLabel} style={{ fontWeight: 500, fontSize: 13.5 }}>
          AI drafting
        </span>
        <RadioGroup.Root
          aria-labelledby={modeLabel}
          value={settings.aiMode}
          disabled={update.isPending}
          onValueChange={(v) =>
            save({ aiMode: v as AutomationSettings["aiMode"] }, "AI drafting updated")
          }
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
          }}
        >
          {AI_MODES.map(([mode, title, description]) => {
            const on = settings.aiMode === mode;
            return (
              <RadioGroup.Item
                key={mode}
                value={mode}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 12,
                  border: `1.5px solid ${on ? "#191917" : "#E6E4DF"}`,
                  background: "#fff",
                  cursor: update.isPending ? "default" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  color: "#191917",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</span>
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      borderRadius: "50%",
                      boxSizing: "border-box",
                      border: `1.5px solid ${on ? "#191917" : "#C9C5BC"}`,
                      background: on ? "#191917" : "#fff",
                      boxShadow: on ? "inset 0 0 0 2.5px #fff" : "none",
                    }}
                  />
                </span>
                <span style={{ fontSize: 12.5, color: "#55534E" }}>{description}</span>
              </RadioGroup.Item>
            );
          })}
        </RadioGroup.Root>
        <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{aiSummary(settings)}</span>
        {settings.aiMode === "own" ? (
          <form
            noValidate
            style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (key.trim()) save({ aiKey: key.trim() }, "API key saved", () => setKey(""));
            }}
          >
            <Field
              label="Anthropic API key"
              hint="Stored encrypted. Only the last four characters are shown."
              style={{ flex: "1 1 240px" }}
            >
              {(p) => (
                <input
                  {...p}
                  className="rp-input"
                  style={INPUT}
                  type="password"
                  autoComplete="off"
                  placeholder={settings.aiKeyHint ?? "sk-ant-…"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              )}
            </Field>
            <button
              type="submit"
              className="rp-btn-light"
              style={{ marginBottom: 24 }}
              disabled={!key.trim() || update.isPending}
            >
              Save key
            </button>
          </form>
        ) : null}
      </div>
      <form
        noValidate
        style={{
          padding: 16,
          borderTop: DIVIDER,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
        onSubmit={(e) => {
          e.preventDefault();
          save(
            {
              ...(hook.trim() ? { slackWebhook: hook.trim() } : {}),
              slackChannel: channel.trim() || null,
            },
            "Slack saved",
            () => setHook(""),
          );
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontWeight: 500, fontSize: 13.5 }}>Slack escalation</span>
            <span style={{ fontSize: 12.5, color: MUTED }}>
              {settings.slackConnected
                ? `Low ratings post to ${settings.slackChannel ?? "your Slack channel"} when escalation is on for an app or business.`
                : "Add an incoming webhook so low ratings reach your team."}
            </span>
          </div>
          <Pill tone={settings.slackConnected ? "good" : "off"}>
            {settings.slackConnected ? "Connected" : "Off"}
          </Pill>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Field label="Incoming webhook URL" style={{ flex: "2 1 260px" }}>
            {(p) => (
              <input
                {...p}
                className="rp-input"
                style={INPUT}
                autoComplete="off"
                placeholder={
                  settings.slackConnected
                    ? "Saved · paste a new one to replace"
                    : "https://hooks.slack.com/services/…"
                }
                value={hook}
                onChange={(e) => setHook(e.target.value)}
              />
            )}
          </Field>
          <Field label="Channel" style={{ flex: "1 1 140px" }}>
            {(p) => (
              <input
                {...p}
                className="rp-input"
                style={INPUT}
                autoComplete="off"
                placeholder="#support"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          {settings.slackConnected ? (
            <button
              type="button"
              className="rp-btn-light rp-btn-danger"
              disabled={update.isPending}
              onClick={() => save({ slackWebhook: null }, "Slack disconnected")}
            >
              Disconnect
            </button>
          ) : null}
          <button
            type="submit"
            className="rp-btn-light"
            disabled={
              update.isPending || (!hook.trim() && channel.trim() === (settings.slackChannel ?? ""))
            }
          >
            Save Slack
          </button>
        </div>
      </form>
      <SettingRow
        label="Allow agents to post replies"
        desc="Off: Claude and other MCP agents can only create drafts that wait in your inbox."
      >
        <Toggle
          on={settings.agentsCanPost}
          label="Allow agents to post replies"
          disabled={update.isPending}
          onChange={() =>
            save(
              { agentsCanPost: !settings.agentsCanPost },
              settings.agentsCanPost ? "Agents can only draft" : "Agents can post replies",
            )
          }
        />
      </SettingRow>
    </div>
  );
}

function Security() {
  const router = useRouter();
  const toast = useToast();
  const signOut = useSignOutEverywhere();
  const [open, setOpen] = useState(false);
  return (
    <Panel title="Security">
      <div className="rp-card">
        <SettingRow
          first
          label="Sign out everywhere"
          desc="Sign out of TreeVook on every phone and computer, including this one. Claude connections are not affected."
        >
          <button type="button" className="rp-btn-light" onClick={() => setOpen(true)}>
            <LogOut size={14} aria-hidden /> Sign out everywhere
          </button>
        </SettingRow>
        <div style={{ padding: "12px 16px", borderTop: DIVIDER, fontSize: 12.5, color: MUTED }}>
          Budget limits above protect you even if someone gets access.
        </div>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sign out everywhere?"
        description="You’ll need to sign in with Google again on every device."
        confirm="Sign out everywhere"
        danger
        pending={signOut.isPending}
        onConfirm={() =>
          signOut.mutate(undefined, {
            onSuccess: () => router.replace("/login"),
            onError: (err) => toast(errorMessage(err)),
          })
        }
      />
    </Panel>
  );
}

function ProfileForm({ settings }: { settings: Settings }) {
  const toast = useToast();
  const me = useMe();
  const update = useUpdateProfile();
  const [name, setName] = useState(settings.profile.name ?? "");
  const dirty = name !== (settings.profile.name ?? "");
  const email = me.data?.user.email ?? settings.profile.email;
  const avatar = me.data?.user.avatarUrl;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(
      { name: name.trim() || null, email: settings.profile.email },
      {
        onSuccess: () => toast("Profile saved"),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  return (
    <Panel title="Your profile">
      <form onSubmit={submit} noValidate className="rp-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            flexWrap: "wrap",
          }}
        >
          {avatar ? (
            <Image
              unoptimized
              src={avatar}
              alt=""
              width={36}
              height={36}
              referrerPolicy="no-referrer"
              style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#EFEDE8",
                fontWeight: 600,
              }}
            >
              {(name || email || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              flex: "1 1 200px",
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 12, color: MUTED }}>Signed in with Google</span>
            <span style={{ fontWeight: 500, fontSize: 13.5, overflowWrap: "anywhere" }}>
              {email ?? "No Google account linked"}
            </span>
          </span>
        </div>
        <div
          style={{
            padding: 16,
            borderTop: DIVIDER,
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <Field label="Name" style={{ flex: "1 1 240px", maxWidth: 420 }}>
            {(p) => (
              <input
                {...p}
                className="rp-input"
                style={INPUT}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}
          </Field>
          <button
            type="submit"
            className="rp-btn"
            style={{ marginLeft: "auto" }}
            disabled={!dirty || update.isPending}
          >
            {update.isPending ? <Spinner /> : null}
            Save profile
          </button>
        </div>
      </form>
    </Panel>
  );
}
