"use client";

import { useEffect, useState } from "react";

import { CheckRow, type CheckState } from "@/components/ui/check-row";
import type { ConnectionCheck } from "@/lib/api/types";

export const CHECKS = [
  { key: "token", label: "Token" },
  { key: "identity", label: "System user" },
  { key: "permissions", label: "Permissions" },
  { key: "ad_accounts", label: "Ad accounts" },
  { key: "pages", label: "Facebook Pages" },
  { key: "instagram", label: "Instagram" },
  { key: "datasets", label: "Datasets (Pixel)" },
] as const;

export function VerificationList({ result }: { result: ConnectionCheck[] | null }) {
  const [progress, setProgress] = useState(0);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (result) return;
    const id = window.setInterval(
      () => setProgress((p) => Math.min(p + 1, CHECKS.length - 1)),
      420,
    );
    return () => window.clearInterval(id);
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const id = window.setInterval(
      () =>
        setRevealed((r) => {
          if (r >= CHECKS.length) window.clearInterval(id);
          return Math.min(r + 1, CHECKS.length);
        }),
      170,
    );
    return () => window.clearInterval(id);
  }, [result]);

  return (
    <div className="divide-border divide-y" aria-live="polite">
      {CHECKS.map((c, i) => {
        const found = result?.find((r) => r.key === c.key);
        let state: CheckState = "pending";
        let message: string | undefined;
        if (result) {
          if (i < revealed && found) {
            state = found.status;
            message = found.message;
          }
        } else if (i === progress) {
          state = "running";
        }
        return <CheckRow key={c.key} state={state} label={c.label} message={message} />;
      })}
    </div>
  );
}
