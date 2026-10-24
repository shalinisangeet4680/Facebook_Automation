"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpLocation,
  useApplyReplyMode,
  useBusinessStatus,
  useLocations,
  useRemoveLocation,
  useStartGoogleSignIn,
} from "@/lib/api/business";
import { useToast } from "@/features/replyly/ui";

import { useGoogleConnected, useLocationColors } from "./shell";
import { GoogleMark, Logo, Notice, Skel, Swatch } from "./ui";

import "./connect.css";

const ONBOARDED = "tv.onboarded";

export function readOnboarded() {
  try {
    return localStorage.getItem(ONBOARDED) === "1";
  } catch {
    return false;
  }
}

export function setOnboarded(on: boolean, silent = false) {
  try {
    if (on) localStorage.setItem(ONBOARDED, "1");
    else localStorage.removeItem(ONBOARDED);
  } catch {
    return;
  }
  if (!silent) window.dispatchEvent(new Event(ONBOARDED));
}

function subscribeOnboarded(notify: () => void) {
  window.addEventListener(ONBOARDED, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(ONBOARDED, notify);
    window.removeEventListener("storage", notify);
  };
}

export function useGoogleSignIn() {
  const toast = useToast();
  const start = useStartGoogleSignIn();
  const [leaving, setLeaving] = useState(false);
  return {
    busy: start.isPending || leaving,
    signIn: () =>
      start.mutate(undefined, {
        onSuccess: ({ url }) => {
          setLeaving(true);
          window.location.assign(url);
        },
        onError: (err) => toast(errorMessage(err)),
      }),
  };
}

type Mode = "approval" | "auto";

const MODES: [Mode, string, string, string, string][] = [
  ["approval", "Approve first", "You OK each reply", "✋", "var(--gb-ink)"],
  ["auto", "Auto", "Replies post on their own", "✓", "var(--gb-green)"],
];

