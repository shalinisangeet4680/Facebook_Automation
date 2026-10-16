import {
  decide,
  ratingDrop,
  firstMatch,
  matches,
  minutesUntilQuietEnds,
  sendTime,
} from "./automation";
import { AppSettings, DEFAULT_SETTINGS, ReviewFacts, Rule } from "./play.types";
import { BUG_WORDS, PRESET_RULES } from "./presets";

const facts = (over: Partial<ReviewFacts> = {}): ReviewFacts => ({
  reviewId: "r1",
  authorName: "Priya Sharma",
  stars: 5,
  text: "Love it",
  originalText: null,
  language: "en",
  appVersionName: "2.3.1",
  editedAfterReply: false,
  ...over,
});

const rules: Rule[] = PRESET_RULES.map((r, i) => ({
  id: `rule-${i}`,
  name: r.name,
  enabled: true,
  conditions: r.conditions,
  action: { type: "template", templateId: r.templateKey },
  mode: r.mode,
  delayMinutes: r.delayMinutes,
}));

describe("matches", () => {
  it("checks stars, keywords in either language, language, version and edits", () => {
    expect(matches({ stars: [1, 2] }, facts({ stars: 2 }))).toBe(true);
    expect(matches({ stars: [1, 2] }, facts({ stars: 3 }))).toBe(false);
    expect(
      matches(
        { keywordsAny: ["crash"] },
        facts({ text: "App closes", originalText: "App CRASHES daily" }),
      ),
    ).toBe(true);
    expect(
      matches({ keywordsNone: ["refund"] }, facts({ text: "want a refund" })),
    ).toBe(false);
    expect(matches({ languages: ["pt"] }, facts({ language: "pt_BR" }))).toBe(
      true,
    );
    expect(matches({ languages: ["pt"] }, facts({ language: null }))).toBe(
      false,
    );
    expect(matches({ appVersions: ["2.3"] }, facts())).toBe(true);
    expect(matches({ appVersions: ["2.30"] }, facts())).toBe(false);
    expect(matches({ edited: true }, facts())).toBe(false);
  });
});

describe("preset rules", () => {
  const pick = (f: ReviewFacts) => firstMatch(rules, f)?.action;
  it("catch bugs, payments and raised ratings before the per-rating rules", () => {
    expect(pick(facts({ stars: 5 }))).toBeUndefined();
    expect(pick(facts({ stars: 2, text: "It keeps crashing" }))).toEqual({
      type: "template",
      templateId: "bug",
    });
    expect(
      pick(facts({ stars: 1, text: "Money deducted, no refund" })),
    ).toEqual({
      type: "template",
      templateId: "billing",
    });
    expect(pick(facts({ stars: 5, editedAfterReply: true }))).toEqual({
      type: "template",
      templateId: "updated",
    });
    expect(BUG_WORDS).toContain("crash");
  });
});

describe("quiet hours", () => {
  const ist = "Asia/Kolkata";
  const quiet = { start: "22:00", end: "08:00" };
  it("waits until the window ends, across midnight", () => {
    expect(
      minutesUntilQuietEnds(new Date("2026-10-16T17:30:00Z"), quiet, ist),
    ).toBe(540);
    expect(
      minutesUntilQuietEnds(new Date("2026-10-16T21:30:00Z"), quiet, ist),
    ).toBe(300);
    expect(
      minutesUntilQuietEnds(new Date("2026-10-16T06:30:00Z"), quiet, ist),
    ).toBe(0);
    expect(
      minutesUntilQuietEnds(new Date("2026-10-16T17:30:00Z"), null, ist),
    ).toBe(0);
    expect(
      minutesUntilQuietEnds(
        new Date("2026-10-16T05:00:00Z"),
        { start: "09:00", end: "17:00" },
        ist,
      ),
    ).toBe(390);
  });

  it("schedules after the delay and pushes into the morning", () => {
    const day = sendTime(new Date("2026-10-16T06:30:00Z"), 30, {
      timezone: ist,
      quietHours: quiet,
    });
    expect(day.toISOString()).toBe("2026-10-16T07:00:00.000Z");
    const night = sendTime(new Date("2026-10-16T17:00:00Z"), 60, {
      timezone: ist,
      quietHours: quiet,
    });
    expect(night.getTime()).toBeGreaterThanOrEqual(
      Date.parse("2026-10-17T02:30:00Z"),
    );
    expect(night.getTime()).toBeLessThan(Date.parse("2026-10-17T02:50:00Z"));
  });
});

