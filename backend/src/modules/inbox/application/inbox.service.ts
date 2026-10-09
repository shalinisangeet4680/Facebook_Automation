import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gt, inArray, lt, notInArray, or } from "drizzle-orm";

import { AdsService } from "@modules/ads/application/ads.service";
import { AdsActor } from "@modules/ads/domain/ads.types";
import { resultFor } from "@modules/ads/domain/goals";
import { toMajor } from "@modules/ads/domain/money";
import { AuditService } from "@modules/audit/application/audit.service";
import {
  InsightRow,
  META_ADS,
  MetaAds,
} from "@modules/meta/domain/ports/meta-ads";
import { campaignPlans } from "@modules/plans/infrastructure/plans.tables";
import {
  daysBetween,
  periodsFor,
  todayIn,
} from "@modules/reports/domain/periods";
import { SettingsService } from "@modules/settings/application/settings.service";
import { socialPosts } from "@modules/social/infrastructure/social.tables";
import { DATABASE, Database, firstOrNull } from "@shared/database/database";
import { CodedError, NotFoundError } from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";

import {
  AdInput,
  AdSetInput,
  evaluate,
  Finding,
  Metrics,
} from "../domain/rules";
import { SuggestionRow, suggestions } from "../infrastructure/inbox.tables";

const MAX_CAMPAIGNS = 25;
const SNOOZE_DAYS = 7;
const CONVERSION_OBJECTIVES = new Set(["OUTCOME_LEADS", "OUTCOME_SALES"]);

function metrics(row: InsightRow | undefined): Metrics {
  if (!row)
    return {
      spend: 0,
      results: 0,
      impressions: 0,
      linkClicks: 0,
      landingPageViews: 0,
      frequency: 0,
    };
  return {
    spend: row.spend,
    results: resultFor(row.objective, row.actions)?.count ?? 0,
    impressions: row.impressions,
    linkClicks: row.linkClicks,
    landingPageViews: row.actions.landing_page_view ?? 0,
    frequency: row.frequency,
  };
}

