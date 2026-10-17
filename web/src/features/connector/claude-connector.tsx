"use client";

import { Check, Copy, Hand, ShieldCheck, Terminal, Unplug, Wallet } from "lucide-react";
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useConnectedApps, useConnector, useDisconnectApp, useMetaAssets } from "@/lib/api/queries";
import type { ConnectedApp } from "@/lib/api/types";
import { BRAND } from "@/lib/config";
import { ConfirmDialog } from "@/features/replyly/dialog";
import { Banner, copyText, PageHead, Skel, useToast } from "@/features/replyly/ui";

const MUTED = "#6C6962";
const DIVIDER = "1px solid #EFEDE8";

const PROMPTS = [
  "How did my ads do in the last 7 days? What should I change?",
  "Is my Pixel tracking leads correctly?",
  "Which ad has the lowest cost per lead this month, and why?",
  "Draft a paused leads campaign for clinic owners in Patna at ₹500 a day.",
];

const APP_STEPS = [
  "Open Claude and go to Settings → Connectors.",
  "Choose Add custom connector.",
  `Name it ${BRAND.name}, paste the connector URL and select Add.`,
  `Select Connect, sign in here and choose Allow.`,
  `In a chat, open the tools menu and turn on ${BRAND.name}.`,
];

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

function CopyButton({
  value,
  label = "Copy",
  done = "Copied",
  ariaLabel,
  dark,
}: {
  value: string;
  label?: string;
  done?: string;
  ariaLabel?: string;
  dark?: boolean;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  const darkStyle: CSSProperties = {
    border: "1px solid #3A3935",
    background: "transparent",
    color: "#E9E7E1",
  };
  return (
    <button
      type="button"
      className={dark ? undefined : "rp-btn-light"}
      aria-label={ariaLabel}
      onClick={() =>
        void copyText(value).then((ok) => {
          if (ok) {
            setCopied(true);
            toast(done);
          } else toast("Couldn’t copy. Select the text and copy it instead.");
        })
      }
      style={{
        padding: "6px 12px",
        fontSize: 12.5,
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        flexShrink: 0,
        whiteSpace: "nowrap",
        ...(dark ? darkStyle : {}),
      }}
    >
      {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

function Panel({
  title,
  desc,
  icon,
  children,
  style,
}: {
  title: string;
  desc?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, ...style }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2
          id={headingId}
          style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}
        >
          {icon}
          {title}
        </h2>
        {desc ? <span style={{ fontSize: 13, color: MUTED }}>{desc}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function ClaudeConnector() {
  const connector = useConnector();
  const assets = useMetaAssets();
  const currency =
    (assets.data?.data.find((a) => a.kind === "ad_account" && a.isPrimary)?.details.currency as
      string | undefined) ?? "INR";
  const command = connector.data
    ? `claude mcp add --transport http autopilot ${connector.data.mcpUrl}`
    : "";

  return (
    <div
      className="rp-in"
      style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 900 }}
    >
      <PageHead
        title="Use with Claude"
        sub="Use TreeVook from Claude on your own Claude plan: plan ads, reply to reviews, schedule posts. Claude prepares changes; nothing goes live or spends money until you say yes."
      />

      <Panel title="Connector URL" desc="Paste this into Claude when you add a custom connector.">
        {connector.isPending ? (
          <Skel h={50} r={14} />
        ) : connector.isError ? (
          <Banner
            tone="error"
            title="Couldn’t load the connector URL"
            action={
              <button
                type="button"
                className="rp-btn-light"
                onClick={() => void connector.refetch()}
              >
                Try again
              </button>
            }
          >
            {errorMessage(connector.error)}
          </Banner>
        ) : (
          <div
            className="rp-card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 14px 12px 16px",
              flexWrap: "wrap",
            }}
          >
            <code
              className="rp-mono"
              style={{ fontSize: 13, overflowWrap: "anywhere", minWidth: 0, flex: "1 1 220px" }}
            >
              {connector.data.mcpUrl}
            </code>
            <CopyButton
              value={connector.data.mcpUrl}
              label="Copy URL"
              done="Connector URL copied"
            />
          </div>
        )}
      </Panel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        <Panel title="Claude on web, desktop or mobile">
          <ol className="rp-card" style={{ margin: 0, padding: 0, listStyle: "none", flex: 1 }}>
            {APP_STEPS.map((step, i) => (
              <li
                key={step}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  padding: "12px 16px",
                  borderTop: i ? DIVIDER : "none",
                  fontSize: 13.5,
                  lineHeight: 1.45,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11.5,
                    fontFamily: "var(--rp-mono)",
                    background: "#EAF3EE",
                    color: "#0F6B4A",
                  }}
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          title="Claude Code"
          icon={<Terminal size={15} aria-hidden />}
          desc="Run this in your terminal, then type /mcp in Claude Code to sign in."
        >
          {connector.data ? (
            <div
              style={{
                borderRadius: 12,
                background: "#191917",
                color: "#E9E7E1",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <code
                className="rp-mono"
                style={{ fontSize: 12.5, lineHeight: 1.6, overflowWrap: "anywhere" }}
              >
                {command}
              </code>
              <div style={{ alignSelf: "flex-end" }}>
                <CopyButton dark value={command} label="Copy command" done="Command copied" />
              </div>
            </div>
          ) : (
            <Skel h={96} r={12} />
          )}
        </Panel>
      </div>

      <Panel title="Try asking">
        <ul className="rp-card" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {PROMPTS.map((prompt, i) => (
            <li
              key={prompt}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px 10px 16px",
                borderTop: i ? DIVIDER : "none",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13.5, flex: "1 1 220px", minWidth: 0 }}>{prompt}</span>
              <CopyButton
                value={prompt}
                done="Prompt copied"
                ariaLabel={`Copy prompt: ${prompt}`}
              />
            </li>
          ))}
        </ul>
      </Panel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <ConnectedApps />
        <Panel title="Built-in safety">
          <div className="rp-card">
            <Guard first icon={<Hand size={15} />} title="New campaigns start paused">
              Claude can build campaigns, but they stay off until you turn them on.
            </Guard>
            <Guard icon={<ShieldCheck size={15} />} title="You confirm every launch">
              Turning ads on or changing a budget shows you a summary in the chat first.
            </Guard>
            <Guard icon={<Wallet size={15} />} title="Daily budget limit">
              {connector.data
                ? `Up to ${new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(connector.data.maxDailyBudget)} per campaign or ad set per day.`
                : "A daily limit applies to every campaign and ad set."}
            </Guard>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Guard({
  icon,
  title,
  children,
  first,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 16px",
        borderTop: first ? "none" : DIVIDER,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#EAF3EE",
          color: "#0F6B4A",
        }}
      >
        {icon}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontWeight: 500, fontSize: 13.5 }}>{title}</span>
        <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>{children}</span>
      </div>
    </div>
  );
}