describe("decide", () => {
  const now = new Date("2026-10-16T06:30:00Z");
  const auto = rules.map((r) => ({ ...r, mode: "auto" as const }));
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    delay: "1h",
    ratingRules: [
      { rating: 5, mode: "auto", templateId: "grateful" },
      { rating: 4, mode: "auto", templateId: "nudge" },
      { rating: 3, mode: "approval", templateId: null },
      { rating: 2, mode: "approval", templateId: "apology" },
      { rating: 1, mode: "manual", templateId: "apology" },
    ],
  };
  const base = {
    hasReply: false,
    rules: auto,
    settings,
    autoSentToday: 0,
    firstSync: false,
    now,
  };

  it("uses the rating's mode, template and the posting delay", () => {
    const d = decide({ ...base, facts: facts() });
    expect(d).toMatchObject({
      kind: "template",
      ruleId: null,
      templateId: "grateful",
      auto: true,
      heldBecause: null,
    });
    if (d.kind === "template")
      expect(d.sendAt?.toISOString()).toBe("2026-10-16T07:30:00.000Z");
    expect(
      decide({ ...base, facts: facts({ stars: 3, text: "ok" }) }),
    ).toMatchObject({
      kind: "template",
      templateId: null,
      auto: false,
    });
    expect(
      decide({ ...base, facts: facts({ stars: 1, text: "bad" }) }),
    ).toEqual({
      kind: "none",
      reason: "1-star reviews are answered by hand",
    });
  });

  it("runs advanced rules first", () => {
    const d = decide({
      ...base,
      facts: facts({ stars: 1, text: "It keeps crashing" }),
    });
    expect(d).toMatchObject({
      kind: "template",
      templateId: "bug",
      auto: true,
    });
    if (d.kind === "template")
      expect(d.sendAt?.toISOString()).toBe("2026-10-16T07:00:00.000Z");
  });

  it("skips star-only reviews when asked", () => {
    expect(decide({ ...base, facts: facts({ text: "" }) })).toEqual({
      kind: "none",
      reason: "star-only review",
    });
    expect(
      decide({
        ...base,
        settings: { ...settings, skipEmpty: false },
        facts: facts({ text: "" }),
      }),
    ).toMatchObject({ kind: "template" });
  });

  it("holds automatic replies for risky words, the daily limit, the first sync and a safety pause", () => {
    expect(
      decide({ ...base, facts: facts({ stars: 4, text: "This is a scam" }) }),
    ).toMatchObject({
      auto: false,
      heldBecause: 'Mentions "scam", so it needs your approval.',
    });
    expect(
      decide({ ...base, autoSentToday: 50, facts: facts() }),
    ).toMatchObject({
      auto: false,
      heldBecause: "Today's limit of 50 automatic replies is reached.",
    });
    expect(decide({ ...base, firstSync: true, facts: facts() })).toMatchObject({
      auto: false,
    });
    expect(
      decide({ ...base, pausedBecause: "Paused", facts: facts() }),
    ).toMatchObject({ auto: false, heldBecause: "Paused" });
  });

  it("leaves replied reviews alone unless they were edited", () => {
    expect(decide({ ...base, hasReply: true, facts: facts() })).toEqual({
      kind: "none",
      reason: "already replied",
    });
    expect(
      decide({
        ...base,
        hasReply: true,
        facts: facts({ editedAfterReply: true }),
      }),
    ).toMatchObject({ kind: "template", templateId: "updated" });
    expect(
      decide({
        ...base,
        hasReply: true,
        settings: { ...settings, replyToEdited: false },
        facts: facts({ editedAfterReply: true }),
      }),
    ).toMatchObject({ kind: "none" });
  });

  it("sends to Claude or skips when an advanced rule says so", () => {
    const claude: Rule = {
      ...auto[0]!,
      conditions: {},
      action: { type: "claude" },
    };
    expect(decide({ ...base, rules: [claude], facts: facts() })).toEqual({
      kind: "claude",
      ruleId: claude.id,
    });
    const skip: Rule = { ...claude, action: { type: "skip" } };
    expect(decide({ ...base, rules: [skip], facts: facts() })).toMatchObject({
      kind: "none",
    });
    expect(
      decide({
        ...base,
        rules: [],
        settings: DEFAULT_SETTINGS,
        facts: facts(),
      }),
    ).toEqual({ kind: "none", reason: "no rule matches" });
  });
});

describe("ratingDrop", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const at = (h: number, stars: number) => ({
    stars,
    reviewedAt: new Date(now.getTime() - h * 3_600_000),
  });
  it("compares the last day with the month before", () => {
    const before = Array.from({ length: 10 }, (_, i) => at(48 + i, 5));
    const recent = Array.from({ length: 5 }, (_, i) => at(2 + i, i ? 5 : 1));
    expect(ratingDrop([...before, ...recent], now)).toEqual({
      recent: 4.2,
      baseline: 5,
      drop: 0.8,
    });
    expect(ratingDrop(recent, now)).toBeNull();
  });
});
