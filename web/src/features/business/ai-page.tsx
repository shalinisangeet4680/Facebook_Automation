"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  usePlayClients,
  usePlayWorkspace,
  useRevealPlayToken,
  useRevokePlayClient,
  useRotatePlayToken,
  useUpdateAutomationSettings,
} from "@/lib/api/queries";
import type { AgentPermissions, PlayMcpClient } from "@/lib/api/types";
import { copyText, useToast } from "@/features/replyly/ui";

import { agoShort, Logo, Modal, Notice, Skel, Switch } from "./ui";

import { BrandLogo, type BrandName } from "./brand-logos";

import "./ai.css";

type ClientId = "claude" | "cli" | "chatgpt" | "cursor" | "vscode" | "other";

type Step = { text: string; code?: string };

type ClientDef = {
  id: ClientId;
  name: string;
  logo: BrandName;
  bg: string;
  fg: string;
  token: boolean;
};

const SERVER = "treevook";

const CLIENTS: ClientDef[] = [
  { id: "claude", name: "Claude", logo: "claude", bg: "#D97757", fg: "#fff", token: false },
  { id: "cli", name: "Claude Code", logo: "claude", bg: "#2B2A27", fg: "#D97757", token: false },
  { id: "chatgpt", name: "ChatGPT", logo: "openai", bg: "#111110", fg: "#fff", token: false },
  { id: "cursor", name: "Cursor", logo: "cursor", bg: "#ECECE8", fg: "#111110", token: true },
  { id: "vscode", name: "VS Code", logo: "vscode", bg: "#007ACC", fg: "#fff", token: true },
  { id: "other", name: "Other MCP client", logo: "mcp", bg: "#F2F2EE", fg: "#33332F", token: true },
];

function stepsFor(id: ClientId, url: string, token: string): Step[] {
  if (id === "claude")
    return [
      { text: "Open Claude (web, desktop or mobile) → Settings → Connectors" },
      { text: "Add custom connector, name it TreeVook and paste your URL", code: url },
      { text: "Choose Connect, sign in to TreeVook and allow access" },
    ];
  if (id === "cli")
    return [
      {
        text: "Run this in your terminal",
        code: `claude mcp add --transport http ${SERVER} ${url}`,
      },
      { text: "Run /mcp in Claude Code, pick treevook and sign in", code: "/mcp" },
    ];
  if (id === "chatgpt")
    return [
      {
        text: "Open ChatGPT → Settings → Apps & Connectors → Advanced settings and turn on Developer mode",
      },
      {
        text: "Create a connector named TreeVook with this MCP server URL and OAuth authentication",
        code: url,
      },
      { text: "Sign in to TreeVook and choose Allow" },
      { text: "In a chat, pick TreeVook from the + menu" },
    ];
  if (id === "cursor")
    return [
      { text: "Open ~/.cursor/mcp.json (Cursor → Settings → MCP → Add new global MCP server)" },
      {
        text: "Add this server",
        code: `{\n  "mcpServers": {\n    "${SERVER}": {\n      "url": "${url}",\n      "headers": { "Authorization": "Bearer ${token}" }\n    }\n  }\n}`,
      },
      { text: "Save the file and turn treevook on in Cursor’s MCP settings" },
    ];
  if (id === "vscode")
    return [
      { text: "Create .vscode/mcp.json in your project" },
      {
        text: "Add this server",
        code: `{\n  "servers": {\n    "${SERVER}": {\n      "type": "http",\n      "url": "${url}",\n      "headers": { "Authorization": "Bearer ${token}" }\n    }\n  }\n}`,
      },
      { text: "Start treevook from the file, or with MCP: List Servers in the Command Palette" },
    ];
  return [
    { text: "Open your MCP client’s config file" },
    {
      text: "Add this server. It runs over stdio through mcp-remote",
      code: `{\n  "mcpServers": {\n    "${SERVER}": {\n      "command": "npx",\n      "args": [\n        "-y", "mcp-remote", "${url}",\n        "--header", "Authorization: Bearer ${token}"\n      ]\n    }\n  }\n}`,
    },
    { text: "Restart the client so it picks up the server" },
  ];
}

function matchOauth(name: string): ClientId {
  const n = name.toLowerCase();
  if (n.includes("claude code")) return "cli";
  if (n.includes("claude")) return "claude";
  if (n.includes("chatgpt") || n.includes("openai")) return "chatgpt";
  if (n.includes("cursor")) return "cursor";
  if (n.includes("vs code") || n.includes("vscode") || n.includes("visual studio")) return "vscode";
  return "other";
}

