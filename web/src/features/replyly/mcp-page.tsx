"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  usePlayClients,
  usePlayWorkspace,
  useRevealPlayToken,
  useRevokePlayClient,
  useRotatePlayToken,
  useUpdatePlayWorkspace,
} from "@/lib/api/queries";

import { ago, rowBorder } from "./tokens";
import { Banner, copyText, Seg, Skel, Toggle, useToast } from "./ui";

const TOOLS: [string, string][] = [
  ["list_play_apps", "Connected apps with rating and backlog"],
  ["list_play_reviews", "Filter by app, rating and status"],
  ["get_review_templates", "Your templates, voice and placeholder values"],
  ["draft_review_reply", "Draft using your templates and voice"],
  ["save_review_drafts", "Put drafts in your Inbox for approval"],
  ["send_review_reply", "Post a reply (requires permission above)"],
  ["get_review_analytics", "Ratings, reply rate, topics over time"],
  ["get_review_insights", "Per-app versions, languages and common words"],
  ["upsert_review_template", "Create or edit templates, in any language, with checks"],
  ["get_review_settings", "Read an app's modes, templates, behavior and safeguards"],
  ["update_review_settings", "Change any app setting (asks you to confirm)"],
  ["set_review_rules", "Replace advanced keyword rules (asks you to confirm)"],
  ["update_review_workspace", "AI drafting mode and Slack channel (asks you to confirm)"],
  ["sync_play_apps", "Fetch new reviews and newly shared apps"],
  ["import_review_history", "Import older months from Play Console reports"],
  ["delete_review_template", "Delete one of your templates (asks you to confirm)"],
];

type Client = "claude" | "cursor" | "cli";

function snippet(client: Client, url: string, token: string): [string, string] {
  if (client === "claude")
    return [
      "claude_desktop_config.json",
      `{\n  "mcpServers": {\n    "replyly": {\n      "command": "npx",\n      "args": [\n        "-y", "mcp-remote", "${url}",\n        "--header", "Authorization: Bearer ${token}"\n      ]\n    }\n  }\n}`,
    ];
  if (client === "cursor")
    return [
      ".cursor/mcp.json",
      `{\n  "mcpServers": {\n    "replyly": {\n      "url": "${url}",\n      "headers": { "Authorization": "Bearer ${token}" }\n    }\n  }\n}`,
    ];
  return [
    "terminal",
    `claude mcp add replyly \\\n  --transport http ${url} \\\n  --header "Authorization: Bearer ${token}"`,
  ];
}

