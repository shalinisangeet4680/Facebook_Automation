import {
  decide,
  firstMatch,
  matches,
  minutesUntilQuietEnds,
  sendTime,
} from "./automation";
import { DEFAULT_SETTINGS, ReviewFacts, Rule } from "./play.types";
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
  it("route reviews to the right template", () => {
    expect(pick(facts({ stars: 5 }))).toEqual({
      type: "template",
      templateId: "thanks",
    });
    expect(pick(facts({ stars: 1, text: "Terrible" }))).toEqual({
      type: "template",
      templateId: "negative",
    });
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
    expect(pick(facts({ stars: 3, text: "ok" }))).toEqual({
      type: "template",
      templateId: "neutral",
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
  const base = {
    hasReply: false,
    rules: auto,
    settings: DEFAULT_SETTINGS,
    autoSentToday: 0,
    firstSync: false,
    now,
  };

  it("schedules an automatic reply after the rule's delay", () => {
    const d = decide({ ...base, facts: facts() });
    expect(d).toMatchObject({
      kind: "template",
      templateId: "thanks",
      auto: true,
      heldBecause: null,
    });
    if (d.kind === "template")
      expect(d.sendAt?.toISOString()).toBe("2026-10-16T08:00:00.000Z");
  });

  it("holds automatic replies for risky words, the daily limit and the first sync", () => {
    expect(
      decide({ ...base, facts: facts({ stars: 1, text: "This is a scam" }) }),
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
        settings: { ...DEFAULT_SETTINGS, replyToEdited: false },
        facts: facts({ editedAfterReply: true }),
      }),
    ).toMatchObject({ kind: "none" });
  });

  it("sends to Claude or skips when the rule says so", () => {
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
    expect(decide({ ...base, rules: [], facts: facts() })).toEqual({
      kind: "none",
      reason: "no rule matches",
    });
  });
});
