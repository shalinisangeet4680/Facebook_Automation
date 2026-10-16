"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAddPlayApp, useConnectPlay } from "@/lib/api/queries";

import { useConnected } from "./shell";
import { Select } from "./select";
import { StateArt, type ArtKind } from "./state-art";
import { Banner, copyText, cx, Linked, Spinner, URL_RE, useToast } from "./ui";

const A = "#0F6B4A";

const STEPS = [
  {
    title: "Create a service account",
    sub: "Google Cloud Console",
    link: "https://console.cloud.google.com/iam-admin/serviceaccounts",
    linkLabel: "Open Cloud Console",
    items: [
      "Open IAM & Admin → Service accounts and click Create service account.",
      "Name it “replyly”. No project roles are needed.",
      "Open the account → Keys → Add key → JSON. Keep the downloaded file.",
      "Enable the Google Play Android Developer API and the Play Developer Reporting API for this project.",
    ],
  },
  {
    title: "Invite it to Play Console",
    sub: "Google Play Console",
    link: "https://play.google.com/console",
    linkLabel: "Open Play Console",
    items: [
      "Go to Users and permissions → Invite new users.",
      "Paste the service account email (client_email inside your JSON).",
      "Under App permissions, add the apps TreeVook should manage.",
      "Tick View app information and Reply to reviews, then send the invite.",
    ],
  },
  {
    title: "Upload key & verify",
    sub: "Takes about 10 seconds",
    link: "",
    linkLabel: "",
    items: [],
  },
];

type ErrCode = "invalid_key" | "api_disabled" | "no_permission" | "error";

const ERR_TITLE: Record<ErrCode, string> = {
  invalid_key: "This key can’t be read",
  api_disabled: "Play Developer API is turned off",
  no_permission: "Invite found, but no reply permission",
  error: "The connection couldn’t be checked",
};

interface VerifyError {
  code: ErrCode;
  stage: number;
  message: string;
}

function readEmail(text: string) {
  try {
    const json = JSON.parse(text) as { client_email?: unknown };
    return typeof json.client_email === "string" ? json.client_email : null;
  } catch {
    return null;
  }
}

