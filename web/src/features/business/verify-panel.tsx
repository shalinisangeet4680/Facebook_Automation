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
import { useToast } from "@/features/replyly/ui";

import { Field, Spin } from "./location-ui";
import { Notice, Skel } from "./ui";

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

  if (status.error) return <Notice tone="error">{errorMessage(status.error)}</Notice>;
  if (!s) return <Skel h={180} r={14} />;

  if (s.verified)
    return (
      <div
        className="gb-card gb-card-pad"
        style={{ display: "flex", gap: 14, alignItems: "center" }}
      >
        <span
          className="gb-check-big"
          aria-hidden
          style={{
            width: 40,
            height: 40,
            fontSize: 18,
            boxShadow: "0 0 0 6px var(--gb-green-soft)",
          }}
        >
          ✓
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 3, marginLeft: 6 }}>
          <span className="gb-title">{s.title} is verified on Google</span>
          <span className="gb-sub">{s.note}</span>
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
    <div className="gb-lp-col">
      <Notice
        tone={s.state === "failed" || s.ownershipConflict || s.guidelinesIssue ? "warn" : "ok"}
        action={
          <a href={s.manageUrl} target="_blank" rel="noreferrer" className="gb-btn">
            Business Profile ↗
          </a>
        }
      >
        <span className="gb-lp-notice-title">
          {s.state === "pending"
            ? `Waiting for your code${s.methodLabel ? ` · ${s.methodLabel}` : ""}`
            : "Unverified — finish verification"}
        </span>
        {s.note}
        {s.startedAt ? ` Requested ${ago(s.startedAt)}.` : ""}
      </Notice>
      {s.error ? <Notice tone="error">{s.error}</Notice> : null}

      {s.needsCode && !choosing ? (
        <div className="gb-card gb-card-pad gb-lp-col" style={{ gap: 14 }}>
          <Field label="Verification code" style={{ maxWidth: 260 }}>
            <input
              className="gb-input gb-lp-mono"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              maxLength={12}
              placeholder="123456"
              style={{ height: 44, fontSize: 18, letterSpacing: "0.2em" }}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s-]/g, ""))}
            />
          </Field>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="gb-btn gb-btn-green"
              disabled={code.replace(/\D/g, "").length < 4 || complete.isPending}
              onClick={() =>
                complete.mutate(code, {
                  onSuccess: (next) =>
                    toast(next.verified ? "Verified on Google" : "Google is still checking"),
                })
              }
            >
              {complete.isPending ? <Spin /> : null}
              Verify
            </button>
            <button type="button" className="gb-btn gb-btn-ghost" onClick={() => setChoosing(true)}>
              Didn’t get it? Use another way
            </button>
          </div>
          {complete.error ? <Notice tone="error">{errorMessage(complete.error)}</Notice> : null}
        </div>
      ) : (
        <div className="gb-card gb-card-pad gb-lp-col" style={{ gap: 14 }}>
          <span className="gb-title">How should Google send your code?</span>
          {options.isPending ? (
            <Skel h={120} />
          ) : options.error ? (
            <Notice tone="error">{errorMessage(options.error)}</Notice>
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
                    className="gb-lp-method"
                    onClick={() => {
                      setMethod(o.method);
                      setEmail(o.email ?? "");
                    }}
                  >
                    <span className="gb-lp-method-icon" aria-hidden>
                      <Icon size={16} />
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{o.label}</span>
                      <span className="gb-faint">{destination(o)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Notice tone="warn">
              <span className="gb-lp-notice-title">Google needs another way to verify</span>
              Google doesn’t offer a code for this business here. It may ask for a short video or
              more documents. Finish in Business Profile, then come back and refresh.
            </Notice>
          )}
          {chosen?.method === "EMAIL" && chosen.emailEditable ? (
            <Field
              label="Send the code to"
              hint={`Use an address at ${chosen.email?.split("@")[1]}.`}
              style={{ maxWidth: 360 }}
            >
              <input
                className="gb-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          ) : null}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="gb-btn gb-btn-green"
              disabled={!chosen || start.isPending}
              onClick={send}
            >
              {start.isPending ? <Spin /> : null}
              {chosen?.method === "ADDRESS"
                ? "Mail the postcard"
                : chosen?.method === "AUTO"
                  ? "Verify now"
                  : "Send code"}
            </button>
            {s.needsCode ? (
              <button
                type="button"
                className="gb-btn gb-btn-ghost"
                onClick={() => setChoosing(false)}
              >
                I have a code
              </button>
            ) : null}
            <button
              type="button"
              className="gb-btn gb-btn-ghost"
              disabled={status.isFetching}
              onClick={() => void status.refetch()}
            >
              {status.isFetching ? "Checking…" : "Refresh status"}
            </button>
          </div>
          {start.error ? <Notice tone="error">{errorMessage(start.error)}</Notice> : null}
        </div>
      )}
    </div>
  );
}