@Injectable()
export class InboxService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(META_ADS) private readonly meta: MetaAds,
    private readonly ads: AdsService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  view(row: SuggestionRow) {
    return {
      id: row.id,
      rule: row.rule,
      severity: row.severity,
      entityType: row.entityType,
      entityId: row.entityId,
      entityName: row.entityName,
      title: row.title,
      body: row.body,
      evidence: row.evidence,
      action: row.action,
      status: row.status,
      snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async findings(workspaceId: string): Promise<Finding[]> {
    const ws = await this.ads.account(workspaceId);
    const account = ws.adAccount.externalId;
    const timezone =
      typeof ws.adAccount.details.timezone === "string"
        ? ws.adAccount.details.timezone
        : "Asia/Kolkata";
    const today = todayIn(timezone);
    const { current, previous } = periodsFor("last_7d", today);
    const month = periodsFor("this_month", today).current;
    const targets = await this.settings.targets(workspaceId);

    const campaigns = (await this.meta.campaigns(ws.token, account))
      .filter((c) => c.effectiveStatus === "ACTIVE")
      .slice(0, MAX_CAMPAIGNS);
    const query = (
      level: "ad" | "adset" | "account",
      since: string,
      until: string,
    ) =>
      this.meta.insights(ws.token, account, {
        level,
        since,
        until,
        daily: false,
        limit: 500,
      });
    const [details, adNow, adBefore, setNow, monthRows, events] =
      await Promise.all([
        Promise.all(campaigns.map((c) => this.meta.campaign(ws.token, c.id))),
        query("ad", current.since, current.until),
        query("ad", previous.since, previous.until),
        query("adset", current.since, current.until),
        query("account", month.since, month.until),
        ws.dataset
          ? this.meta
              .pixelEvents(
                ws.token,
                ws.dataset.externalId,
                Math.floor(Date.now() / 1000) - 86_400,
              )
              .catch(() => null)
          : Promise.resolve(null),
      ]);

    const byId = (rows: InsightRow[]) => new Map(rows.map((r) => [r.id, r]));
    const now = byId(adNow);
    const before = byId(adBefore);
    const sets = byId(setNow);
    const live = (status: string) => status === "ACTIVE";

    const ads: AdInput[] = details.flatMap((d) =>
      d.ads.map((a) => ({
        id: a.id,
        name: a.name,
        adSetId: a.adSetId,
        active: live(a.effectiveStatus),
        current: metrics(now.get(a.id)),
        previous: before.has(a.id) ? metrics(before.get(a.id)) : null,
      })),
    );
    const adSets: AdSetInput[] = details.flatMap((d) =>
      d.adSets.map((s) => ({
        id: s.id,
        name: s.name,
        active: live(s.effectiveStatus),
        dailyBudget: toMajor(s.dailyBudget, ws.currency),
        current: metrics(sets.get(s.id)),
        days: daysBetween(current).length,
      })),
    );

    const [y, m, d] = today.split("-").map(Number) as [number, number, number];
    return evaluate({
      currency: ws.currency,
      targetCostPerResult: targets.targetCostPerResult,
      maxDailyBudget: targets.maxDailyBudget,
      ads,
      adSets,
      conversionCampaignActive: campaigns.some((c) =>
        CONVERSION_OBJECTIVES.has(c.objective),
      ),
      pixelEventsLast24h: events
        ? events.reduce((sum, e) => sum + e.count, 0)
        : null,
      monthlyBudget: targets.monthlyBudget,
      monthSpend: monthRows[0]?.spend ?? 0,
      dayOfMonth: d,
      daysInMonth: new Date(Date.UTC(y, m, 0)).getUTCDate(),
    });
  }

  async refresh(
    workspaceId: string,
  ): Promise<{ created: number; open: number }> {
    const found = await this.findings(workspaceId);
    const fingerprints = found.map((f) => `${f.rule}:${f.entityId}`);
    let created = 0;
    await this.db.transaction(async (tx) => {
      await tx
        .update(suggestions)
        .set({ status: "open", snoozedUntil: null })
        .where(
          and(
            eq(suggestions.workspaceId, workspaceId),
            eq(suggestions.status, "snoozed"),
            lt(suggestions.snoozedUntil, new Date()),
          ),
        );
      const stale = tx
        .update(suggestions)
        .set({ status: "expired", resolvedAt: new Date() })
        .where(
          and(
            eq(suggestions.workspaceId, workspaceId),
            eq(suggestions.status, "open"),
            ...(fingerprints.length
              ? [notInArray(suggestions.fingerprint, fingerprints)]
              : []),
          ),
        );
      await stale;
      const quiet = await tx
        .select({ fingerprint: suggestions.fingerprint })
        .from(suggestions)
        .where(
          and(
            eq(suggestions.workspaceId, workspaceId),
            or(
              and(
                eq(suggestions.status, "dismissed"),
                gt(
                  suggestions.resolvedAt,
                  new Date(Date.now() - 30 * 86_400_000),
                ),
              ),
              and(
                eq(suggestions.status, "applied"),
                gt(
                  suggestions.resolvedAt,
                  new Date(Date.now() - 3 * 86_400_000),
                ),
              ),
            ),
          ),
        );
      const muted = new Set(quiet.map((q) => q.fingerprint));
      for (const f of found) {
        if (muted.has(`${f.rule}:${f.entityId}`)) continue;
        const inserted = await tx
          .insert(suggestions)
          .values({
            workspaceId,
            rule: f.rule,
            severity: f.severity,
            entityType: f.entityType,
            entityId: f.entityId,
            entityName: f.entityName,
            title: f.title,
            body: f.body,
            evidence: f.evidence,
            action: f.action as unknown as Record<string, unknown>,
            fingerprint: `${f.rule}:${f.entityId}`,
          })
          .onConflictDoNothing()
          .returning({ id: suggestions.id });
        created += inserted.length;
      }
    });
    const open = await this.db
      .select({ id: suggestions.id })
      .from(suggestions)
      .where(
        and(
          eq(suggestions.workspaceId, workspaceId),
          eq(suggestions.status, "open"),
        ),
      );
    return { created, open: open.length };
  }

  async inbox(workspaceId: string) {
    const [rows, plans, failed] = await Promise.all([
      this.db
        .select()
        .from(suggestions)
        .where(
          and(
            eq(suggestions.workspaceId, workspaceId),
            eq(suggestions.status, "open"),
          ),
        )
        .orderBy(desc(suggestions.createdAt))
        .limit(100),
      this.db
        .select({
          id: campaignPlans.id,
          plan: campaignPlans.plan,
          createdAt: campaignPlans.createdAt,
          source: campaignPlans.source,
        })
        .from(campaignPlans)
        .where(
          and(
            eq(campaignPlans.workspaceId, workspaceId),
            eq(campaignPlans.status, "draft"),
          ),
        )
        .orderBy(desc(campaignPlans.createdAt))
        .limit(20),
      this.db
        .select()
        .from(socialPosts)
        .where(
          and(
            eq(socialPosts.workspaceId, workspaceId),
            inArray(socialPosts.status, ["failed", "partially_published"]),
          ),
        )
        .orderBy(desc(socialPosts.updatedAt))
        .limit(20),
    ]);
    const order = { critical: 0, warning: 1, opportunity: 2 } as const;
    return {
      suggestions: rows
        .map((r) => this.view(r))
        .sort((a, b) => order[a.severity] - order[b.severity]),
      plansToReview: plans.map((p) => ({
        id: p.id,
        name:
          typeof (p.plan as { name?: unknown }).name === "string"
            ? (p.plan as { name: string }).name
            : "Plan",
        source: p.source,
        createdAt: p.createdAt.toISOString(),
      })),
      failedPosts: failed.map((p) => ({
        id: p.id,
        status: p.status,
        facebookError: p.facebookError,
        instagramError: p.instagramError,
        caption: p.facebookCaption ?? p.instagramCaption ?? "",
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  }

  async apply(actor: AdsActor, id: string) {
    const row = await this.open(actor.workspaceId, id);
    const action = row.action as { type: string; id?: string; to?: number };
    if (action.type === "pause" && action.id)
      await this.ads.pause(actor, action.id);
    else if (action.type === "set_daily_budget" && action.id && action.to)
      await this.ads.setDailyBudgetNow(actor, action.id, action.to);
    else
      throw new CodedError(
        ErrorCode.VALIDATION,
        400,
        "This suggestion has no automatic action. Dismiss it once you've handled it.",
      );
    return this.resolve(actor, row, "applied");
  }

  async dismiss(actor: AdsActor, id: string) {
    return this.resolve(
      actor,
      await this.open(actor.workspaceId, id),
      "dismissed",
    );
  }

  async snooze(actor: AdsActor, id: string) {
    const row = await this.open(actor.workspaceId, id);
    const [saved] = await this.db
      .update(suggestions)
      .set({
        status: "snoozed",
        snoozedUntil: new Date(Date.now() + SNOOZE_DAYS * 86_400_000),
      })
      .where(eq(suggestions.id, row.id))
      .returning();
    return this.view(saved!);
  }

  private async open(workspaceId: string, id: string): Promise<SuggestionRow> {
    const row = firstOrNull(
      await this.db
        .select()
        .from(suggestions)
        .where(
          and(eq(suggestions.id, id), eq(suggestions.workspaceId, workspaceId)),
        )
        .limit(1),
    );
    if (!row) throw new NotFoundError("This suggestion doesn't exist.");
    if (row.status !== "open")
      throw new CodedError(
        ErrorCode.CONFLICT,
        409,
        "This suggestion was already handled.",
      );
    return row;
  }

  private async resolve(
    actor: AdsActor,
    row: SuggestionRow,
    status: "applied" | "dismissed",
  ) {
    const [saved] = await this.db
      .update(suggestions)
      .set({ status, resolvedAt: new Date() })
      .where(eq(suggestions.id, row.id))
      .returning();
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actor: "user",
      actorId: actor.userId,
      action: `suggestion.${status}`,
      target: row.id,
      data: { rule: row.rule, entityId: row.entityId, via: actor.via },
    });
    return this.view(saved!);
  }
}