export function ConnectPage() {
  const router = useRouter();
  const toast = useToast();
  const { connected, connections } = useConnected();
  const connect = useConnectPlay();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<{ name: string; text: string; email: string | null } | null>(
    null,
  );
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState<VerifyError | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [sawConnected, setSawConnected] = useState(false);
  if (connected && !sawConnected) {
    setSawConnected(true);
    if (step === 0) setStep(1);
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const verifying = stage >= 0 && stage < 3 && !error;

  async function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > 20_000) {
      setFile({ name: f.name, text: "", email: null });
      setError({
        code: "invalid_key",
        stage: 0,
        message: "This file is too big to be a service account key.",
      });
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text, email: readEmail(text) });
    setError(null);
    setStage(-1);
  }

  function verify() {
    if (!file || verifying) return;
    timers.current.forEach(clearTimeout);
    setError(null);
    setStage(0);
    timers.current = [
      setTimeout(() => setStage((s) => (s === 0 ? 1 : s)), 1100),
      setTimeout(() => setStage((s) => (s === 1 ? 2 : s)), 2200),
    ];
    const started = Date.now();
    connect.mutate(file.text, {
      onSuccess: (res) => {
        const wait = Math.max(0, 2400 - (Date.now() - started));
        timers.current.push(
          setTimeout(() => {
            setStage(3);
            const found = res.discovery.added.length + res.discovery.already.length;
            toast(`Connected · ${found} app${found === 1 ? "" : "s"} found`);
            timers.current.push(setTimeout(() => router.push("/reviews"), 1100));
          }, wait),
        );
      },
      onError: (err) => {
        const details = err instanceof ApiError ? err.details : {};
        const code = (typeof details.code === "string" ? details.code : "error") as ErrCode;
        const at = typeof details.stage === "number" ? details.stage : 0;
        const wait = Math.max(0, at * 1100 + 700 - (Date.now() - started));
        timers.current.push(
          setTimeout(() => {
            timers.current.forEach(clearTimeout);
            setStage(at);
            setError({
              code: code in ERR_TITLE ? code : "error",
              stage: at,
              message: errorMessage(err),
            });
          }, wait),
        );
      },
    });
  }

  const errTitle = error
    ? error.code === "api_disabled" && /Reporting API/i.test(error.message)
      ? "Play Developer Reporting API is turned off"
      : ERR_TITLE[error.code]
    : "";
  const artKind: ArtKind =
    step === 0
      ? "step_sa"
      : step === 1
        ? "step_invite"
        : error && error.code !== "error"
          ? error.code
          : "verify";
  const caption =
    step === 0
      ? "Create the account, then download a JSON key. That file is all TreeVook needs."
      : step === 1
        ? "Paste the service account email and grant exactly two permissions."
        : error
          ? `${errTitle}. ${error.message.replace(URL_RE, "").replace(/[:\s]+$/, ".")}`
          : stage >= 0
            ? "Checking each link in the chain…"
            : "Drop your key to check the connection end to end.";
  const label = verifying
    ? "Verifying…"
    : error
      ? "Try again"
      : stage >= 3
        ? "Connected"
        : "Verify & connect";

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 620 }}>
        <span
          className="rp-mono"
          style={{ fontSize: 11.5, color: "#6C6962", letterSpacing: ".04em" }}
        >
          SETUP · ABOUT 5 MINUTES
        </span>
        <h1
          className="rp-serif"
          style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: "-.01em" }}
        >
          Connect Google Play, <span style={{ fontStyle: "italic" }}>once.</span>
        </h1>
        <p style={{ color: "#55534E", lineHeight: 1.55, textWrap: "pretty" }}>
          TreeVook reads and replies to reviews through a service account you own. No passwords,
          revoke any time from Play Console.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            className="rp-card"
            style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            {STEPS.map((st, i) => {
              const done = i < step || (i === 2 && stage >= 3);
              const open = i === step;
              return (
                <div
                  key={st.title}
                  style={{
                    borderTop: i ? "1px solid #EFEDE8" : "none",
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    aria-expanded={open}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left",
                      color: "#191917",
                    }}
                  >
                    <span
                      className="rp-mono"
                      style={{
                        width: 28,
                        height: 28,
                        flexShrink: 0,
                        borderRadius: "50%",
                        background: done ? A : open ? "#191917" : "#fff",
                        color: done || open ? "#fff" : "#6C6962",
                        border: `1px solid ${done ? A : open ? "#191917" : "#E6E4DF"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                      }}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                      <span style={{ fontWeight: 500, fontSize: 14.5 }}>{st.title}</span>
                      <span style={{ fontSize: 12, color: "#6C6962" }}>{st.sub}</span>
                    </span>
                  </button>
                  {open ? (
                    <div
                      style={{ paddingLeft: 42, display: "flex", flexDirection: "column", gap: 14 }}
                    >
                      {st.items.length ? (
                        <>
                          <ol
                            style={{
                              margin: 0,
                              paddingLeft: 18,
                              listStyle: "decimal",
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                              color: "#55534E",
                              lineHeight: 1.5,
                              fontSize: 13.5,
                            }}
                          >
                            {st.items.map((li) => (
                              <li key={li} style={{ paddingLeft: 4 }}>
                                {li}
                              </li>
                            ))}
                          </ol>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <button type="button" className="rp-btn" onClick={() => setStep(i + 1)}>
                              Done, next step
                            </button>
                            <a
                              href={st.link}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 13, padding: "8px 6px" }}
                            >
                              {st.linkLabel} ↗
                            </a>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <input
                            ref={input}
                            type="file"
                            accept="application/json,.json"
                            hidden
                            onChange={(e) => {
                              void pick(e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                          {!file ? (
                            <button
                              type="button"
                              className={cx("rp-drop", over && "rp-drop-over")}
                              onClick={() => input.current?.click()}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setOver(true);
                              }}
                              onDragLeave={() => setOver(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setOver(false);
                                void pick(e.dataTransfer.files[0]);
                              }}
                            >
                              <span className="rp-mono" style={{ fontSize: 18 }}>
                                {"{ }"}
                              </span>
                              <span style={{ fontWeight: 500, fontSize: 13.5 }}>
                                Drop your JSON key
                              </span>
                              <span style={{ fontSize: 12, color: "#6C6962" }}>
                                or click to choose · stored encrypted
                              </span>
                            </button>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: 12,
                                borderRadius: 10,
                                border: "1px solid #E6E4DF",
                              }}
                            >
                              <span
                                className="rp-mono"
                                style={{
                                  width: 34,
                                  height: 34,
                                  flexShrink: 0,
                                  borderRadius: 8,
                                  background: "#F4F2EE",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                }}
                              >
                                {"{ }"}
                              </span>
                              <span
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {file.name}
                                </span>
                                <span
                                  className="rp-mono"
                                  style={{
                                    fontSize: 11,
                                    color: "#6C6962",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {file.email ?? "no client_email found"}
                                </span>
                              </span>
                              {file.email ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void copyText(file.email!).then(() =>
                                      toast("Service account email copied"),
                                    );
                                  }}
                                  style={{
                                    padding: "5px 9px",
                                    borderRadius: 6,
                                    border: "1px solid #E6E4DF",
                                    background: "#fff",
                                    fontSize: 12,
                                    cursor: "pointer",
                                    flexShrink: 0,
                                  }}
                                >
                                  Copy email
                                </button>
                              ) : null}
                              <button
                                type="button"
                                aria-label="Remove key"
                                onClick={() => {
                                  setFile(null);
                                  setStage(-1);
                                  setError(null);
                                }}
                                style={{
                                  padding: "5px 8px",
                                  border: "none",
                                  background: "none",
                                  color: "#6C6962",
                                  fontSize: 15,
                                  cursor: "pointer",
                                }}
                              >
                                ×
                              </button>
                            </div>
                          )}
                          {error ? (
                            <div
                              role="alert"
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                padding: "12px 14px",
                                borderRadius: 10,
                                background: "#FDF0EE",
                                color: "#7A1A12",
                                fontSize: 13,
                                lineHeight: 1.5,
                                overflowWrap: "anywhere",
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{errTitle}</span>
                              <span>
                                <Linked text={error.message} />
                              </span>
                            </div>
                          ) : null}
                          <button
                            type="button"
                            className="rp-btn"
                            onClick={verify}
                            disabled={!file || verifying || stage >= 3}
                            style={{ padding: "10px 14px", fontSize: 13.5 }}
                          >
                            {verifying ? <Spinner /> : null}
                            <span>{label}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {connected ? <AddByPackage connections={connections} /> : null}
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 36 }}
        >
          <div style={{ height: 300, borderRadius: 14, overflow: "hidden" }}>
            <StateArt
              kind={artKind}
              stage={Math.max(0, stage)}
              email={file?.email ?? undefined}
              caption={stage >= 3 ? "connected" : undefined}
              detail={
                error?.code === "api_disabled" && /Reporting API/i.test(error.message)
                  ? "playdeveloperreporting.googleapis.com"
                  : undefined
              }
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              padding: "0 4px",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "#55534E",
                lineHeight: 1.5,
                textWrap: "pretty",
                overflowWrap: "anywhere",
              }}
            >
              {caption}
            </span>
            <Link href="/reviews/mcp" className="rp-btn-text" style={{ flexShrink: 0 }}>
              Use MCP instead →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddByPackage({ connections }: { connections: { id: string; clientEmail: string }[] }) {
  const add = useAddPlayApp();
  const toast = useToast();
  const router = useRouter();
  const [pkg, setPkg] = useState("");
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  return (
    <form
      className="rp-card"
      style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(
          { connectionId: connectionId || connections[0]!.id, packageName: pkg.trim() },
          {
            onSuccess: (app) => {
              toast(`${app.title} added`);
              router.push(`/reviews/${app.id}`);
            },
          },
        );
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontWeight: 500, fontSize: 14.5 }}>Already connected? Add one app</span>
        <span style={{ fontSize: 12.5, color: "#6C6962" }}>
          New apps are found automatically every day. Add one now by its package name.
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {connections.length > 1 ? (
          <Select
            label="Service account"
            align="start"
            minWidth={240}
            value={connectionId}
            onChange={setConnectionId}
            options={connections.map((c) => ({ value: c.id, label: c.clientEmail }))}
          />
        ) : null}
        <input
          className="rp-input rp-mono"
          aria-label="Package name"
          placeholder="com.acme.app"
          value={pkg}
          onChange={(e) => setPkg(e.target.value)}
          style={{ flex: "1 1 200px" }}
        />
        <button type="submit" className="rp-btn" disabled={!pkg.trim() || add.isPending}>
          {add.isPending ? <Spinner /> : null}
          Add app
        </button>
      </div>
      {add.error ? <Banner tone="error">{errorMessage(add.error)}</Banner> : null}
    </form>
  );
}
