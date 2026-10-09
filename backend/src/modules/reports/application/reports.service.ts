import { Inject, Injectable } from "@nestjs/common";

import { AdsService } from "@modules/ads/application/ads.service";
import { resultFor } from "@modules/ads/domain/goals";
import {
  META_ADS,
  MetaAds,
  InsightRow,
} from "@modules/meta/domain/ports/meta-ads";
import { SettingsService } from "@modules/settings/application/settings.service";
import { CacheService } from "@shared/cache/cache.service";

import {
  daysBetween,
  Period,
  periodsFor,
  ReportPreset,
  todayIn,
} from "../domain/periods";

const CACHE_SECONDS = 600;

interface Totals {
  spend: number;
  impressions: number;
  linkClicks: number;
  results: number;
}

const round = (n: number, digits = 2) =>
  Math.round(n * 10 ** digits) / 10 ** digits;
const ratio = (a: number, b: number) => (b ? a / b : null);

function sum(rows: InsightRow[]): Totals {
  return rows.reduce<Totals>(
    (t, r) => ({
      spend: t.spend + r.spend,
      impressions: t.impressions + r.impressions,
      linkClicks: t.linkClicks + r.linkClicks,
      results: t.results + (resultFor(r.objective, r.actions)?.count ?? 0),
    }),
    { spend: 0, impressions: 0, linkClicks: 0, results: 0 },
  );
}

function kpis(totals: Totals, reach: number) {
  const cpr = ratio(totals.spend, totals.results);
  const ctr = ratio(totals.linkClicks * 100, totals.impressions);
  const cpm = ratio(totals.spend * 1000, totals.impressions);
  return {
    spend: round(totals.spend),
    results: totals.results,
    costPerResult: cpr === null ? null : round(cpr),
    impressions: totals.impressions,
    reach,
    linkClicks: totals.linkClicks,
    ctr: ctr === null ? null : round(ctr),
    cpm: cpm === null ? null : round(cpm),
  };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly ads: AdsService,
    @Inject(META_ADS) private readonly meta: MetaAds,
    private readonly settings: SettingsService,
    private readonly cache: CacheService,
  ) {}

  async overview(workspaceId: string, preset: ReportPreset) {
    const ws = await this.ads.account(workspaceId);
    const timezone =
      typeof ws.adAccount.details.timezone === "string"
        ? ws.adAccount.details.timezone
        : "Asia/Kolkata";
    const { current, previous } = periodsFor(preset, todayIn(timezone));
    const key = `reports:${workspaceId}:${ws.adAccount.externalId}:${current.since}:${current.until}`;
    const cached =
      await this.cache.get<Awaited<ReturnType<ReportsService["build"]>>>(key);
    const targets = await this.settings.targets(workspaceId);
    if (cached)
      return { ...cached, targetCostPerResult: targets.targetCostPerResult };
    const report = await this.build(
      ws.token,
      ws.adAccount.externalId,
      ws.currency,
      preset,
      current,
      previous,
    );
    await this.cache.set(key, report, CACHE_SECONDS);
    return { ...report, targetCostPerResult: targets.targetCostPerResult };
  }

  private async build(
    token: string,
    account: string,
    currency: string,
    preset: ReportPreset,
    current: Period,
    previous: Period,
  ) {
    const query = (
      level: "account" | "campaign" | "ad",
      period: Period,
      daily = false,
    ) =>
      this.meta.insights(token, account, {
        level,
        since: period.since,
        until: period.until,
        daily,
        limit: 500,
      });
    const [
      campaignDaily,
      campaignPrevious,
      accountCurrent,
      accountPrevious,
      adRows,
      campaigns,
    ] = await Promise.all([
      query("campaign", current, true),
      query("campaign", previous),
      query("account", current),
      query("account", previous),
      query("ad", current),
      this.meta.campaigns(token, account),
    ]);

    const byDay = new Map<
      string,
      { spend: number; results: number; linkClicks: number }
    >();
    for (const day of daysBetween(current))
      byDay.set(day, { spend: 0, results: 0, linkClicks: 0 });
    const byCampaign = new Map<
      string,
      { name: string; objective: string | null; rows: InsightRow[] }
    >();
    for (const row of campaignDaily) {
      const day = byDay.get(row.dateStart);
      if (day) {
        day.spend += row.spend;
        day.linkClicks += row.linkClicks;
        day.results += resultFor(row.objective, row.actions)?.count ?? 0;
      }
      const entry = byCampaign.get(row.id) ?? {
        name: row.name,
        objective: row.objective,
        rows: [],
      };
      entry.rows.push(row);
      byCampaign.set(row.id, entry);
    }

    const status = new Map(campaigns.map((c) => [c.id, c.effectiveStatus]));
    const campaignRows = [...byCampaign.entries()]
      .map(([id, c]) => {
        const t = sum(c.rows);
        const k = kpis(t, 0);
        return {
          id,
          name: c.name,
          objective: c.objective,
          status: status.get(id) ?? "UNKNOWN",
          spend: k.spend,
          results: t.results,
          resultType:
            c.rows
              .map((r) => resultFor(r.objective, r.actions)?.action)
              .find(Boolean) ?? null,
          costPerResult: k.costPerResult,
          impressions: t.impressions,
          ctr: k.ctr,
        };
      })
      .sort((a, b) => b.spend - a.spend);

    const topAds = adRows
      .map((r) => {
        const result = resultFor(r.objective, r.actions);
        return {
          id: r.id,
          name: r.name,
          spend: round(r.spend),
          results: result?.count ?? 0,
          costPerResult: result ? round(r.spend / result.count) : null,
          ctr: round(r.ctr),
        };
      })
      .sort(
        (a, b) =>
          b.results - a.results ||
          (a.costPerResult ?? Infinity) - (b.costPerResult ?? Infinity),
      )
      .slice(0, 5);

    return {
      currency,
      preset,
      period: current,
      previousPeriod: previous,
      kpis: kpis(sum(campaignDaily), accountCurrent[0]?.reach ?? 0),
      previousKpis: kpis(sum(campaignPrevious), accountPrevious[0]?.reach ?? 0),
      daily: [...byDay.entries()].map(([date, d]) => ({
        date,
        spend: round(d.spend),
        results: d.results,
        linkClicks: d.linkClicks,
      })),
      campaigns: campaignRows,
      topAds,
    };
  }
}
