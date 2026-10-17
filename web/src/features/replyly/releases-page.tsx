"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  usePromote,
  useReleases,
  useRollout,
  type Release,
  type ReleaseEvent,
  type ReleaseTrack,
  type ReleasesOverview,
} from "@/lib/api/play-releases";

import { GuardianCard } from "./guardian-card";
import { ReleaseNotesCard } from "./release-notes-card";
import { AppPicker, LoadError, NoApps, StatusPill, useSelectedApp } from "./releases-common";
import { Select } from "./select";
import { A, ago, rowBorder } from "./tokens";
import { Banner, PageHead, Section, Seg, Skel, Spinner, useToast } from "./ui";

const STEPS = [1, 2, 5, 10, 20, 50];
const PROMOTE_ORDER = ["internal", "alpha", "beta", "production"];

const label = (r: Release) => r.name || r.versionCodes.join(", ");
const staged = (t: ReleaseTrack) =>
  t.releases.find((r) => r.status === "inProgress" || r.status === "halted") ?? null;

export function ReleasesPage() {
  const { app, apps, choose } = useSelectedApp();
  const overview = useReleases(app?.id ?? null);

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHead
        title="Releases"
        sub="Tracks, staged rollouts and release notes, straight from Google Play."
        actions={<AppPicker value={app?.id ?? null} onChange={choose} />}
      />
      {!apps.length ? (
        <NoApps />
      ) : overview.error ? (
        <LoadError error={overview.error} />
      ) : !overview.data ? (
        <div style={{ display: "grid", gap: 12 }}>
          <Skel h={140} r={14} />
          <Skel h={220} r={14} />
        </div>
      ) : (
        <Overview data={overview.data} />
      )}
    </div>
  );
}

function Overview({ data }: { data: ReleasesOverview }) {
  const halted = data.tracks.flatMap((t) =>
    t.releases.filter((r) => r.status === "halted").map((r) => ({ t, r })),
  );
  return (
    <>
      {halted.length ? (
        <Banner tone="warn" title="A rollout is halted">
          {halted
            .map(({ t, r }) => `${label(r)} on ${t.label} is paused at ${r.rolloutPercent}%.`)
            .join(" ")}{" "}
          {data.guardian.lastStatus === "halted" && data.guardian.lastMessage
            ? data.guardian.lastMessage
            : "Resume it when you're ready, or promote a fixed build."}
        </Banner>
      ) : null}
      <Section
        title="Tracks"
        desc="Every change opens a Google Play edit and commits it right away."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
            gap: 12,
          }}
        >
          {data.tracks.map((t) => (
            <Lane key={t.track} appId={data.app.id} track={t} tracks={data.tracks} />
          ))}
        </div>
      </Section>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <ReleaseNotesCard data={data} />
        <GuardianCard appId={data.app.id} guardian={data.guardian} />
      </div>
      <Activity events={data.events} />
    </>
  );
}

function Lane({
  appId,
  track,
  tracks,
}: {
  appId: string;
  track: ReleaseTrack;
  tracks: ReleaseTrack[];
}) {
  const [promoting, setPromoting] = useState(false);
  const rolling = staged(track);
  const promotable = track.releases.some((r) => r.status !== "draft");
  return (
    <div
      className="rp-card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{track.label}</span>
          <span className="rp-mono" style={{ fontSize: 11, color: "#6C6962" }}>
            {track.track}
          </span>
        </div>
        {promotable && !promoting ? (
          <button type="button" className="rp-btn-text" onClick={() => setPromoting(true)}>
            Promote →
          </button>
        ) : null}
      </div>
      {track.releases.length ? (
        track.releases.map((r, i) => (
          <div
            key={r.versionCodes.join(",") + r.status}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingTop: i ? 12 : 0,
              borderTop: rowBorder(i),
            }}
          >
            <ReleaseRow release={r} />
            {r === rolling ? <RolloutControls appId={appId} track={track} release={r} /> : null}
          </div>
        ))
      ) : (
        <span style={{ fontSize: 12.5, color: "#6C6962" }}>No releases on this track.</span>
      )}
      {promoting ? (
        <PromotePanel
          appId={appId}
          from={track}
          tracks={tracks}
          onDone={() => setPromoting(false)}
        />
      ) : null}
    </div>
  );
}

