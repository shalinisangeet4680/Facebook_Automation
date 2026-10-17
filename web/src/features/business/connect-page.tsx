"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  useBusinessStatus,
  useDisconnectGoogle,
  useDiscoverLocations,
  useStartGoogleSignIn,
} from "@/lib/api/business";
import { ago, rowBorder } from "@/features/replyly/tokens";
import { Banner, PageHead, Spinner, useToast } from "@/features/replyly/ui";

import { useGoogleConnected } from "./shell";

const A = "#0F6B4A";

const CAN = [
  ["Reviews", "Read every Google review and post, edit or delete your replies."],
  ["Posts", "Publish updates, offers and events to your profile, now or on a schedule."],
  ["Insights", "See searches, Maps views, calls, website clicks and direction requests."],
  ["Business info", "Keep your name, description, phone, website and hours up to date."],
];

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function ProfileArt() {
  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      height="100%"
      role="img"
      aria-label="A Google Business Profile with reviews, a post and insights"
    >
      <rect x="0" y="0" width="320" height="220" rx="14" fill="#F4F2EE" />
      <rect x="28" y="24" width="168" height="172" rx="12" fill="#fff" stroke="#E6E4DF" />
      <rect x="28" y="24" width="168" height="54" rx="12" fill="#E7F1EC" />
      <path
        d="M112 38c-7 0-12 5-12 12 0 8 12 19 12 19s12-11 12-19c0-7-5-12-12-12Z"
        fill="#0F6B4A"
      />
      <circle cx="112" cy="50" r="4" fill="#fff" />
      <rect x="44" y="90" width="96" height="9" rx="4.5" fill="#191917" />
      <text x="44" y="118" fontSize="12" fill="#C9A227" letterSpacing="1">
        ★★★★★
      </text>
      <text x="112" y="118" fontSize="11" fill="#6C6962" fontFamily="var(--rp-mono)">
        4.6 · 128
      </text>
      <rect x="44" y="132" width="136" height="7" rx="3.5" fill="#EFEDE8" />
      <rect x="44" y="146" width="112" height="7" rx="3.5" fill="#EFEDE8" />
      <rect x="44" y="166" width="62" height="18" rx="9" fill="#191917" />
      <rect x="112" y="166" width="62" height="18" rx="9" fill="#fff" stroke="#E6E4DF" />
      <rect x="210" y="40" width="88" height="62" rx="10" fill="#fff" stroke="#E6E4DF" />
      <rect x="222" y="54" width="40" height="6" rx="3" fill="#6C6962" opacity=".5" />
      <path
        d="M222 90l12-10 10 6 14-14 14 8"
        fill="none"
        stroke="#0F6B4A"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="210" y="114" width="88" height="70" rx="10" fill="#fff" stroke="#E6E4DF" />
      <circle cx="226" cy="132" r="7" fill="#F4F2EE" />
      <rect x="238" y="128" width="44" height="6" rx="3" fill="#191917" opacity=".8" />
      <rect x="222" y="146" width="64" height="5" rx="2.5" fill="#EFEDE8" />
      <rect x="222" y="158" width="50" height="5" rx="2.5" fill="#EFEDE8" />
      <rect x="222" y="170" width="30" height="6" rx="3" fill="#0F6B4A" />
    </svg>
  );
}