function matchesFor(id: ClientId, clients: PlayMcpClient[]) {
  return clients.filter((c) =>
    c.kind === "token"
      ? Boolean(c.lastUsedAt) && CLIENTS.find((d) => d.id === id)!.token
      : matchOauth(c.name) === id,
  );
}

function usedLabel(list: PlayMcpClient[]) {
  const last = list
    .map((c) => c.lastUsedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const viaToken = list.some((c) => c.kind === "token") && list.every((c) => c.kind === "token");
  const a = last ? agoShort(last) : "";
  const used = last ? (a === "now" ? "used just now" : `used ${a} ago`) : "not used yet";
  return viaToken ? `Access token · ${used}` : `Connected · ${used}`;
}

function Mark({
  c,
  size,
  radius,
  font,
}: {
  c: ClientDef;
  size: number;
  radius: number;
  font: number;
}) {
  return (
    <span
      className="gb-ai-mark"
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: c.bg,
        color: c.fg,
        fontSize: font,
      }}
    >
      <BrandLogo name={c.logo} size={Math.round(size * 0.56)} />
    </span>
  );
}

function CodeBlock({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <button type="button" className="gb-ai-code" onClick={onCopy} aria-label="Copy code">
      <span className="gb-ai-code-text">{code}</span>
      <span className="gb-ai-code-copy" aria-hidden>
        Copy
      </span>
    </button>
  );
}

