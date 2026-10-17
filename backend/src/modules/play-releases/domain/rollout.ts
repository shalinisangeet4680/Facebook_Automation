import { ReleaseData, ReleaseNote, TrackData } from "./ports/releases-api";

export const ROLLOUT_ACTIONS = [
  "increase",
  "halt",
  "resume",
  "complete",
] as const;
export type RolloutAction = (typeof ROLLOUT_ACTIONS)[number];

export const PROMOTE_MODES = ["completed", "staged", "draft"] as const;
export type PromoteMode = (typeof PROMOTE_MODES)[number];

export const NOTE_MAX = 500;

const STANDARD = ["production", "beta", "alpha", "internal"];

export const TRACK_LABELS: Record<string, string> = {
  production: "Production",
  beta: "Open testing",
  alpha: "Closed testing",
  internal: "Internal testing",
};

export type Result<T> = { ok: true; value: T } | { ok: false; problem: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(problem: string): Result<T> => ({ ok: false, problem });

export function trackKind(track: string): "production" | "testing" | "custom" {
  if (track === "production") return "production";
  return STANDARD.includes(track) ? "testing" : "custom";
}

export function sortTracks(tracks: TrackData[]): TrackData[] {
  const rank = (t: string) => {
    const i = STANDARD.indexOf(t);
    return i < 0 ? STANDARD.length : i;
  };
  return [...tracks].sort(
    (a, b) => rank(a.track) - rank(b.track) || a.track.localeCompare(b.track),
  );
}

export const highestCode = (r: ReleaseData) =>
  Math.max(0, ...r.versionCodes.map(Number).filter(Number.isFinite));

export const percent = (fraction: number | null) =>
  fraction === null ? null : Math.round(fraction * 1000) / 10;

export function staged(track: TrackData): ReleaseData | null {
  return (
    track.releases.find(
      (r) => r.status === "inProgress" || r.status === "halted",
    ) ?? null
  );
}

export function liveRelease(track: TrackData): ReleaseData | null {
  return (
    [...track.releases]
      .filter((r) => r.status === "completed")
      .sort((a, b) => highestCode(b) - highestCode(a))[0] ?? null
  );
}

export function releaseLabel(r: ReleaseData) {
  return r.name || r.versionCodes.join(", ");
}

const validFraction = (f: number | undefined): f is number =>
  typeof f === "number" && Number.isFinite(f) && f > 0 && f < 1;

export function applyRollout(
  track: TrackData,
  action: RolloutAction,
  fraction?: number,
): Result<{ track: TrackData; release: ReleaseData; summary: string }> {
  const current = staged(track);
  if (!current)
    return fail(
      `There's no staged rollout on ${TRACK_LABELS[track.track] ?? track.track}.`,
    );
  const label = releaseLabel(current);
  const others = track.releases.filter((r) => r !== current);
  let next: ReleaseData;
  let releases: ReleaseData[];
  let summary: string;
  if (action === "halt") {
    if (current.status === "halted") return fail(`${label} is already halted.`);
    next = { ...current, status: "halted" };
    releases = [...others, next];
    summary = `Halt the rollout of ${label} at ${percent(current.userFraction)}%`;
  } else if (action === "resume") {
    if (current.status !== "halted")
      return fail(`${label} is rolling out; there's nothing to resume.`);
    const f = fraction ?? current.userFraction ?? undefined;
    if (!validFraction(f))
      return fail("Choose a rollout percentage between 0.1% and 99.9%.");
    if (current.userFraction !== null && f < current.userFraction)
      return fail(
        `Google Play can't lower a rollout. Choose ${percent(current.userFraction)}% or more.`,
      );
    next = { ...current, status: "inProgress", userFraction: f };
    releases = [...others, next];
    summary = `Resume the rollout of ${label} at ${percent(f)}%`;
  } else if (action === "increase") {
    if (!validFraction(fraction))
      return fail(
        "Choose a rollout percentage between 0.1% and 99.9%, or complete the rollout.",
      );
    if (current.userFraction !== null && fraction <= current.userFraction)
      return fail(
        `The rollout is already at ${percent(current.userFraction)}%. Choose a higher percentage.`,
      );
    next = { ...current, status: "inProgress", userFraction: fraction };
    releases = [...others, next];
    summary = `${current.status === "halted" ? "Resume and increase" : "Increase"} the rollout of ${label} from ${percent(current.userFraction)}% to ${percent(fraction)}%`;
  } else {
    next = { ...current, status: "completed", userFraction: null };
    releases = [...others.filter((r) => r.status === "draft"), next];
    summary = `Complete the rollout of ${label} to 100% of users`;
  }
  return ok({
    track: { track: track.track, releases },
    release: next,
    summary,
  });
}

export function promote(
  from: TrackData,
  to: TrackData,
  input: { versionCodes?: string[]; mode: PromoteMode; fraction?: number },
): Result<{ track: TrackData; release: ReleaseData; summary: string }> {
  if (from.track === to.track)
    return fail("Choose a different track to promote to.");
  const candidates = from.releases.filter((r) =>
    input.versionCodes?.length
      ? input.versionCodes.every((c) => r.versionCodes.includes(c))
      : r.status !== "draft",
  );
  const source = [...candidates].sort(
    (a, b) => highestCode(b) - highestCode(a),
  )[0];
  if (!source)
    return fail(
      `${TRACK_LABELS[from.track] ?? from.track} has no release to promote.`,
    );
  if (input.mode === "staged" && !validFraction(input.fraction))
    return fail("Choose a rollout percentage between 0.1% and 99.9%.");
  const live = liveRelease(to);
  if (
    live &&
    input.mode !== "draft" &&
    highestCode(live) >= highestCode(source)
  )
    return fail(
      `${TRACK_LABELS[to.track] ?? to.track} already serves version code ${highestCode(live)}; promote a newer release.`,
    );
  const base = {
    name: source.name,
    versionCodes: [...source.versionCodes],
    releaseNotes: source.releaseNotes.map((n) => ({ ...n })),
  };
  const toLabel = TRACK_LABELS[to.track] ?? to.track;
  const label = releaseLabel(source);
  let release: ReleaseData;
  let releases: ReleaseData[];
  let summary: string;
  if (input.mode === "completed") {
    release = { ...base, status: "completed", userFraction: null };
    releases = [...to.releases.filter((r) => r.status === "draft"), release];
    summary = `Release ${label} to 100% of ${toLabel}`;
  } else if (input.mode === "staged") {
    release = {
      ...base,
      status: "inProgress",
      userFraction: input.fraction!,
    };
    releases = [
      ...to.releases.filter(
        (r) => r.status === "completed" || r.status === "draft",
      ),
      release,
    ];
    summary = `Start a staged rollout of ${label} on ${toLabel} at ${percent(input.fraction!)}%`;
  } else {
    release = { ...base, status: "draft", userFraction: null };
    releases = [...to.releases.filter((r) => r.status !== "draft"), release];
    summary = `Save ${label} as a draft on ${toLabel}`;
  }
  return ok({ track: { track: to.track, releases }, release, summary });
}

const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export function setNotes(
  track: TrackData,
  versionCode: string,
  notes: ReleaseNote[],
): Result<{ track: TrackData; release: ReleaseData }> {
  const target = track.releases.find((r) =>
    r.versionCodes.includes(versionCode),
  );
  if (!target)
    return fail(
      `Version code ${versionCode} isn't on ${TRACK_LABELS[track.track] ?? track.track}.`,
    );
  const seen = new Set<string>();
  for (const n of notes) {
    if (!LANGUAGE.test(n.language))
      return fail(`${n.language} isn't a language code like en-US.`);
    if (seen.has(n.language))
      return fail(`${n.language} appears more than once.`);
    seen.add(n.language);
    if (n.text.trim().length > NOTE_MAX)
      return fail(
        `The ${n.language} notes are over ${NOTE_MAX} characters; shorten them.`,
      );
  }
  const release: ReleaseData = {
    ...target,
    releaseNotes: notes
      .filter((n) => n.text.trim())
      .map((n) => ({ language: n.language, text: n.text.trim() })),
  };
  return ok({
    track: {
      track: track.track,
      releases: track.releases.map((r) => (r === target ? release : r)),
    },
    release,
  });
}
