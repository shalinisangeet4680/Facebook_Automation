"use client";

import { ClipboardPaste, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { ApiError, errorMessage } from "@/lib/api/errors";
import { useConnectMeta } from "@/lib/api/queries";
import type { Connection, ConnectionCheck } from "@/lib/api/types";
import { Spinner } from "@/features/replyly/ui";

import { CardTitle } from "./ui";
import { VerificationList } from "./verification-list";

function checksFrom(error: unknown): ConnectionCheck[] {
  if (error instanceof ApiError && Array.isArray(error.details.checks)) {
    return error.details.checks as ConnectionCheck[];
  }
  return [{ key: "token", label: "Token", status: "failed", message: errorMessage(error) }];
}

const iconBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 6,
} as const;

export function TokenForm({ onConnected }: { onConnected: (connection: Connection) => void }) {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ConnectionCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connect = useConnectMeta();
  const verifying = attempt > 0;
  const trimmed = token.trim();

  function submit() {
    setError(null);
    setResult(null);
    setAttempt((a) => a + 1);
    connect.mutate(trimmed, {
      onSuccess: (connection) => {
        setResult(connection.checks);
        window.setTimeout(() => onConnected(connection), 1600);
      },
      onError: (err) => {
        setResult(checksFrom(err));
        setError(errorMessage(err));
      },
    });
  }

  return (
    <form
      className="rp-card"
      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) submit();
      }}
    >
      <CardTitle
        title="Paste your token"
        sub="It’s encrypted before it’s stored and never shown again."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="meta-token" className="rp-label">
          System user access token
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="meta-token"
            type={visible ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAAG…"
            autoComplete="off"
            spellCheck={false}
            className="rp-input rp-mono"
            style={{
              width: "100%",
              boxSizing: "border-box",
              height: 44,
              paddingRight: 80,
              fontSize: 13.5,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 6,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <button
              type="button"
              className="rp-btn-quiet"
              style={iconBtn}
              aria-label={visible ? "Hide token" : "Show token"}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              type="button"
              className="rp-btn-quiet"
              style={iconBtn}
              aria-label="Paste from clipboard"
              onClick={async () => {
                try {
                  setToken((await navigator.clipboard.readText()).trim());
                } catch {
                  setError("Paste with ⌘V or Ctrl+V — clipboard access was blocked.");
                }
              }}
            >
              <ClipboardPaste size={16} />
            </button>
          </div>
        </div>
        {trimmed && !trimmed.startsWith("EAA") ? (
          <span style={{ fontSize: 12.5, color: "#8A5A00" }}>
            Meta tokens usually start with “EAA”.
          </span>
        ) : null}
      </div>
      <button
        type="submit"
        className="rp-btn"
        style={{ padding: "11px 16px" }}
        disabled={!trimmed || connect.isPending}
      >
        {connect.isPending ? <Spinner /> : <ShieldCheck size={15} />}
        Connect and verify
      </button>
      {verifying ? (
        <div
          style={{
            padding: "2px 14px",
            borderRadius: 10,
            border: "1px solid #EFEDE8",
            background: "#FAF9F7",
          }}
        >
          <VerificationList key={attempt} result={result} />
        </div>
      ) : null}
      {error ? (
        <span role="alert" style={{ fontSize: 13, fontWeight: 500, color: "#B42318" }}>
          {error}
        </span>
      ) : null}
    </form>
  );
}