function ReleaseRow({ release }: { release: Release }) {
  const p = release.rolloutPercent ?? 0;
  const live = release.status === "inProgress" || release.status === "halted";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}
      >
        <span style={{ fontWeight: 500, minWidth: 0, overflowWrap: "anywhere" }}>
          {label(release)}
        </span>
        <StatusPill status={release.status} />
      </div>
      <span className="rp-mono" style={{ fontSize: 11.5, color: "#6C6962" }}>
        {release.versionCodes.length > 1 ? "codes" : "code"} {release.versionCodes.join(", ")}
        {release.notes.length ? ` · notes in ${release.notes.length}` : ""}
      </span>
      {live ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            role="progressbar"
            aria-label={`${label(release)} rollout`}
            aria-valuenow={p}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              background: "#F4F2EE",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(p, 1)}%`,
                height: "100%",
                borderRadius: 999,
                background: release.status === "halted" ? "#B42318" : A,
              }}
            />
          </div>
          <span className="rp-mono" style={{ fontSize: 12, minWidth: 44, textAlign: "right" }}>
            {p}%
          </span>
        </div>
      ) : null}
    </div>
  );
}

type Pending = {
  action: "increase" | "halt" | "resume" | "complete";
  fraction?: number;
  text: string;
};

function RolloutControls({
  appId,
  track,
  release,
}: {
  appId: string;
  track: ReleaseTrack;
  release: Release;
}) {
  const toast = useToast();
  const rollout = useRollout(appId);
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const current = release.rolloutPercent ?? 0;
  const name = label(release);
  const halted = release.status === "halted";

  const confirm = () => {
    if (!pending) return;
    rollout.mutate(
      { track: track.track, action: pending.action, fraction: pending.fraction },
      {
        onSuccess: (r) => {
          toast(r.summary);
          setPending(null);
          setPicking(false);
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  if (pending)
    return (
      <div
        role="group"
        aria-label="Confirm rollout change"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 10,
          borderRadius: 10,
          background: pending.action === "halt" ? "#FDF0EE" : "#F7F6F3",
        }}
      >
        <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{pending.text}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="rp-btn" disabled={rollout.isPending} onClick={confirm}>
            {rollout.isPending ? <Spinner /> : null} Confirm
          </button>
          <button
            type="button"
            className="rp-btn-light"
            disabled={rollout.isPending}
            onClick={() => setPending(null)}
          >
            Cancel
          </button>
        </div>
      </div>
    );

  const steps = STEPS.filter((s) => s > current);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          className="rp-btn-light"
          style={{ padding: "5px 10px", fontSize: 12.5 }}
          aria-expanded={picking}
          onClick={() => setPicking((p) => !p)}
        >
          Increase
        </button>
        {halted ? (
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "5px 10px", fontSize: 12.5 }}
            onClick={() =>
              setPending({
                action: "resume",
                text: `Resume the rollout of ${name} at ${current}% of users on ${track.label}?`,
              })
            }
          >
            Resume
          </button>
        ) : (
          <button
            type="button"
            className="rp-btn-light rp-btn-danger"
            style={{ padding: "5px 10px", fontSize: 12.5 }}
            onClick={() =>
              setPending({
                action: "halt",
                text: `Halt the rollout of ${name} at ${current}%? New users stop getting it; people who already updated keep it.`,
              })
            }
          >
            Halt
          </button>
        )}
        <button
          type="button"
          className="rp-btn-light"
          style={{ padding: "5px 10px", fontSize: 12.5 }}
          onClick={() =>
            setPending({
              action: "complete",
              text: `Complete the rollout of ${name} to 100% of ${track.label} users? This can't be undone; a later build is the only way back.`,
            })
          }
        >
          Complete
        </button>
      </div>
      {picking ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6C6962" }}>To</span>
          {steps.map((s) => (
            <button
              key={s}
              type="button"
              className="rp-chip rp-mono"
              onClick={() =>
                setPending({
                  action: "increase",
                  fraction: s / 100,
                  text: `${halted ? "Resume and increase" : "Increase"} the rollout of ${name} from ${current}% to ${s}% of ${track.label} users?`,
                })
              }
            >
              {s}%
            </button>
          ))}
          {!steps.length ? (
            <span style={{ fontSize: 12, color: "#6C6962" }}>
              Complete the rollout to go further.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PromotePanel({
  appId,
  from,
  tracks,
  onDone,
}: {
  appId: string;
  from: ReleaseTrack;
  tracks: ReleaseTrack[];
  onDone: () => void;
}) {
  const toast = useToast();
  const promote = usePromote(appId);
  const targets = tracks.filter((t) => t.track !== from.track);
  const next = PROMOTE_ORDER[PROMOTE_ORDER.indexOf(from.track) + 1];
  const [to, setTo] = useState(
    targets.find((t) => t.track === next)?.track ?? targets[0]?.track ?? "production",
  );
  const [mode, setMode] = useState<"staged" | "completed" | "draft">(
    to === "production" ? "staged" : "completed",
  );
  const [percent, setPercent] = useState("10");
  const [confirming, setConfirming] = useState(false);
  const source = [...from.releases]
    .filter((r) => r.status !== "draft")
    .sort(
      (a, b) => Math.max(...b.versionCodes.map(Number)) - Math.max(...a.versionCodes.map(Number)),
    )[0];
  const target = targets.find((t) => t.track === to);
  const value = Number(percent);
  const validPercent = value > 0 && value < 100;
  if (!source || !target) return null;

  const text =
    mode === "staged"
      ? `Start a staged rollout of ${label(source)} on ${target.label} at ${value}% of users?`
      : mode === "completed"
        ? `Release ${label(source)} to 100% of ${target.label} users?`
        : `Save ${label(source)} as a draft on ${target.label}?`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        borderRadius: 10,
        background: "#F7F6F3",
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 500 }}>Promote {label(source)}</span>
      <Select
        label="Promote to"
        value={to}
        block
        align="start"
        onChange={(v) => {
          setTo(v);
          setConfirming(false);
        }}
        options={targets.map((t) => ({ value: t.track, label: t.label }))}
      />
      <Seg
        label="How to release"
        small
        value={mode}
        onChange={(m) => {
          setMode(m);
          setConfirming(false);
        }}
        options={[
          { id: "staged", label: "Staged" },
          { id: "completed", label: "Everyone" },
          { id: "draft", label: "Draft" },
        ]}
      />
      {mode === "staged" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
          Start at
          <input
            className="rp-input rp-mono"
            type="number"
            min={0.1}
            max={99.9}
            step={0.1}
            value={percent}
            onChange={(e) => {
              setPercent(e.target.value);
              setConfirming(false);
            }}
            style={{ width: 80 }}
          />
          % of users
        </label>
      ) : null}
      {confirming ? <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{text}</span> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="rp-btn"
          disabled={promote.isPending || (mode === "staged" && !validPercent)}
          onClick={() => {
            if (!confirming) return setConfirming(true);
            promote.mutate(
              {
                fromTrack: from.track,
                toTrack: to,
                versionCodes: source.versionCodes,
                mode,
                fraction: mode === "staged" ? value / 100 : undefined,
              },
              {
                onSuccess: (r) => {
                  toast(r.summary);
                  onDone();
                },
                onError: (err) => toast(errorMessage(err)),
              },
            );
          }}
        >
          {promote.isPending ? <Spinner /> : null} {confirming ? "Confirm" : "Promote"}
        </button>
        <button type="button" className="rp-btn-light" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const ACTOR: Record<string, string> = { user: "You", claude: "Claude", guardian: "Guardian" };

function Activity({ events }: { events: ReleaseEvent[] }) {
  return (
    <Section
      title="Activity"
      desc="Changes made here, by Claude through the connector, and by the rollout guardian."
    >
      <div className="rp-card" style={{ overflow: "hidden" }}>
        {events.length ? (
          events.map((e, i) => (
            <div
              key={e.id}
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 16px",
                borderTop: rowBorder(i),
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: e.actor === "guardian" ? "#B42318" : "#55534E",
                  minWidth: 64,
                }}
              >
                {ACTOR[e.actor] ?? e.actor}
              </span>
              <span style={{ flex: "1 1 260px", fontSize: 13, lineHeight: 1.5 }}>{e.message}</span>
              <span className="rp-mono" style={{ fontSize: 11.5, color: "#6C6962" }}>
                {ago(e.createdAt)}
              </span>
            </div>
          ))
        ) : (
          <div style={{ padding: 16, fontSize: 13, color: "#6C6962" }}>No release changes yet.</div>
        )}
      </div>
    </Section>
  );
}
