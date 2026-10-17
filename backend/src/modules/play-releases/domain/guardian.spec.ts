import {
  DEFAULT_GUARDIAN,
  dailyRates,
  describeBreach,
  healthByVersion,
  judge,
  previousVersion,
  validGuardian,
  VersionHealth,
} from "./guardian";
import { VitalsRow } from "./ports/releases-api";

const on = { ...DEFAULT_GUARDIAN, enabled: true };

const v = (
  versionCode: string,
  crashRate: number | null,
  anrRate: number | null,
  users = 5000,
): VersionHealth => ({ versionCode, crashRate, anrRate, users });

describe("judge", () => {
  it("waits until enough users ran the new version", () => {
    const out = judge(on, v("240", 3, 1, 120), v("231", 0.5, 0.2));
    expect(out).toEqual({
      action: "wait",
      reason: expect.stringContaining("120 users"),
    });
    expect(judge(on, null, v("231", 0.5, 0.2)).action).toBe("wait");
  });

  it("halts when the crash rate is over the limit and worse than before", () => {
    const out = judge(on, v("240", 2.31, 0.3), v("231", 0.62, 0.21));
    expect(out).toEqual({
      action: "halt",
      breaches: [
        { metric: "crash", rate: 2.31, threshold: 1.09, previousRate: 0.62 },
      ],
    });
  });

  it("halts on ANR spikes on their own", () => {
    const out = judge(on, v("240", 0.4, 0.9), v("231", 0.5, 0.2));
    expect(out.action).toBe("halt");
    if (out.action === "halt")
      expect(out.breaches.map((b) => b.metric)).toEqual(["anr"]);
  });

  it("does not halt a version that is no worse than the one it replaces", () => {
    expect(judge(on, v("240", 1.5, 0.3), v("231", 1.8, 0.3))).toEqual({
      action: "ok",
    });
  });

  it("halts over the limit when there is no previous version to compare", () => {
    expect(judge(on, v("240", 1.2, 0.1), null).action).toBe("halt");
  });

  it("keeps healthy rollouts going and respects custom limits", () => {
    expect(judge(on, v("240", 0.9, 0.3), v("231", 0.5, 0.2))).toEqual({
      action: "ok",
    });
    expect(
      judge(
        { ...on, maxCrashRate: 0.8 },
        v("240", 0.9, 0.3),
        v("231", 0.5, 0.2),
      ).action,
    ).toBe("halt");
  });

  it("treats the threshold itself as acceptable", () => {
    expect(judge(on, v("240", 1.09, 0.47), v("231", 0.2, 0.1)).action).toBe(
      "ok",
    );
  });
});

describe("health aggregation", () => {
  const rows: VitalsRow[] = [
    { day: "2026-10-10", versionCode: "231", rate: 0.01, users: 1000 },
    { day: "2026-10-14", versionCode: "231", rate: 0.004, users: 1000 },
    { day: "2026-10-15", versionCode: "231", rate: 0.006, users: 3000 },
    { day: "2026-10-15", versionCode: "240", rate: 0.03, users: 1000 },
    { day: "2026-10-16", versionCode: "240", rate: null, users: 500 },
  ];

  it("weights rates by users inside the window and reports percentages", () => {
    const health = healthByVersion(rows, [], "2026-10-12");
    expect(health.get("231")).toEqual({
      versionCode: "231",
      crashRate: 0.55,
      anrRate: null,
      users: 4000,
    });
    expect(health.get("240")?.crashRate).toBe(3);
  });

  it("builds a daily series across versions", () => {
    expect(dailyRates(rows)).toEqual([
      { day: "2026-10-10", users: 1000, rate: 1 },
      { day: "2026-10-14", users: 1000, rate: 0.4 },
      { day: "2026-10-15", users: 4000, rate: 1.2 },
      { day: "2026-10-16", users: 0, rate: null },
    ]);
  });

  it("compares with the live release, or the closest lower version", () => {
    const health = new Map([
      ["229", v("229", 0.7, 0.2)],
      ["231", v("231", 0.6, 0.2)],
      ["240", v("240", 2, 0.2)],
    ]);
    expect(previousVersion(health, "240", "229")?.versionCode).toBe("229");
    expect(previousVersion(health, "240", null)?.versionCode).toBe("231");
    expect(previousVersion(health, "240", "300")?.versionCode).toBe("231");
    expect(previousVersion(health, "229", null)).toBeNull();
  });
});

describe("guardian settings", () => {
  it("explains a breach in plain language", () => {
    expect(
      describeBreach({
        metric: "crash",
        rate: 2.31,
        threshold: 1.09,
        previousRate: 0.62,
      }),
    ).toBe(
      "User-perceived crash rate 2.31% is over the 1.09% limit (previous version 0.62%)",
    );
  });

  it("rejects impossible limits", () => {
    expect(validGuardian(on)).toBeNull();
    expect(validGuardian({ ...on, maxCrashRate: 0 })).toContain("crash");
    expect(validGuardian({ ...on, maxAnrRate: 120 })).toContain("ANR");
    expect(validGuardian({ ...on, minUsers: 1.5 })).toContain("minimum");
  });
});
