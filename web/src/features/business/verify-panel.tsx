"use client";

import { Handshake, Mail, MessageSquare, Phone, Send, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type VerificationOption,
  useCompleteVerification,
  useStartVerification,
  useVerificationOptions,
  useVerificationStatus,
} from "@/lib/api/business";
import { ago } from "@/features/replyly/tokens";
import { Banner, Skel, Spinner, cx, useToast } from "@/features/replyly/ui";

const A = "#0F6B4A";
const MUTED = "#6C6962";

const ICON: Record<VerificationOption["method"], LucideIcon> = {
  SMS: MessageSquare,
  PHONE_CALL: Phone,
  EMAIL: Mail,
  ADDRESS: Send,
  AUTO: Zap,
  VETTED_PARTNER: Handshake,
};

function destination(o: VerificationOption) {
  if (o.method === "SMS") return o.phone ? `Text a code to ${o.phone}` : "Text a code";
  if (o.method === "PHONE_CALL")
    return o.phone ? `Call ${o.phone} with a code` : "Call with a code";
  if (o.method === "EMAIL") return o.email ? `Email a code to ${o.email}` : "Email a code";
  if (o.method === "ADDRESS")
    return `Mail a postcard${o.address ? ` to ${o.address}` : ""}${o.deliveryDays ? ` · about ${o.deliveryDays} days` : ""}`;
  if (o.method === "AUTO") return "Google can verify this business right away";
  return "Verified through a Google partner";
}

export function VerifyPanel({ locationId }: { locationId: string }) {
  const toast = useToast();
  const status = useVerificationStatus(locationId);
  const s = status.data;
  const [choosing, setChoosing] = useState(false);
  const showOptions = Boolean(s && !s.verified && (!s.needsCode || choosing));
  const options = useVerificationOptions(locationId, showOptions);
  const start = useStartVerification(locationId);
  const complete = useCompleteVerification(locationId);
  const [method, setMethod] = useState<VerificationOption["method"] | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  if (status.error) return <Banner tone="error">{errorMessage(status.error)}</Banner>;
  if (!s) return <Skel h={180} r={14} />;

  if (s.verified)
    return (
      <div
        className="rp-card"
        style={{ padding: 22, display: "flex", gap: 14, alignItems: "center" }}
      >
        <span
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#E7F1EC",
            color: A,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ✓
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontWeight: 600 }}>{s.title} is verified on Google</span>
          <span style={{ fontSize: 13, color: MUTED }}>{s.note}</span>
        </span>
      </div>
    );

  const list = options.data?.data ?? [];
  const chosen = list.find((o) => o.method === method) ?? null;

  function send() {
    if (!chosen) return;
    start.mutate(
      { method: chosen.method, email: chosen.method === "EMAIL" && email ? email : undefined },
      {
        onSuccess: (next) => {
          setChoosing(false);
          setCode("");
          toast(next.verified ? "Verified" : "Request sent to Google");
        },
      },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Banner
        tone={s.state === "failed" || s.ownershipConflict || s.guidelinesIssue ? "warn" : "info"}
        title={
          s.state === "pending"
            ? `Waiting for your code${s.methodLabel ? ` · ${s.methodLabel}` : ""}`
            : "Unverified — finish verification"
        }
        action={
          <a
            href={s.manageUrl}
            target="_blank"
            rel="noreferrer"
            className="rp-btn-light"
            style={{ padding: "7px 12px" }}
          >
            Business Profile ↗
          </a>
        }
      >
        {s.note}
        {s.startedAt ? ` Requested ${ago(s.startedAt)}.` : ""}
      </Banner>
      {s.error ? <Banner tone="error">{s.error}</Banner> : null}

      {s.needsCode && !choosing ? (
        <div
          className="rp-card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <label className="rp-field" style={{ maxWidth: 260 }}>
            <span className="rp-label">Verification code</span>
            <input
              className="rp-input rp-mono"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              maxLength={12}
              placeholder="123456"
              style={{ fontSize: 18, letterSpacing: "0.2em" }}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s-]/g, ""))}
            />
          </label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "9px 16px" }}
              disabled={code.replace(/\D/g, "").length < 4 || complete.isPending}
              onClick={() =>
                complete.mutate(code, {
                  onSuccess: (next) =>
                    toast(next.verified ? "Verified on Google" : "Google is still checking"),
                })
              }
            >
              {complete.isPending ? <Spinner size={11} /> : null}
              Verify
            </button>
            <button type="button" className="rp-btn-text" onClick={() => setChoosing(true)}>
              Didn’t get it? Use another way
            </button>
          </div>
          {complete.error ? <Banner tone="error">{errorMessage(complete.error)}</Banner> : null}
        </div>
      ) : (
        <div
          className="rp-card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <span style={{ fontWeight: 600 }}>How should Google send your code?</span>
          {options.isPending ? (
            <Skel h={120} />
          ) : options.error ? (
            <Banner tone="error">{errorMessage(options.error)}</Banner>
          ) : list.length ? (
            <div
              role="radiogroup"
              aria-label="Verification method"
              style={{ display: "grid", gap: 8 }}
            >
              {list.map((o) => {
                const on = method === o.method;
                const Icon = ICON[o.method];
                return (
                  <button
                    key={o.method}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={cx("rp-card", "rp-row")}
                    onClick={() => {
                      setMethod(o.method);
                      setEmail(o.email ?? "");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      textAlign: "left",
                      borderColor: on ? A : undefined,
                      boxShadow: on ? `0 0 0 1px ${A}` : undefined,
                      color: "#191917",
                      font: "inherit",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: on ? "#E7F1EC" : "#F4F2EE",
                        color: on ? A : MUTED,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} />
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                      <span style={{ fontWeight: 500, fontSize: 13.5 }}>{o.label}</span>
                      <span style={{ fontSize: 12.5, color: MUTED }}>{destination(o)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Banner tone="warn" title="Google needs another way to verify">
              Google doesn’t offer a code for this business here. It may ask for a short video or
              more documents. Finish in Business Profile, then come back and refresh.
            </Banner>
          )}
          {chosen?.method === "EMAIL" && chosen.emailEditable ? (
            <label className="rp-field" style={{ maxWidth: 360 }}>
              <span className="rp-label">Send the code to</span>
              <input
                className="rp-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span style={{ fontSize: 12, color: MUTED }}>
                Use an address at {chosen.email?.split("@")[1]}.
              </span>
            </label>
          ) : null}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "9px 16px" }}
              disabled={!chosen || start.isPending}
              onClick={send}
            >
              {start.isPending ? <Spinner size={11} /> : null}
              {chosen?.method === "ADDRESS"
                ? "Mail the postcard"
                : chosen?.method === "AUTO"
                  ? "Verify now"
                  : "Send code"}
            </button>
            {s.needsCode ? (
              <button type="button" className="rp-btn-text" onClick={() => setChoosing(false)}>
                I have a code
              </button>
            ) : null}
            <button
              type="button"
              className="rp-btn-quiet"
              disabled={status.isFetching}
              onClick={() => void status.refetch()}
            >
              {status.isFetching ? "Checking…" : "Refresh status"}
            </button>
          </div>
          {start.error ? <Banner tone="error">{errorMessage(start.error)}</Banner> : null}
        </div>
      )}
    </div>
  );
}