function ConnectedApps() {
  const apps = useConnectedApps();
  return (
    <Panel title="Connected apps">
      {apps.isPending ? (
        <div
          className="rp-card"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <Skel h={36} />
          <Skel h={36} />
        </div>
      ) : apps.isError ? (
        <Banner
          tone="error"
          title="Couldn’t load connected apps"
          action={
            <button type="button" className="rp-btn-light" onClick={() => void apps.refetch()}>
              Try again
            </button>
          }
        >
          {errorMessage(apps.error)}
        </Banner>
      ) : apps.data.data.length === 0 ? (
        <div
          className="rp-card"
          style={{
            padding: "26px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            textAlign: "center",
          }}
        >
          <span className="rp-serif" style={{ fontSize: 22 }}>
            Nothing connected yet
          </span>
          <span style={{ fontSize: 13, color: MUTED }}>
            After you approve Claude, it shows up here.
          </span>
        </div>
      ) : (
        <ul className="rp-card" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {apps.data.data.map((app, i) => (
            <AppRow key={app.id} app={app} first={i === 0} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function AppRow({ app, first }: { app: ConnectedApp; first: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const disconnect = useDisconnectApp();
  const canWrite = app.scopes.includes("ads:write");
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px 12px 16px",
        borderTop: first ? "none" : DIVIDER,
        flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4F2EE",
          border: "1px solid #E6E4DF",
          fontWeight: 600,
        }}
      >
        {app.name.slice(0, 1).toUpperCase()}
      </span>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 160px", minWidth: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 500, fontSize: 13.5, overflowWrap: "anywhere" }}>
            {app.name}
          </span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 500,
              background: canWrite ? "#EAF3EE" : "#EFEDE8",
              color: canWrite ? "#0F6B4A" : "#55534E",
              whiteSpace: "nowrap",
            }}
          >
            {canWrite ? "Read and changes" : "Read only"}
          </span>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>
          {app.lastUsedAt
            ? `Last used ${dateTime.format(new Date(app.lastUsedAt))}`
            : `Connected ${dateTime.format(new Date(app.connectedAt))}`}
        </span>
      </div>
      <button
        type="button"
        className="rp-btn-light rp-btn-danger"
        style={{ padding: "6px 12px", fontSize: 12.5 }}
        onClick={() => setOpen(true)}
      >
        <Unplug size={13} aria-hidden /> Disconnect
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Disconnect ${app.name}?`}
        description={`${app.name} loses access right away. You can connect it again from Claude at any time.`}
        confirm="Disconnect"
        danger
        pending={disconnect.isPending}
        onConfirm={() =>
          disconnect.mutate(app.id, {
            onSuccess: () => {
              setOpen(false);
              toast(`${app.name} disconnected`);
            },
            onError: (err) => toast(errorMessage(err)),
          })
        }
      />
    </li>
  );
}