export function McpPage() {
  const toast = useToast();
  const ws = usePlayWorkspace();
  const clients = usePlayClients();
  const reveal = useRevealPlayToken();
  const rotate = useRotatePlayToken();
  const revoke = useRevokePlayClient();
  const update = useUpdatePlayWorkspace();
  const [client, setClient] = useState<Client>("claude");
  const [token, setToken] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  const w = ws.data;
  const url = w?.mcpUrl ?? "";
  const masked = token ? `${token.slice(0, 8)}••••••••••${token.slice(-3)}` : (w?.token ?? null);
  const tokenText = shown && token ? token : (masked ?? "rk_live_••••••••••••••");
  const [file, code] = snippet(client, url, tokenText);

  async function fullToken() {
    if (token) return token;
    const t = (await reveal.mutateAsync()).token;
    setToken(t);
    return t;
  }

  const fail = (err: unknown) => toast(errorMessage(err));

  return (
    <div
      className="rp-in"
      style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 820 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          className="rp-mono"
          style={{ fontSize: 11.5, color: "#6C6962", letterSpacing: ".04em" }}
        >
          MODEL CONTEXT PROTOCOL
        </span>
        <h1 className="rp-serif" style={{ fontSize: 36, lineHeight: 1 }}>
          Reply from your <span style={{ fontStyle: "italic" }}>agent.</span>
        </h1>
        <span style={{ color: "#55534E", fontSize: 13.5, lineHeight: 1.55 }}>
          Connect Claude, Cursor or any MCP client. Ask “draft replies for today’s 1-star reviews”
          and approve in chat.
        </span>
      </div>
      {ws.error ? <Banner tone="error">{errorMessage(ws.error)}</Banner> : null}
      <div className="rp-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: "#6C6962" }}>Server URL</span>
            <span className="rp-mono" style={{ fontSize: 13, overflowWrap: "anywhere" }}>
              {url || "…"}
            </span>
          </div>
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "6px 12px", fontSize: 12.5 }}
            onClick={() => void copyText(url).then(() => toast("Server URL copied"))}
          >
            Copy
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderTop: "1px solid #EFEDE8",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: "#6C6962" }}>Access token</span>
            <span className="rp-mono" style={{ fontSize: 13, overflowWrap: "anywhere" }}>
              {w && !w.token && !token ? "No token yet — Reveal creates one" : tokenText}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "6px 12px", fontSize: 12.5 }}
              disabled={reveal.isPending}
              onClick={() => {
                if (shown) return setShown(false);
                fullToken()
                  .then(() => setShown(true))
                  .catch(fail);
              }}
            >
              {shown ? "Hide" : "Reveal"}
            </button>
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "6px 12px", fontSize: 12.5 }}
              disabled={rotate.isPending}
              onClick={() =>
                rotate.mutate(undefined, {
                  onSuccess: (r) => {
                    setToken(r.token);
                    setShown(true);
                    toast(
                      w?.token
                        ? "Token rotated. Old token stops working in 10 min."
                        : "Token created",
                    );
                  },
                  onError: fail,
                })
              }
            >
              Rotate
            </button>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            padding: "14px 16px",
            borderTop: "1px solid #EFEDE8",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontWeight: 500, fontSize: 13.5 }}>Allow agents to post replies</span>
            <span style={{ fontSize: 12.5, color: "#6C6962" }}>
              Off: agents can only create drafts that land in your Inbox.
            </span>
          </div>
          <Toggle
            label="Allow agents to post replies"
            on={w?.agentsCanPost ?? false}
            disabled={!w || update.isPending}
            onChange={() =>
              update.mutate(
                { agentsCanPost: !w!.agentsCanPost },
                {
                  onSuccess: (n) =>
                    toast(n.agentsCanPost ? "Agents can post replies" : "Agents can only draft"),
                  onError: fail,
                },
              )
            }
          />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ alignSelf: "flex-start" }}>
          <Seg
            label="MCP client"
            pad={12}
            value={client}
            onChange={setClient}
            options={[
              { id: "claude", label: "Claude Desktop" },
              { id: "cursor", label: "Cursor" },
              { id: "cli", label: "Claude Code" },
            ]}
          />
        </div>
        <div
          style={{
            position: "relative",
            borderRadius: 12,
            background: "#191917",
            color: "#E9E7E1",
          }}
        >
          <span
            className="rp-mono"
            style={{ position: "absolute", top: 12, left: 16, fontSize: 11, color: "#8F8C84" }}
          >
            {file}
          </span>
          <button
            type="button"
            onClick={() =>
              fullToken()
                .then((t) => copyText(snippet(client, url, t)[1]))
                .then(() => toast("Config copied"))
                .catch(fail)
            }
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid #3A3935",
              background: "transparent",
              color: "#E9E7E1",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Copy
          </button>
          <pre
            className="rp-mono"
            style={{
              margin: 0,
              padding: "40px 16px 16px",
              fontSize: 12.5,
              lineHeight: 1.65,
              overflow: "auto",
            }}
          >
            {code}
          </pre>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontWeight: 600 }}>Tools exposed</span>
          <div className="rp-card" style={{ borderRadius: 12 }}>
            {TOOLS.map(([n, d], i) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  padding: "11px 14px",
                  borderTop: rowBorder(i),
                }}
              >
                <span className="rp-mono" style={{ fontSize: 12.5, color: "#0F6B4A" }}>
                  {n}
                </span>
                <span style={{ fontSize: 12.5, color: "#55534E" }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontWeight: 600 }}>Connected clients</span>
          <div className="rp-card" style={{ borderRadius: 12 }}>
            {clients.isPending ? (
              <div style={{ padding: 14 }}>
                <Skel h={32} />
              </div>
            ) : null}
            {(clients.data?.data ?? []).map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderTop: rowBorder(i),
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: "#6C6962" }}>
                    {c.lastUsedAt
                      ? `Last call ${ago(c.lastUsedAt)}${c.lastTool ? ` · ${c.lastTool}` : ""}`
                      : `Connected ${ago(c.connectedAt)} · not used yet`}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={revoke.isPending}
                  onClick={() =>
                    revoke.mutate(c.id, {
                      onSuccess: () => {
                        if (c.kind === "token") {
                          setToken(null);
                          setShown(false);
                        }
                        void clients.refetch();
                        toast(`${c.name} revoked`);
                      },
                      onError: fail,
                    })
                  }
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "1px solid #E6E4DF",
                    background: "#fff",
                    fontSize: 12,
                    color: "#B42318",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Revoke
                </button>
              </div>
            ))}
            {clients.data && !clients.data.data.length ? (
              <div style={{ padding: "16px 14px", fontSize: 13, color: "#6C6962" }}>
                No clients yet. Add the config above and restart your client.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
