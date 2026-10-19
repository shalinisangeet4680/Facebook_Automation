"use client";

import { ChevronRight, ShieldCheck } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useMetaOAuthStatus, useStartMetaSignIn } from "@/lib/api/queries";
import { Skel, Spinner } from "@/features/replyly/ui";

import { FacebookMark } from "./facebook-mark";
import { MUTED, SOFT } from "./ui";

export const ADVANCED_LABEL = "Advanced: connect with a system user token";

export function useFacebookLogin() {
  const status = useMetaOAuthStatus();
  return { pending: status.isPending, available: status.data?.facebookLogin === true };
}

export function MetaConnectOptions({
  advanced,
  advancedOpen = false,
  bare = false,
}: {
  advanced: ReactNode;
  advancedOpen?: boolean;
  bare?: boolean;
}) {
  const status = useMetaOAuthStatus();
  const start = useStartMetaSignIn();
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(advancedOpen);
  const panelId = useId();

  if (status.isPending) return <Skel h={150} r={14} />;

  if (!status.data?.facebookLogin)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {status.data ? (
          <span style={{ fontSize: 12.5, color: MUTED }}>
            Facebook sign-in isn’t set up on this server yet.
          </span>
        ) : null}
        {advanced}
      </div>
    );

  const busy = start.isPending || leaving;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        className={bare ? undefined : "rp-card"}
        style={{
          padding: bare ? 0 : 22,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <button
          type="button"
          className="rp-btn"
          style={{ padding: "12px 18px", gap: 10, fontSize: 14 }}
          disabled={busy}
          onClick={() =>
            start.mutate(undefined, {
              onSuccess: ({ url }) => {
                setLeaving(true);
                window.location.assign(url);
              },
            })
          }
        >
          {busy ? <Spinner size={14} /> : <FacebookMark />}
          Continue with Facebook
        </button>
        <p style={{ margin: 0, fontSize: 13.5, color: SOFT, lineHeight: 1.55 }}>
          You’ll pick your ad account, Page, Instagram and Pixel in Facebook’s window.
        </p>
        <span
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: MUTED }}
        >
          <ShieldCheck size={13} aria-hidden /> We only get the assets you choose, and you can
          disconnect any time.
        </span>
        {start.isError ? (
          <span role="alert" style={{ fontSize: 13, fontWeight: 500, color: "#B42318" }}>
            {errorMessage(start.error)}
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <button
          type="button"
          className="rp-btn-quiet"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            fontWeight: 500,
          }}
        >
          <ChevronRight
            size={14}
            aria-hidden
            style={{ transition: "transform .2s", transform: open ? "rotate(90deg)" : "none" }}
          />
          {ADVANCED_LABEL}
        </button>
        {open ? <div id={panelId}>{advanced}</div> : null}
      </div>
    </div>
  );
}
