import {
  AppSettings,
  QuietHours,
  ReviewFacts,
  Rule,
  RuleConditions,
} from "./play.types";

const lower = (s: string) => s.toLowerCase();
const langBase = (l: string) => lower(l).split(/[-_]/)[0] ?? "";

function haystack(facts: ReviewFacts): string {
  return lower(`${facts.text}\n${facts.originalText ?? ""}`);
}

export function matches(
  conditions: RuleConditions,
  facts: ReviewFacts,
): boolean {
  const c = conditions;
  if (c.stars?.length && !c.stars.includes(facts.stars)) return false;
  if (c.edited !== undefined && c.edited !== facts.editedAfterReply)
    return false;
  const text = haystack(facts);
  if (
    c.keywordsAny?.length &&
    !c.keywordsAny.some((k) => k.trim() && text.includes(lower(k.trim())))
  )
    return false;
  if (c.keywordsNone?.some((k) => k.trim() && text.includes(lower(k.trim()))))
    return false;
  if (c.languages?.length) {
    if (!facts.language) return false;
    const lang = langBase(facts.language);
    if (!c.languages.some((l) => langBase(l) === lang)) return false;
  }
  if (c.appVersions?.length) {
    const version = facts.appVersionName ?? "";
    if (
      !c.appVersions.some((v) => version === v || version.startsWith(`${v}.`))
    )
      return false;
  }
  return true;
}

export function firstMatch(rules: Rule[], facts: ReviewFacts): Rule | null {
  return rules.find((r) => r.enabled && matches(r.conditions, facts)) ?? null;
}

export function neverAutoWord(
  facts: ReviewFacts,
  words: string[],
): string | null {
  const text = haystack(facts);
  return words.find((w) => w.trim() && text.includes(lower(w.trim()))) ?? null;
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function localMinutes(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

export function minutesUntilQuietEnds(
  at: Date,
  quiet: QuietHours | null,
  timezone: string,
): number {
  if (!quiet) return 0;
  const start = minutesOf(quiet.start);
  const end = minutesOf(quiet.end);
  if (start === end) return 0;
  const now = localMinutes(at, timezone);
  const inside =
    start < end ? now >= start && now < end : now >= start || now < end;
  if (!inside) return 0;
  return (end - now + 1440) % 1440;
}

export function sendTime(
  now: Date,
  delayMinutes: number,
  settings: Pick<AppSettings, "quietHours" | "timezone">,
): Date {
  const base = new Date(now.getTime() + delayMinutes * 60_000);
  const wait = minutesUntilQuietEnds(
    base,
    settings.quietHours,
    settings.timezone,
  );
  if (!wait) return base;
  const jitter = Math.floor((base.getTime() / 1000) % 1200);
  return new Date(base.getTime() + wait * 60_000 + jitter * 1000);
}

export type Decision =
  | { kind: "none"; reason: string }
  | { kind: "claude"; ruleId: string }
  | {
      kind: "template";
      ruleId: string;
      templateId: string;
      auto: boolean;
      sendAt: Date | null;
      heldBecause: string | null;
    };

export function decide(input: {
  facts: ReviewFacts;
  hasReply: boolean;
  rules: Rule[];
  settings: AppSettings;
  autoSentToday: number;
  firstSync: boolean;
  now: Date;
}): Decision {
  const { facts, settings } = input;
  if (input.hasReply && !facts.editedAfterReply)
    return { kind: "none", reason: "already replied" };
  if (facts.editedAfterReply && !settings.replyToEdited)
    return { kind: "none", reason: "edited reviews are left alone" };
  const rule = firstMatch(input.rules, facts);
  if (!rule) return { kind: "none", reason: "no rule matches" };
  if (rule.action.type === "skip")
    return { kind: "none", reason: `skipped by ${rule.name}` };
  if (rule.action.type === "claude") return { kind: "claude", ruleId: rule.id };
  let held: string | null = null;
  if (rule.mode === "auto") {
    const word = neverAutoWord(facts, settings.neverAutoWords);
    if (input.firstSync)
      held = "Reviews found when the app was added always wait for approval.";
    else if (word) held = `Mentions "${word}", so it needs your approval.`;
    else if (input.autoSentToday >= settings.dailyAutoLimit)
      held = `Today's limit of ${settings.dailyAutoLimit} automatic replies is reached.`;
  }
  const auto = rule.mode === "auto" && !held;
  return {
    kind: "template",
    ruleId: rule.id,
    templateId: rule.action.templateId,
    auto,
    sendAt: auto ? sendTime(input.now, rule.delayMinutes, settings) : null,
    heldBecause: held,
  };
}
