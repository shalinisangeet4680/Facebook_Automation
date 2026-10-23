"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAddPlayApp, useManagedPlayAccount, usePlayApps } from "@/lib/api/queries";

import { StateArt, type ArtKind } from "./state-art";
import { Banner, copyText, Linked, Skel, Spinner, useToast } from "./ui";

const A = "#0F6B4A";
const MUTED = "#6C6962";
const PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

const STEPS = [
  { title: "Your service account", sub: "Made by TreeVook for this workspace" },
  { title: "Give it access", sub: "In Google Play Console" },
  { title: "Add your app", sub: "Name and package name" },
] as const;

const INVITE = [
  "Open Play Console and go to Users and permissions.",
  "Click Invite new users and paste the email above.",
  "Under App permissions, add the app you want TreeVook to manage.",
  "Tick View app information and Reply to reviews, then click Invite user.",
];

const ART: ArtKind[] = ["step_ours", "step_invite", "step_app"];

const CAPTION = [
  "TreeVook made this Google service account just for your workspace. There's no key to download.",
  "Invite the email like a teammate and grant exactly two permissions. You can remove it any time.",
  "Type the app's name and package name. TreeVook checks access and fetches its reviews.",
];

function EmailBox({ email }: { email: string }) {
  const toast = useToast();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 10px 10px 14px",
        borderRadius: 10,
        border: "1px solid #E6E4DF",
        background: "#FCFBF9",
      }}
    >
      <span
        className="rp-mono"
        data-testid="managed-email"
        style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflowWrap: "anywhere" }}
      >
        {email}
      </span>
      <button
        type="button"
        className="rp-btn-light"
        style={{ flexShrink: 0 }}
        onClick={() => void copyText(email).then(() => toast("Service account email copied"))}
      >
        Copy
      </button>
    </div>
  );
}

