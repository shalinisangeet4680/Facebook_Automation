"use client";

import { ClipboardPaste, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useConnectMeta } from "@/lib/api/queries";
import type { Connection, ConnectionCheck } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { VerificationList } from "./verification-list";

function checksFrom(error: unknown): ConnectionCheck[] {
  if (error instanceof ApiError && Array.isArray(error.details.checks)) {
    return error.details.checks as ConnectionCheck[];
  }
  return [{ key: "token", label: "Token", status: "failed", message: errorMessage(error) }];
}

export function TokenForm({ onConnected }: { onConnected: (connection: Connection) => void }) {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ConnectionCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connect = useConnectMeta();
  const verifying = attempt > 0;

  function submit() {
    setError(null);
    setResult(null);
    setAttempt((a) => a + 1);
    connect.mutate(token.trim(), {
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
    <Card>
      <form
        className="grid gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim()) submit();
        }}
      >
        <div>
          <h3 className="text-[15px] font-semibold">Paste your token</h3>
          <p className="text-small text-muted">
            It&apos;s encrypted before it&apos;s stored and never shown again.
          </p>
        </div>
        <div className="relative">
          <label htmlFor="meta-token" className="sr-only">
            System user access token
          </label>
          <input
            id="meta-token"
            type={visible ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAAG…"
            autoComplete="off"
            spellCheck={false}
            className={cn(inputClass, "h-12 pr-24 font-mono text-[14px]")}
          />
          <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={visible ? "Hide token" : "Show token"}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? <EyeOff /> : <Eye />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Paste from clipboard"
              onClick={async () => {
                try {
                  setToken((await navigator.clipboard.readText()).trim());
                } catch {
                  setError("Paste with ⌘V or Ctrl+V — clipboard access was blocked.");
                }
              }}
            >
              <ClipboardPaste />
            </Button>
          </div>
        </div>
        {token.trim() && !token.trim().startsWith("EAA") ? (
          <p className="text-small text-warning">Meta tokens usually start with “EAA”.</p>
        ) : null}
        <Button type="submit" size="lg" loading={connect.isPending} disabled={!token.trim()}>
          <ShieldCheck /> Connect and verify
        </Button>
        {verifying ? (
          <div className="border-border bg-surface-muted/60 rounded-[var(--radius-control)] border px-4 py-1.5">
            <VerificationList key={attempt} result={result} />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-small text-danger font-medium">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
