"use client";

import { useEffect, useState } from "react";

import { StateArt, type ArtKind } from "./state-art";

const GROUPS: {
  label: string;
  items: { kind: ArtKind; code: string; title: string; body: string; cta: string; cta2?: string }[];
}[] = [
  {
    label: "PROGRESS",
    items: [
      {
        kind: "verify",
        code: "connecting",
        title: "Verifying your key",
        body: "We check the key, the API and Play Console access in sequence.",
        cta: "Cancel",
      },
      {
        kind: "syncing",
        code: "syncing",
        title: "Pulling your reviews",
        body: "Google shares the last 7 days; import a Play Console CSV for older ones. You can keep working.",
        cta: "Hide",
      },
      {
        kind: "drafting",
        code: "drafting",
        title: "Writing a draft",
        body: "AI fills your template placeholders and matches your voice.",
        cta: "Stop",
      },
    ],
  },
  {
    label: "ERRORS",
    items: [
      {
        kind: "invalid_key",
        code: "INVALID_KEY",
        title: "This key can’t be read",
        body: "The JSON is missing client_email. Download a fresh key from Service accounts.",
        cta: "Upload again",
        cta2: "How to get a key",
      },
      {
        kind: "api_disabled",
        code: "SERVICE_DISABLED",
        title: "Play Developer API is off",
        body: "Turn on the Google Play Android Developer API in the same Cloud project.",
        cta: "Open Cloud Console",
        cta2: "Retry",
      },
      {
        kind: "no_permission",
        code: "403 PERMISSION_DENIED",
        title: "Can see the app, can’t reply",
        body: "Grant “Reply to reviews” to the service account in Play Console.",
        cta: "Check again",
        cta2: "Copy email",
      },
      {
        kind: "disconnected",
        code: "401 KEY_REVOKED",
        title: "Connection lost",
        body: "The service account key was deleted or rotated. Auto-replies are paused.",
        cta: "Reconnect",
      },
      {
        kind: "quota",
        code: "429 QUOTA_EXCEEDED",
        title: "Daily quota reached",
        body: "Google limits replies per day. Remaining drafts post automatically after the reset.",
        cta: "Got it",
        cta2: "View queue",
      },
      {
        kind: "reply_failed",
        code: "POST_FAILED",
        title: "Reply wasn’t posted",
        body: "The review may have been edited or deleted. Your draft is safe.",
        cta: "Retry",
        cta2: "Edit draft",
      },
    ],
  },
  {
    label: "EMPTY",
    items: [
      {
        kind: "inbox_zero",
        code: "inbox_zero",
        title: "Inbox zero. Nice.",
        body: "Every review has a reply. Auto-mode apps keep answering while you’re away.",
        cta: "See what was sent",
      },
    ],
  },
];

const CAPTIONS: Partial<Record<ArtKind, string>> = {
  syncing: "pulling reviews · 62%",
  disconnected: "last sync 3h 12m ago",
};

export function StatesPage() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setStage((s) => (s + 1) % 4), 1200);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 className="rp-serif" style={{ fontSize: 36, lineHeight: 1 }}>
          System states
        </h1>
        <span style={{ color: "#55534E", fontSize: 13.5 }}>
          Progress, error and empty moments across the product.
        </span>
      </div>
      {GROUPS.map((g) => (
        <section key={g.label} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span
            className="rp-mono"
            style={{ fontSize: 11.5, color: "#6C6962", letterSpacing: ".06em" }}
          >
            {g.label}
          </span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
              gap: 16,
            }}
          >
            {g.items.map((s) => (
              <div
                key={s.kind}
                className="rp-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 16,
                  padding: 8,
                  gap: 4,
                }}
              >
                <div style={{ height: 220 }}>
                  <StateArt
                    kind={s.kind}
                    stage={stage}
                    height={220}
                    caption={
                      s.kind === "verify" && stage >= 3
                        ? "connected · 5 apps found"
                        : CAPTIONS[s.kind]
                    }
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "12px 12px 10px",
                  }}
                >
                  <span
                    className="rp-mono"
                    style={{ fontSize: 11, color: g.label === "ERRORS" ? "#B42318" : "#6C6962" }}
                  >
                    {s.code}
                  </span>
                  <span className="rp-serif" style={{ fontSize: 23, lineHeight: 1.1 }}>
                    {s.title}
                  </span>
                  <span
                    style={{ fontSize: 13, color: "#55534E", lineHeight: 1.5, textWrap: "pretty" }}
                  >
                    {s.body}
                  </span>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "#191917",
                        color: "#fff",
                        fontSize: 12.5,
                        fontWeight: 500,
                      }}
                    >
                      {s.cta}
                    </span>
                    {s.cta2 ? (
                      <span
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid #E6E4DF",
                          fontSize: 12.5,
                        }}
                      >
                        {s.cta2}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