function Art() {
  return (
    <div className="gb-connect-art" aria-hidden>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            className="gb-connect-tile"
            style={{ background: "var(--gb-ink)", boxShadow: "0 10px 30px rgba(0,0,0,.15)" }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M8 15V8M8 8 3.5 2.5M8 8l4.5-5.5" />
            </svg>
          </span>
          <span className="gb-connect-wire">
            <span />
          </span>
          <span
            className="gb-connect-tile"
            style={{ background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,.08)" }}
          >
            <GoogleMark size={26} />
          </span>
        </div>
        <div
          style={{
            width: 300,
            padding: 16,
            borderRadius: 14,
            background: "#fff",
            boxShadow: "0 16px 40px rgba(0,0,0,.08)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{ width: 26, height: 26, borderRadius: 13, background: "var(--gb-line-soft)" }}
            />
            <span style={{ fontSize: 12, letterSpacing: 1, color: "var(--gb-star)" }}>★★★★★</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "var(--gb-faint)" }}>2h</span>
          </div>
          <div className="gb-connect-bar" />
          <div className="gb-connect-bar" style={{ width: "70%" }} />
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: "var(--gb-green-wash)",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                background: "var(--gb-green)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 10,
              }}
            >
              ↩
            </span>
            <span className="gb-connect-bar" style={{ flex: 1, background: "#d9ebe2" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectStep() {
  const params = useSearchParams();
  const error = params.get("error");
  const status = useBusinessStatus();
  const { busy, signIn } = useGoogleSignIn();
  return (
    <div className="gb-connect-step">
      <div className="gb-connect-h">
        <h1>Connect Google</h1>
        <p>We’ll find every location you manage.</p>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {status.data?.mock ? (
        <Notice tone="warn">
          Demo mode: Google hasn’t approved Business Profile API access for this server yet, so
          signing in connects two sample locations with reviews, posts and insights.
        </Notice>
      ) : null}
      {status.data && !status.data.configured ? (
        <Notice tone="warn">
          Google sign-in isn’t set up on this server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET,
          with {status.data.redirectUri} as an authorized redirect URI.
        </Notice>
      ) : null}
      <button
        type="button"
        className="gb-connect-google"
        disabled={busy || status.data?.configured === false}
        onClick={() => {
          setOnboarded(false);
          signIn();
        }}
      >
        <GoogleMark size={18} />
        {busy ? "Connecting…" : "Continue with Google"}
      </button>
      <span style={{ fontSize: 13, color: "var(--gb-faint)" }}>
        Not on Google yet? <Link href="/business/create">Create a profile</Link>
      </span>
    </div>
  );
}

function PickStep({
  locations,
  picked,
  setPicked,
  onNext,
}: {
  locations: GbpLocation[];
  picked: Set<string>;
  setPicked: (next: Set<string>) => void;
  onNext: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const { color } = useLocationColors();
  const remove = useRemoveLocation();
  const [saving, setSaving] = useState(false);
  const count = locations.filter((l) => picked.has(l.id)).length;
  const dropped = locations.filter((l) => !picked.has(l.id));

  async function next() {
    if (!count) return;
    setSaving(true);
    try {
      for (const l of dropped) await remove.mutateAsync(l.id);
      onNext();
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gb-connect-step">
      <div className="gb-connect-h">
        <h1>Pick locations</h1>
        <p>
          {locations.length
            ? `Found ${locations.length}.`
            : "This Google account doesn’t manage any locations yet."}
        </p>
      </div>
      {locations.length ? (
        <div
          role="group"
          aria-label="Locations"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {locations.map((l) => {
            const on = picked.has(l.id);
            return (
              <button
                key={l.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                className="gb-connect-loc"
                onClick={() => {
                  const nextSet = new Set(picked);
                  if (on) nextSet.delete(l.id);
                  else nextSet.add(l.id);
                  setPicked(nextSet);
                }}
              >
                <Swatch color={color(l.id)} label={l.title} size={34} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--gb-ink)",
                    }}
                  >
                    {l.title}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--gb-faint)" }}>
                    {[l.category, l.address].filter(Boolean).join(" · ") || "Business Profile"}
                  </span>
                </span>
                <span className="gb-connect-box" aria-hidden>
                  {on ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {dropped.length && count ? (
        <span style={{ fontSize: 13, color: "var(--gb-faint)" }}>
          Unticked locations leave TreeVook. They stay on Google, and you can add them back from
          Google account.
        </span>
      ) : null}
      <div className="gb-connect-actions">
        {locations.length ? (
          <button
            type="button"
            className="gb-connect-next"
            disabled={!count || saving}
            onClick={() => void next()}
          >
            {saving ? "Saving…" : count ? `Continue with ${count}` : "Pick at least one"}
          </button>
        ) : (
          <button
            type="button"
            className="gb-connect-next"
            onClick={() => {
              setOnboarded(true, true);
              router.push("/business/create");
            }}
          >
            Create a profile
          </button>
        )}
      </div>
    </div>
  );
}

function ModeStep({ ids, onBack }: { ids: string[]; onBack: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const apply = useApplyReplyMode();
  const [mode, setMode] = useState<Mode>("approval");
  return (
    <div className="gb-connect-step">
      <div className="gb-connect-h">
        <h1>How should replies go?</h1>
        <p>Change it anytime.</p>
      </div>
      <div className="gb-connect-modes" role="radiogroup" aria-label="Reply mode">
        {MODES.map(([id, title, sub, icon, bg]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            className="gb-connect-mode"
            onClick={() => setMode(id)}
          >
            <span className="gb-connect-mode-icon" style={{ background: bg }} aria-hidden>
              {icon}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--gb-ink)" }}>{title}</span>
            <span style={{ fontSize: 12, color: "var(--gb-muted)" }}>{sub}</span>
          </button>
        ))}
      </div>
      <div className="gb-connect-actions">
        <button
          type="button"
          className="gb-connect-back"
          onClick={onBack}
          disabled={apply.isPending}
        >
          Back
        </button>
        <button
          type="button"
          className="gb-connect-next gb-connect-finish"
          disabled={apply.isPending}
          onClick={() =>
            apply.mutate(
              { ids, mode },
              {
                onSuccess: () => {
                  setOnboarded(true, true);
                  toast("You’re all set");
                  router.push("/business");
                },
                onError: (err) => toast(errorMessage(err)),
              },
            )
          }
        >
          {apply.isPending ? "Finishing…" : "Finish"}
        </button>
      </div>
    </div>
  );
}

function SetupSteps() {
  const locations = useLocations();
  const [step, setStep] = useState<1 | 2>(1);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const list = locations.data?.data ?? [];
  const chosen = picked ?? new Set(list.map((l) => l.id));
  return (
    <Layout fixed step={step}>
      {locations.isPending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skel h={34} w="60%" />
          <Skel h={60} />
          <Skel h={60} />
        </div>
      ) : locations.isError ? (
        <Notice tone="error">{errorMessage(locations.error)}</Notice>
      ) : step === 1 ? (
        <PickStep
          locations={list}
          picked={chosen}
          setPicked={setPicked}
          onNext={() => setStep(2)}
        />
      ) : (
        <ModeStep
          ids={list.filter((l) => chosen.has(l.id)).map((l) => l.id)}
          onBack={() => setStep(1)}
        />
      )}
    </Layout>
  );
}

function Rail({ step }: { step: number }) {
  return (
    <div
      className="gb-connect-rail"
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={step + 1}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} data-on={i <= step} />
      ))}
    </div>
  );
}

function Layout({ fixed, step, children }: { fixed: boolean; step: number; children: ReactNode }) {
  return (
    <div className={fixed ? "gb-connect gb-connect-fixed" : "gb-connect"}>
      <div className="gb-connect-left">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo />
          <span style={{ fontWeight: 600, fontSize: 15 }}>TreeVook</span>
        </div>
        {fixed ? (
          <div className="gb-connect-col">
            <Rail step={step} />
            {children}
          </div>
        ) : (
          <main className="gb-connect-col">
            <Rail step={step} />
            {children}
          </main>
        )}
      </div>
      <Art />
    </div>
  );
}

export function BusinessConnectPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { connected, loading } = useGoogleConnected();
  const onboarded = useSyncExternalStore<boolean | null>(
    subscribeOnboarded,
    readOnboarded,
    () => null,
  );

  useEffect(() => {
    if (loading || !connected || onboarded !== true) return;
    const error = params.get("error");
    router.replace(
      error ? `/business/account?error=${encodeURIComponent(error)}` : "/business/account",
    );
  }, [loading, connected, onboarded, params, router]);

  if (loading || onboarded === null) return null;
  if (!connected)
    return (
      <Layout fixed={false} step={0}>
        <ConnectStep />
      </Layout>
    );
  if (onboarded) return null;
  return <SetupSteps />;
}
