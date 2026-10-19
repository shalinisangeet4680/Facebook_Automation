import { pickWinner } from "@modules/ads/domain/variants";

export interface Metrics {
  spend: number;
  results: number;
  impressions: number;
  linkClicks: number;
  landingPageViews: number;
  frequency: number;
}

export interface AdInput {
  id: string;
  name: string;
  adSetId: string;
  active: boolean;
  current: Metrics;
  previous: Metrics | null;
}

export interface AdSetInput {
  id: string;
  name: string;
  active: boolean;
  dailyBudget: number | null;
  current: Metrics;
  days: number;
}

export interface VariantGroupInput {
  adSetId: string;
  ads: { id: string; label: string }[];
}

export interface RuleInput {
  currency: string;
  targetCostPerResult: number | null;
  maxDailyBudget: number;
  ads: AdInput[];
  adSets: AdSetInput[];
  conversionCampaignActive: boolean;
  pixelEventsLast24h: number | null;
  monthlyBudget: number | null;
  monthSpend: number;
  dayOfMonth: number;
  daysInMonth: number;
  variantGroups?: VariantGroupInput[];
}

export type Severity = "critical" | "warning" | "opportunity";
export type SuggestedAction =
  | { type: "pause"; id: string }
  | { type: "set_daily_budget"; id: string; from: number; to: number }
  | { type: "none" };

export interface Finding {
  rule: string;
  severity: Severity;
  entityType: "ad" | "adset" | "account" | "pixel";
  entityId: string;
  entityName: string;
  title: string;
  body: string;
  evidence: Record<string, number | string | null>;
  action: SuggestedAction;
}

const ctr = (m: Metrics) =>
  m.impressions ? (m.linkClicks / m.impressions) * 100 : 0;
const cpr = (m: Metrics) => (m.results ? m.spend / m.results : null);
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function referenceCost(input: RuleInput): number | null {
  if (input.targetCostPerResult) return input.targetCostPerResult;
  const totals = input.ads.reduce(
    (t, a) => ({
      spend: t.spend + a.current.spend,
      results: t.results + a.current.results,
    }),
    {
      spend: 0,
      results: 0,
    },
  );
  return totals.results >= 3 ? totals.spend / totals.results : null;
}