export function BusinessConnectPage() {
  const toast = useToast();
  const params = useSearchParams();
  const error = params.get("error");
  const status = useBusinessStatus();
  const { connected, connections, loading } = useGoogleConnected();
  const start = useStartGoogleSignIn();
  const disconnect = useDisconnectGoogle();
  const discover = useDiscoverLocations();
  const [leaving, setLeaving] = useState(false);

  function signIn() {
    start.mutate(undefined, {
      onSuccess: ({ url }) => {
        setLeaving(true);
        window.location.assign(url);
      },
      onError: (err) => toast(errorMessage(err)),
    });
  }

  const button = (
    <button
      type="button"
      className="rp-btn"
      style={{ padding: "10px 16px", gap: 10 }}
      disabled={start.isPending || leaving || status.data?.configured === false}
      onClick={signIn}
    >
      {start.isPending || leaving ? <Spinner size={12} /> : <GoogleMark />}
      {connected ? "Add another Google account" : "Sign in with Google"}
    </button>
  );

  return (
    <div
      className="rp-in"
      style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 860 }}
    >
      <PageHead
        title={connected ? "Google account" : "Connect your Business Profile"}
        sub={
          connected
            ? "TreeVook manages every location these Google accounts own or manage."
            : "Sign in with the Google account that owns or manages your business on Google. TreeVook imports every location and its reviews."
        }
      />
      {error ? (
        <Banner tone="error" title="Google sign-in didn’t finish">
          {error}
        </Banner>
      ) : null}
      {status.data?.mock ? (
        <Banner tone="info" title="Demo mode">
          Google hasn’t approved Business Profile API access for this server yet, so signing in
          connects two sample locations with reviews, posts and insights. Everything works the same
          way once access is approved.
        </Banner>
      ) : null}
      {status.data && !status.data.configured ? (
        <Banner tone="warn" title="Google sign-in isn’t set up on this server">
          Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, with {status.data.redirectUri} as an
          authorized redirect URI.
        </Banner>
      ) : null}

      {loading ? null : connected ? (
        <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
          {connections.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                borderTop: rowBorder(i),
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "#F4F2EE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GoogleMark />
              </span>
              <span
                style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 200 }}
              >
                <span style={{ fontWeight: 500 }}>{c.email}</span>
                <span style={{ fontSize: 12, color: c.status === "error" ? "#B42318" : "#6C6962" }}>
                  {c.status === "error"
                    ? c.error
                    : `${c.locations} location${c.locations === 1 ? "" : "s"} · checked ${ago(c.discoveredAt ?? c.createdAt)}`}
                </span>
              </span>
              {c.status === "error" ? (
                <button
                  type="button"
                  className="rp-btn"
                  style={{ padding: "7px 12px" }}
                  onClick={signIn}
                >
                  Reconnect
                </button>
              ) : null}
              <button
                type="button"
                className="rp-btn-quiet"
                style={{ padding: "7px 12px" }}
                disabled={disconnect.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Disconnect ${c.email}? Its locations, reviews and posts are removed from TreeVook. Nothing changes on Google.`,
                    )
                  )
                    disconnect.mutate(c.id, {
                      onSuccess: () => toast("Disconnected"),
                      onError: (err) => toast(errorMessage(err)),
                    });
                }}
              >
                Disconnect
              </button>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "14px 16px",
              borderTop: "1px solid #EFEDE8",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "9px 14px" }}
              disabled={discover.isPending}
              onClick={() =>
                discover.mutate(undefined, {
                  onSuccess: (r) =>
                    toast(
                      r.error
                        ? r.error
                        : r.added.length || r.restored.length
                          ? `Added ${r.added.length + r.restored.length} location${r.added.length + r.restored.length === 1 ? "" : "s"}`
                          : `All ${r.found} locations are already here`,
                    ),
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              {discover.isPending ? <Spinner size={11} dark /> : null}
              Find new locations
            </button>
            {button}
          </div>
        </div>
      ) : (
        <div
          className="rp-card"
          style={{
            padding: 24,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {CAN.map(([title, desc]) => (
                <div key={title} style={{ display: "flex", gap: 10 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#E7F1EC",
                      color: A,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontWeight: 500, fontSize: 13.5 }}>{title}</span>
                    <span style={{ fontSize: 12.5, color: "#6C6962" }}>{desc}</span>
                  </span>
                </div>
              ))}
            </div>
            <div>{button}</div>
            <span style={{ fontSize: 12, color: "#6C6962", lineHeight: 1.5 }}>
              TreeVook asks Google for permission to manage your Business Profile. Your sign-in is
              encrypted, and nothing is posted without your rules or your approval.
            </span>
          </div>
          <div style={{ height: 220 }}>
            <ProfileArt />
          </div>
        </div>
      )}
      {loading ? null : (
        <div
          className="rp-card"
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 280px" }}>
            <span style={{ fontWeight: 500, fontSize: 13.5 }}>Business not on Google yet?</span>
            <span style={{ fontSize: 12.5, color: "#6C6962" }}>
              {connected
                ? "Create a Business Profile from TreeVook. We check Maps first so you can claim an existing listing instead of making a duplicate."
                : "Sign in with Google above, then create a Business Profile from TreeVook."}
            </span>
          </span>
          {connected ? (
            <Link href="/business/create" className="rp-btn-light" style={{ padding: "9px 14px" }}>
              Create a Business Profile
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
