import { ReleaseData, TrackData } from "./ports/releases-api";
import { applyRollout, promote, setNotes, sortTracks } from "./rollout";

const release = (
  code: string,
  status: ReleaseData["status"],
  userFraction: number | null = null,
): ReleaseData => ({
  name: `v${code}`,
  versionCodes: [code],
  status,
  userFraction,
  releaseNotes: [{ language: "en-US", text: `Notes ${code}` }],
});

const production: TrackData = {
  track: "production",
  releases: [release("231", "completed"), release("240", "inProgress", 0.1)],
};

describe("applyRollout", () => {
  it("increases a staged rollout and keeps the live release", () => {
    const out = applyRollout(production, "increase", 0.5);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.summary).toBe(
      "Increase the rollout of v240 from 10% to 50%",
    );
    expect(
      out.value.track.releases.map((r) => [
        r.versionCodes[0],
        r.status,
        r.userFraction,
      ]),
    ).toEqual([
      ["231", "completed", null],
      ["240", "inProgress", 0.5],
    ]);
  });

  it("refuses to lower a rollout or use an invalid percentage", () => {
    expect(applyRollout(production, "increase", 0.05)).toMatchObject({
      ok: false,
      problem: expect.stringContaining("already at 10%"),
    });
    expect(applyRollout(production, "increase", 1).ok).toBe(false);
    expect(applyRollout(production, "increase").ok).toBe(false);
  });

  it("halts, then resumes at the same or a higher percentage", () => {
    const halted = applyRollout(production, "halt");
    if (!halted.ok) throw new Error(halted.problem);
    expect(halted.value.release).toMatchObject({
      status: "halted",
      userFraction: 0.1,
    });
    expect(applyRollout(halted.value.track, "halt").ok).toBe(false);
    const resumed = applyRollout(halted.value.track, "resume");
    expect(resumed).toMatchObject({
      ok: true,
      value: { release: { status: "inProgress", userFraction: 0.1 } },
    });
    expect(applyRollout(halted.value.track, "resume", 0.05).ok).toBe(false);
    expect(applyRollout(production, "resume").ok).toBe(false);
  });

  it("completes a rollout and retires the previous release", () => {
    const out = applyRollout(
      {
        ...production,
        releases: [...production.releases, release("250", "draft")],
      },
      "complete",
    );
    if (!out.ok) throw new Error(out.problem);
    expect(
      out.value.track.releases.map((r) => [r.versionCodes[0], r.status]),
    ).toEqual([
      ["250", "draft"],
      ["240", "completed"],
    ]);
    expect(out.value.release.userFraction).toBeNull();
  });

  it("explains when there is no staged rollout", () => {
    expect(
      applyRollout(
        { track: "beta", releases: [release("250", "completed")] },
        "halt",
      ),
    ).toEqual({
      ok: false,
      problem: "There's no staged rollout on Open testing.",
    });
  });
});

describe("promote", () => {
  const beta: TrackData = {
    track: "beta",
    releases: [release("250", "completed")],
  };
  const live: TrackData = {
    track: "production",
    releases: [release("231", "completed")],
  };

  it("starts a staged rollout on production with the source notes", () => {
    const out = promote(beta, live, { mode: "staged", fraction: 0.05 });
    if (!out.ok) throw new Error(out.problem);
    expect(out.value.summary).toBe(
      "Start a staged rollout of v250 on Production at 5%",
    );
    expect(
      out.value.track.releases.map((r) => [
        r.versionCodes[0],
        r.status,
        r.userFraction,
      ]),
    ).toEqual([
      ["231", "completed", null],
      ["250", "inProgress", 0.05],
    ]);
    expect(out.value.release.releaseNotes).toEqual([
      { language: "en-US", text: "Notes 250" },
    ]);
  });

  it("releases to everyone or saves a draft", () => {
    const full = promote(beta, live, { mode: "completed" });
    if (!full.ok) throw new Error(full.problem);
    expect(full.value.track.releases.map((r) => r.status)).toEqual([
      "completed",
    ]);
    const draft = promote(beta, live, { mode: "draft" });
    if (!draft.ok) throw new Error(draft.problem);
    expect(draft.value.track.releases.map((r) => r.status)).toEqual([
      "completed",
      "draft",
    ]);
  });

  it("refuses older builds, missing releases and bad percentages", () => {
    expect(promote(live, beta, { mode: "completed" }).ok).toBe(false);
    expect(
      promote({ track: "alpha", releases: [] }, live, { mode: "completed" }),
    ).toEqual({
      ok: false,
      problem: "Closed testing has no release to promote.",
    });
    expect(promote(beta, live, { mode: "staged" }).ok).toBe(false);
    expect(promote(beta, beta, { mode: "completed" }).ok).toBe(false);
    expect(
      promote(beta, live, { mode: "completed", versionCodes: ["999"] }).ok,
    ).toBe(false);
  });
});

describe("setNotes", () => {
  it("replaces the notes of one release and drops empty languages", () => {
    const out = setNotes(production, "240", [
      { language: "en-US", text: " New checkout " },
      { language: "hi-IN", text: "नया चेकआउट" },
      { language: "es-419", text: "" },
    ]);
    if (!out.ok) throw new Error(out.problem);
    expect(out.value.release.releaseNotes).toEqual([
      { language: "en-US", text: "New checkout" },
      { language: "hi-IN", text: "नया चेकआउट" },
    ]);
    expect(out.value.track.releases[0]!.releaseNotes[0]!.text).toBe(
      "Notes 231",
    );
  });

  it("enforces Google's limits", () => {
    expect(
      setNotes(production, "240", [
        { language: "en-US", text: "x".repeat(501) },
      ]),
    ).toMatchObject({ ok: false, problem: expect.stringContaining("500") });
    expect(setNotes(production, "999", []).ok).toBe(false);
    expect(
      setNotes(production, "240", [
        { language: "en-US", text: "a" },
        { language: "en-US", text: "b" },
      ]).ok,
    ).toBe(false);
  });
});

it("orders tracks from production to internal, then custom tracks", () => {
  const names = sortTracks(
    ["qa", "internal", "alpha", "production", "beta", "wear:beta"].map(
      (track) => ({
        track,
        releases: [],
      }),
    ),
  ).map((t) => t.track);
  expect(names).toEqual([
    "production",
    "beta",
    "alpha",
    "internal",
    "qa",
    "wear:beta",
  ]);
});