function ConnectModal({
  c,
  url,
  matches,
  hasToken,
  onClose,
  onDone,
}: {
  c: ClientDef;
  url: string;
  matches: PlayMcpClient[];
  hasToken: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const reveal = useRevealPlayToken();
  const rotate = useRotatePlayToken();
  const revoke = useRevokePlayClient();
  const clients = usePlayClients();
  const [token, setToken] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const on = matches.length > 0;
  const showSteps = !on || setup;
  const tokenText = token ?? "YOUR_ACCESS_TOKEN";
  const steps = stepsFor(c.id, url, tokenText);
  const fail = (err: unknown) => toast(errorMessage(err));

  async function fullToken() {
    if (token) return token;
    const t = (await reveal.mutateAsync()).token;
    setToken(t);
    return t;
  }

  function copyStep(i: number) {
    const ready = c.token ? fullToken() : Promise.resolve(tokenText);
    ready
      .then((t) => copyText(stepsFor(c.id, url, t)[i]!.code ?? ""))
      .then(() => toast("Copied"))
      .catch(fail);
  }

  return (
    <Modal onClose={onClose} label={on ? c.name : `Connect ${c.name}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Mark c={c} size={44} radius={12} font={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{on ? c.name : `Connect ${c.name}`}</div>
          <div style={{ fontSize: 12, color: on ? "var(--gb-green)" : "var(--gb-faint)" }}>
            {on ? usedLabel(matches) : `${steps.length} quick steps`}
          </div>
        </div>
        <button type="button" className="gb-icon-btn" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      {showSteps ? (
        <>
          {c.token ? (
            <div className="gb-ai-token">
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12, color: "var(--gb-muted)" }}>
                  Access token
                </span>
                <span className="gb-ai-mono" style={{ display: "block", overflowWrap: "anywhere" }}>
                  {token ?? (hasToken ? "Hidden · reveal to fill it in below" : "Not created yet")}
                </span>
              </span>
              {token ? null : (
                <button
                  type="button"
                  className="gb-btn gb-ai-sm"
                  disabled={reveal.isPending}
                  onClick={() => void fullToken().catch(fail)}
                >
                  {reveal.isPending ? "…" : hasToken ? "Reveal" : "Create"}
                </button>
              )}
              {hasToken || token ? (
                <button
                  type="button"
                  className="gb-btn gb-ai-sm"
                  disabled={rotate.isPending}
                  onClick={() =>
                    rotate.mutate(undefined, {
                      onSuccess: (r) => {
                        setToken(r.token);
                        toast("Token rotated. The old one stops working in 10 min.");
                      },
                      onError: fail,
                    })
                  }
                >
                  Rotate
                </button>
              ) : null}
            </div>
          ) : null}
          <ol className="gb-ai-steps">
            {steps.map((s, i) => (
              <li key={i}>
                <span className="gb-ai-n" aria-hidden>
                  {i + 1}
                </span>
                <div className="gb-ai-step">
                  <span style={{ fontSize: 14, color: "var(--gb-ink)" }}>{s.text}</span>
                  {s.code ? <CodeBlock code={s.code} onCopy={() => copyStep(i)} /> : null}
                </div>
              </li>
            ))}
          </ol>
          {c.token ? (
            <span style={{ fontSize: 12, color: "var(--gb-faint)" }}>
              Cursor, VS Code and other token clients share one access token. It shows as connected
              after its first call.
            </span>
          ) : null}
          <button
            type="button"
            className="gb-btn gb-btn-green gb-ai-done"
            disabled={clients.isFetching}
            onClick={onDone}
          >
            {clients.isFetching ? `Checking for ${c.name}…` : "I’ve done this"}
          </button>
        </>
      ) : (
        <>
          <div className="gb-ai-try">
            <span className="gb-ai-try-label">TRY ASKING</span>
            <span style={{ fontSize: 14 }}>“Draft replies for my 1–3 star reviews”</span>
            <span style={{ fontSize: 14 }}>“How did our ratings change this month?”</span>
            <span style={{ fontSize: 14 }}>“Post this week’s offer to every location”</span>
          </div>
          {matches.some((m) => m.kind === "token") ? (
            <span style={{ fontSize: 12, color: "var(--gb-faint)" }}>
              Disconnecting revokes the shared access token, so Cursor, VS Code and other token
              clients all stop working.
            </span>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                className="gb-btn gb-ai-disconnect"
                disabled={revoke.isPending}
                onClick={() =>
                  revoke.mutate(m.id, {
                    onSuccess: () => {
                      void clients.refetch();
                      toast(`${matches.length > 1 ? m.name : c.name} disconnected`);
                      if (matches.length === 1) onClose();
                    },
                    onError: fail,
                  })
                }
              >
                {matches.length > 1
                  ? `Disconnect ${m.kind === "token" ? "access token" : m.name}`
                  : "Disconnect"}
              </button>
            ))}
            <button
              type="button"
              className="gb-link"
              style={{ alignSelf: "center" }}
              onClick={() => setSetup(true)}
            >
              Show setup steps
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

const PERMISSIONS: {
  key: keyof AgentPermissions;
  label: string;
  sub: string;
}[] = [
  {
    key: "gbpDrafts",
    label: "Draft replies",
    sub: "Saves reply drafts in your inbox for approval",
  },
  {
    key: "gbpPosts",
    label: "Create & schedule posts",
    sub: "Drafts save directly; publishing asks you to confirm",
  },
  {
    key: "gbpInfo",
    label: "Edit business info",
    sub: "Name, description, phone, website and hours. Asks you to confirm",
  },
  {
    key: "gbpReplySettings",
    label: "Change reply settings",
    sub: "Reply modes, templates, voice and safeguards. Asks you to confirm",
  },
  {
    key: "gbpProfiles",
    label: "Create & verify profiles",
    sub: "New Business Profiles and Google verification. Asks you to confirm",
  },
];

export function BusinessAiPage() {
  const toast = useToast();
  const ws = usePlayWorkspace();
  const clients = usePlayClients();
  const update = useUpdateAutomationSettings();
  const [open, setOpen] = useState<ClientId | null>(null);
  const [copied, setCopied] = useState(false);
  const url = ws.data?.mcpUrl ?? "";
  const list = clients.data?.data ?? [];
  const hasToken = list.some((c) => c.kind === "token") || Boolean(ws.data?.token);
  const current = open ? CLIENTS.find((c) => c.id === open)! : null;

  function done(c: ClientDef) {
    void clients.refetch().then((r) => {
      const found = matchesFor(c.id, r.data?.data ?? []).length > 0;
      setOpen(null);
      toast(
        found ? `${c.name} connected` : `${c.name} shows here after its first call to TreeVook`,
      );
    });
  }

  return (
    <div className="gb-narrow gb-pop" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {ws.error ? <Notice tone="error">{errorMessage(ws.error)}</Notice> : null}
      <div className="gb-card" style={{ overflow: "hidden" }}>
        <div className="gb-ai-hero">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }} aria-hidden>
            <Logo size={36} />
            <span className="gb-ai-dash" />
            <span style={{ display: "flex", paddingLeft: 8 }}>
              {CLIENTS.slice(0, 4).map((c) => (
                <span
                  key={c.id}
                  className="gb-ai-mark gb-ai-stack"
                  style={{ background: c.bg, color: c.fg }}
                >
                  <BrandLogo name={c.logo} size={16} />
                </span>
              ))}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Use TreeVook from your AI</span>
            <span style={{ fontSize: 13, color: "var(--gb-faint)" }}>
              “Reply to today’s reviews” — done.
            </span>
          </div>
        </div>
        <div className="gb-ai-url">
          <span style={{ fontSize: 13, color: "var(--gb-muted)", whiteSpace: "nowrap" }}>
            Server URL
          </span>
          {ws.isPending ? (
            <span style={{ flex: 1 }}>
              <Skel h={34} r={7} />
            </span>
          ) : (
            <span className="gb-ai-url-box" title={url}>
              {url}
            </span>
          )}
          <button
            type="button"
            className="gb-btn gb-btn-dark gb-ai-sm"
            disabled={!url}
            onClick={() =>
              void copyText(url).then(() => {
                setCopied(true);
                toast("Copied");
                setTimeout(() => setCopied(false), 1500);
              })
            }
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="gb-card" style={{ overflow: "hidden" }}>
        {clients.isPending ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <Skel h={36} />
            <Skel h={36} />
            <Skel h={36} />
          </div>
        ) : (
          CLIENTS.map((c) => {
            const m = matchesFor(c.id, list);
            const on = m.length > 0;
            return (
              <button
                key={c.id}
                type="button"
                className="gb-ai-client"
                onClick={() => setOpen(c.id)}
              >
                <Mark c={c} size={36} radius={10} font={12} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="gb-ai-client-name">{c.name}</span>
                  <span
                    className="gb-ai-client-sub"
                    style={{ color: on ? "var(--gb-green)" : "var(--gb-faint)" }}
                  >
                    <span
                      className="gb-dot"
                      style={{ background: on ? "var(--gb-green)" : "#D5D5CE" }}
                      aria-hidden
                    />
                    {on ? usedLabel(m) : "Not connected"}
                  </span>
                </span>
                <span className={on ? "gb-ai-pill" : "gb-ai-pill gb-ai-pill-dark"}>
                  {on ? "Manage" : "Connect"}
                </span>
              </button>
            );
          })
        )}
        {clients.error ? (
          <div style={{ padding: 16 }}>
            <Notice tone="error">{errorMessage(clients.error)}</Notice>
          </div>
        ) : null}
      </div>

      <div className="gb-card" style={{ overflow: "hidden" }}>
        <div className="gb-ai-perm-head">What AI can do</div>
        <div className="gb-ai-perm">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>Read reviews & stats</div>
            <div className="gb-faint">Locations, reviews, insights and sync. Always on</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked
            aria-disabled
            aria-label="Read reviews & stats"
            className="gb-switch"
            style={{ opacity: 0.5, cursor: "default" }}
            onClick={() => toast("Needed for AI to help")}
          />
        </div>
        <div className="gb-ai-perm">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>Send replies on Google</div>
            <div className="gb-faint">
              {ws.data?.agentsCanPost
                ? "Follows each location’s reply mode. Shared with Play Reviews and Autopost"
                : "Off: replies wait as drafts for your approval"}
            </div>
          </div>
          {ws.isPending ? (
            <Skel h={20} w={36} />
          ) : (
            <Switch
              on={Boolean(ws.data?.agentsCanPost)}
              label="Send replies on Google"
              disabled={update.isPending || !ws.data}
              onChange={(next) =>
                update.mutate(
                  { agentsCanPost: next },
                  {
                    onSuccess: () => toast(next ? "AI can send replies" : "AI can only draft"),
                    onError: (err) => toast(errorMessage(err)),
                  },
                )
              }
            />
          )}
        </div>
        {PERMISSIONS.map((p) => (
          <div key={p.key} className="gb-ai-perm">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>{p.label}</div>
              <div className="gb-faint">{p.sub}</div>
            </div>
            {ws.isPending || !ws.data ? (
              <Skel h={20} w={36} />
            ) : (
              <Switch
                on={ws.data.agentPermissions[p.key]}
                label={p.label}
                disabled={update.isPending}
                onChange={(next) =>
                  update.mutate(
                    { agentPermissions: { [p.key]: next } },
                    {
                      onSuccess: () => toast(`${p.label}: ${next ? "on" : "off"}`),
                      onError: (err) => toast(errorMessage(err)),
                    },
                  )
                }
              />
            )}
          </div>
        ))}
      </div>

      {current ? (
        <ConnectModal
          key={current.id}
          c={current}
          url={url}
          matches={matchesFor(current.id, list)}
          hasToken={hasToken}
          onClose={() => setOpen(null)}
          onDone={() => done(current)}
        />
      ) : null}
    </div>
  );
}