export function evaluate(input: RuleInput): Finding[] {
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: input.currency,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${Math.round(n)} ${input.currency}`;
    }
  };
  const ref = referenceCost(input);
  const findings: Finding[] = [];
  const activeAds = input.ads.filter((a) => a.active);
  const betterSibling = (ad: AdInput, own: number) =>
    activeAds.some((a) => {
      if (a.adSetId !== ad.adSetId || a.id === ad.id) return false;
      const other = cpr(a.current);
      return other !== null && a.current.results >= 2 && other <= own * 0.8;
    });

  const losers = new Set<string>();
  for (const group of input.variantGroups ?? []) {
    const members = group.ads
      .map((v) => ({
        label: v.label,
        ad: activeAds.find((a) => a.id === v.id),
      }))
      .filter((m): m is { label: string; ad: AdInput } => Boolean(m.ad));
    if (members.length < 2) continue;
    const pick = pickWinner(
      members.map(({ ad }) => ({ id: ad.id, ...ad.current })),
    );
    const winner = members.find((m) => m.ad.id === pick.winnerId);
    if (!winner) continue;
    const best = winner.ad.current;
    const bestCpr = cpr(best);
    for (const { label, ad } of members) {
      if (ad.id === winner.ad.id) continue;
      const m = ad.current;
      const own = cpr(m);
      const worse =
        pick.basis === "cost_per_result" && bestCpr !== null
          ? (own !== null && m.results >= 3 && own >= 1.5 * bestCpr) ||
            (m.results === 0 && m.spend >= 2 * bestCpr)
          : m.impressions >= 2000 &&
            best.impressions >= 2000 &&
            ctr(m) <= 0.6 * ctr(best);
      if (!worse) continue;
      losers.add(ad.id);
      findings.push({
        rule: "variant_loser",
        severity: "warning",
        entityType: "ad",
        entityId: ad.id,
        entityName: ad.name,
        title: `Variant ${label} is clearly worse — pause it`,
        body:
          pick.basis === "cost_per_result"
            ? `Variant ${winner.label} gets results at ${money(bestCpr!)} each, while variant ${label} ${own === null ? `spent ${money(m.spend)} without a result` : `pays ${money(own)}`}. Pausing variant ${label} moves its budget to the version that works.`
            : `People click variant ${winner.label} ${(ctr(best) / Math.max(ctr(m), 0.01)).toFixed(1)}× as often as variant ${label}. Pausing variant ${label} moves its budget to the version people prefer.`,
        evidence: {
          currency: input.currency,
          spend: round(m.spend),
          results: m.results,
          costPerResult: own === null ? null : round(own),
          winnerCostPerResult: bestCpr === null ? null : round(bestCpr),
          ctr: round(ctr(m)),
          winnerCtr: round(ctr(best)),
        },
        action: { type: "pause", id: ad.id },
      });
    }
  }

  for (const ad of activeAds) {
    if (losers.has(ad.id)) continue;
    const m = ad.current;
    const adCpr = cpr(m);
    const threshold = ref ?? 0;

    if (ref && m.results === 0 && m.spend >= 2 * ref) {
      findings.push({
        rule: "no_results",
        severity: "warning",
        entityType: "ad",
        entityId: ad.id,
        entityName: ad.name,
        title: `Pause "${ad.name}": ${money(m.spend)} spent, no results`,
        body: `This ad spent twice your target cost per result in 7 days without a single result. Pausing it moves budget to ads that convert.`,
        evidence: {
          currency: input.currency,
          spend: round(m.spend),
          results: 0,
          target: round(ref),
        },
        action: { type: "pause", id: ad.id },
      });
      continue;
    }

    if (
      ref &&
      adCpr !== null &&
      m.results >= 3 &&
      adCpr >= 1.5 * threshold &&
      betterSibling(ad, adCpr)
    ) {
      findings.push({
        rule: "expensive",
        severity: "warning",
        entityType: "ad",
        entityId: ad.id,
        entityName: ad.name,
        title: `"${ad.name}" costs ${money(adCpr)} per result`,
        body: `That's ${Math.round((adCpr / threshold - 1) * 100)}% above ${input.targetCostPerResult ? "your target" : "your account average"} of ${money(threshold)}. Other ads in the same ad set are doing better, so pausing this one should lower your average cost.`,
        evidence: {
          costPerResult: round(adCpr),
          reference: round(threshold),
          results: m.results,
          spend: round(m.spend),
        },
        action: { type: "pause", id: ad.id },
      });
      continue;
    }

    if (ad.previous && m.frequency >= 3.5 && m.impressions >= 1000) {
      const now = ctr(m);
      const before = ctr(ad.previous);
      if (before > 0 && now <= before * 0.7) {
        findings.push({
          rule: "fatigue",
          severity: "warning",
          entityType: "ad",
          entityId: ad.id,
          entityName: ad.name,
          title: `People are tiring of "${ad.name}"`,
          body: `The same people have seen it ${m.frequency.toFixed(1)} times on average and clicks dropped ${Math.round((1 - now / before) * 100)}% versus last week. Add a fresh image or message to this ad set.`,
          evidence: {
            frequency: round(m.frequency),
            ctr: round(now),
            previousCtr: round(before),
          },
          action: { type: "none" },
        });
      }
    }

    if (m.linkClicks >= 50 && m.landingPageViews / m.linkClicks < 0.5) {
      findings.push({
        rule: "landing_drop",
        severity: "warning",
        entityType: "ad",
        entityId: ad.id,
        entityName: ad.name,
        title: `Only ${Math.round((m.landingPageViews / m.linkClicks) * 100)}% of clicks from "${ad.name}" reach your page`,
        body: "People click but leave before the page loads. Check the page speed on mobile and that the link is correct.",
        evidence: {
          linkClicks: m.linkClicks,
          landingPageViews: m.landingPageViews,
        },
        action: { type: "none" },
      });
    }
  }

  for (const set of input.adSets.filter((s) => s.active)) {
    const m = set.current;
    const setCpr = cpr(m);
    if (
      input.targetCostPerResult &&
      setCpr !== null &&
      m.results >= 3 &&
      setCpr >= 1.5 * input.targetCostPerResult
    ) {
      findings.push({
        rule: "above_target",
        severity: "warning",
        entityType: "adset",
        entityId: set.id,
        entityName: set.name,
        title: `"${set.name}" costs ${money(setCpr)} per result, above your ${money(input.targetCostPerResult)} target`,
        body: "All ads here cost more than your target. Try a fresh creative with a sharper offer, a narrower audience, or check that the target is realistic for this audience.",
        evidence: {
          currency: input.currency,
          costPerResult: round(setCpr),
          target: input.targetCostPerResult,
          results: m.results,
          spend: round(m.spend),
        },
        action: { type: "none" },
      });
    }
    if (!set.dailyBudget) continue;
    const budget = set.dailyBudget!;
    const spentShare = m.spend / (budget * set.days);
    if (
      ref &&
      setCpr !== null &&
      m.results >= 5 &&
      setCpr <= 0.7 * ref &&
      spentShare >= 0.85
    ) {
      const to = Math.min(Math.round(budget * 1.2), input.maxDailyBudget);
      if (to > budget) {
        findings.push({
          rule: "scale_winner",
          severity: "opportunity",
          entityType: "adset",
          entityId: set.id,
          entityName: set.name,
          title: `Give "${set.name}" more budget`,
          body: `It gets results at ${money(setCpr)} each, well below ${money(ref)}, and uses its full budget every day. Raising the daily budget by 20% (to ${money(to)}) usually keeps costs steady.`,
          evidence: {
            costPerResult: round(setCpr),
            reference: round(ref),
            results: m.results,
            spendShare: round(spentShare),
          },
          action: { type: "set_daily_budget", id: set.id, from: budget, to },
        });
      }
    }
  }

  if (input.conversionCampaignActive && input.pixelEventsLast24h === 0) {
    findings.push({
      rule: "tracking_silent",
      severity: "critical",
      entityType: "pixel",
      entityId: "pixel",
      entityName: "Pixel",
      title: "Your Pixel hasn't sent any events in 24 hours",
      body: "A conversion campaign is running, but Meta isn't receiving sign-ups or leads, so it can't optimise and may waste budget. Check that the Pixel and Conversions API are still installed on your website.",
      evidence: { eventsLast24h: 0 },
      action: { type: "none" },
    });
  }

  if (input.monthlyBudget && input.dayOfMonth >= 3) {
    const projected = (input.monthSpend / input.dayOfMonth) * input.daysInMonth;
    if (projected > input.monthlyBudget * 1.1) {
      findings.push({
        rule: "pacing",
        severity: "warning",
        entityType: "account",
        entityId: "account",
        entityName: "Monthly budget",
        title: `On pace to spend ${money(projected)} this month`,
        body: `That's above your monthly budget of ${money(input.monthlyBudget)}. Lower daily budgets or pause the weakest ads to stay on plan.`,
        evidence: {
          monthSpend: round(input.monthSpend),
          projected: round(projected),
          monthlyBudget: input.monthlyBudget,
        },
        action: { type: "none" },
      });
    }
  }

  const order: Record<Severity, number> = {
    critical: 0,
    warning: 1,
    opportunity: 2,
  };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}