function Stepper({
  step,
  reached,
  onPick,
}: {
  step: number;
  reached: number;
  onPick: (i: number) => void;
}) {
  return (
    <ol
      aria-label="Setup steps"
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
        gap: 8,
      }}
    >
      {STEPS.map((st, i) => {
        const done = i < step;
        const open = i === step;
        return (
          <li key={st.title}>
            <button
              type="button"
              disabled={i > reached}
              aria-current={open ? "step" : undefined}
              onClick={() => onPick(i)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${open ? "#191917" : "#E6E4DF"}`,
                background: open ? "#fff" : "transparent",
                cursor: i > reached ? "default" : "pointer",
                textAlign: "left",
                color: "#191917",
                opacity: i > reached ? 0.5 : 1,
              }}
            >
              <span
                className="rp-mono"
                style={{
                  width: 26,
                  height: 26,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: done ? A : open ? "#191917" : "#fff",
                  color: done || open ? "#fff" : MUTED,
                  border: `1px solid ${done ? A : open ? "#191917" : "#E6E4DF"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 500, fontSize: 13.5 }}>{st.title}</span>
                <span style={{ fontSize: 11.5, color: MUTED }}>{st.sub}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function ManagedConnect() {
  const router = useRouter();
  const account = useManagedPlayAccount();
  const apps = usePlayApps();
  const add = useAddPlayApp();
  const hasApps = Boolean(apps.data?.data.length);
  const [picked, setPicked] = useState<number | null>(null);
  const [reached, setReached] = useState(0);
  const [title, setTitle] = useState("");
  const [pkg, setPkg] = useState("");
  const [touched, setTouched] = useState(false);
  const ids = useId();

  const step = picked ?? (hasApps && account.data ? 1 : 0);
  const furthest = Math.max(reached, step);
  const email = account.data?.clientEmail ?? "";
  const go = (i: number) => {
    setPicked(i);
    setReached((r) => Math.max(r, i));
  };

  const packageName = pkg.trim();
  const pkgProblem = !touched
    ? null
    : !packageName
      ? "Add the package name."
      : !PACKAGE.test(packageName)
        ? "Use the package name, like com.acme.shop. It's in your Play Store link after id=."
        : null;
  const titleProblem = touched && !title.trim() ? "Add the app's name." : null;
  const addCode =
    add.error instanceof ApiError && typeof add.error.details.code === "string"
      ? add.error.details.code
      : null;

  function submit() {
    setTouched(true);
    if (!account.data || !title.trim() || !PACKAGE.test(packageName)) return;
    add.mutate(
      { connectionId: account.data.id, packageName, title: title.trim() },
      {
        onSuccess: (app) => router.replace(`/reviews/${app.id}`),
      },
    );
  }

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640 }}>
        <span className="rp-mono" style={{ fontSize: 11.5, color: MUTED, letterSpacing: ".04em" }}>
          SETUP · ABOUT 2 MINUTES
        </span>
        <h1
          className="rp-serif"
          style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: "-.01em" }}
        >
          Connect Google Play, <span style={{ fontStyle: "italic" }}>once.</span>
        </h1>
        <p style={{ color: "#55534E", lineHeight: 1.55, textWrap: "pretty" }}>
          No Google Cloud setup and no keys. Invite TreeVook&apos;s service account to Play Console,
          add your app, and your reviews start syncing.
        </p>
      </div>

      <Stepper step={step} reached={account.data ? furthest : 0} onPick={go} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          className="rp-card"
          style={{ padding: "22px 22px", display: "flex", flexDirection: "column", gap: 16 }}
        >
          {step === 0 ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2 style={{ fontSize: 17, fontWeight: 600 }}>
                  This is your TreeVook service account
                </h2>
                <p style={{ fontSize: 13.5, color: "#55534E", lineHeight: 1.5 }}>
                  It belongs only to this workspace and can only do what you allow in Play Console.
                </p>
              </div>
              {account.isPending ? (
                <div role="status" aria-label="Creating your service account">
                  <Skel h={44} r={10} />
                </div>
              ) : account.error ? (
                <Banner
                  tone="error"
                  title="Your service account couldn't be created"
                  action={
                    <button
                      type="button"
                      className="rp-btn-light"
                      onClick={() => void account.refetch()}
                    >
                      Try again
                    </button>
                  }
                >
                  {errorMessage(account.error)}
                </Banner>
              ) : (
                <EmailBox email={email} />
              )}
              <button
                type="button"
                className="rp-btn"
                style={{ alignSelf: "flex-start", padding: "10px 14px", fontSize: 13.5 }}
                disabled={!account.data}
                onClick={() => go(1)}
              >
                Next: give it access
              </button>
            </>
          ) : step === 1 ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2 style={{ fontSize: 17, fontWeight: 600 }}>Invite it in Play Console</h2>
                <p style={{ fontSize: 13.5, color: "#55534E", lineHeight: 1.5 }}>
                  Service accounts are added like a teammate. They don&apos;t need to accept the
                  invite.
                </p>
              </div>
              <EmailBox email={email} />
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
                {INVITE.map((li) => (
                  <li key={li} style={{ paddingLeft: 4 }}>
                    {li}
                  </li>
                ))}
              </ol>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="rp-btn"
                  style={{ padding: "10px 14px", fontSize: 13.5 }}
                  onClick={() => go(2)}
                >
                  I&apos;ve sent the invite
                </button>
                <a
                  href="https://play.google.com/console/users-and-permissions"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13, padding: "8px 6px" }}
                >
                  Open Play Console ↗
                </a>
              </div>
            </>
          ) : (
            <form
              noValidate
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2 style={{ fontSize: 17, fontWeight: 600 }}>Add your app</h2>
                <p style={{ fontSize: 13.5, color: "#55534E", lineHeight: 1.5 }}>
                  Use the app you gave TreeVook access to in the last step.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <label htmlFor={`${ids}-title`} style={{ fontWeight: 500 }}>
                  App name
                </label>
                <input
                  id={`${ids}-title`}
                  className="rp-input"
                  placeholder="Acme Shop"
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={titleProblem ? true : undefined}
                  aria-describedby={titleProblem ? `${ids}-title-hint` : undefined}
                />
                {titleProblem ? (
                  <span id={`${ids}-title-hint`} style={{ color: "#B42318", fontSize: 12 }}>
                    {titleProblem}
                  </span>
                ) : null}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <label htmlFor={`${ids}-pkg`} style={{ fontWeight: 500 }}>
                  Package name
                </label>
                <input
                  id={`${ids}-pkg`}
                  className="rp-input rp-mono"
                  placeholder="com.acme.shop"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={pkg}
                  onChange={(e) => setPkg(e.target.value)}
                  aria-invalid={pkgProblem ? true : undefined}
                  aria-describedby={`${ids}-pkg-hint`}
                />
                <span
                  id={`${ids}-pkg-hint`}
                  style={{ color: pkgProblem ? "#B42318" : MUTED, fontSize: 12 }}
                >
                  {pkgProblem ??
                    "Find it in your Play Store link after id=, or in Play Console under the app's name."}
                </span>
              </div>
              {add.error ? (
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
                  <span style={{ fontWeight: 600 }}>
                    {addCode === "access"
                      ? "TreeVook can't see this app yet"
                      : addCode === "not_found"
                        ? "This app wasn't found"
                        : "The app couldn't be added"}
                  </span>
                  <span>
                    <Linked text={errorMessage(add.error)} />
                  </span>
                  {addCode === "access" ? (
                    <span>
                      Invites can take a few minutes to reach Google Play.{" "}
                      <button
                        type="button"
                        className="rp-btn-text"
                        style={{ color: "inherit", textDecoration: "underline" }}
                        onClick={() => go(1)}
                      >
                        Check the invite steps
                      </button>{" "}
                      and try again.
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  className="rp-btn"
                  style={{ padding: "10px 14px", fontSize: 13.5 }}
                  disabled={add.isPending || !account.data}
                >
                  {add.isPending ? <Spinner /> : null}
                  {add.isPending ? "Checking access…" : "Add app"}
                </button>
                <button type="button" className="rp-btn-quiet" onClick={() => go(1)}>
                  Back
                </button>
              </div>
            </form>
          )}
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 90 }}
        >
          <div style={{ height: 300, borderRadius: 14, overflow: "hidden" }}>
            <StateArt
              kind={ART[step]!}
              email={email || undefined}
              caption={step === 2 ? title.trim() : undefined}
              detail={step === 2 ? packageName : undefined}
              stage={step === 2 && add.isPending ? 1 : 0}
            />
          </div>
          <p
            style={{
              fontSize: 13,
              color: "#55534E",
              lineHeight: 1.5,
              padding: "0 4px",
              textWrap: "pretty",
            }}
          >
            {CAPTION[step]}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
        <Link href="/reviews/connect?method=key" className="rp-btn-text">
          Use your own service account key instead →
        </Link>
        <Link href="/reviews/mcp" className="rp-btn-text">
          Use MCP instead →
        </Link>
      </div>
    </div>
  );
}
