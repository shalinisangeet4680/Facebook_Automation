import { AdsService } from "@modules/ads/application/ads.service";
import { AuditService } from "@modules/audit/application/audit.service";
import { MetaAds } from "@modules/meta/domain/ports/meta-ads";
import { SettingsService } from "@modules/settings/application/settings.service";
import { Database } from "@shared/database/database";

import { SuggestionRow } from "../infrastructure/inbox.tables";
import { InboxService } from "./inbox.service";

const actor = { userId: "u1", workspaceId: "w1", via: "app" };

const suggestion = (overrides: Partial<SuggestionRow> = {}): SuggestionRow => ({
  id: "s1",
  workspaceId: "w1",
  rule: "scale_winner",
  severity: "opportunity",
  entityType: "adset",
  entityId: "set1",
  entityName: "Patna – Ad set",
  title: "Raise the budget",
  body: "This ad set gets results below your target.",
  evidence: {},
  action: { type: "set_daily_budget", id: "set1", to: 960 },
  status: "open",
  fingerprint: "scale_winner:set1",
  snoozedUntil: null,
  resolvedAt: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

function setup(row: SuggestionRow | null) {
  let current = row;
  const updates: Partial<SuggestionRow>[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(current ? [current] : []),
        }),
      }),
    }),
    update: () => ({
      set: (values: Partial<SuggestionRow>) => {
        updates.push(values);
        return {
          where: () => ({
            returning: () => {
              current = { ...current!, ...values };
              return Promise.resolve([current]);
            },
          }),
        };
      },
    }),
  } as unknown as Database;
  const ads = {
    pause: vi.fn(() => Promise.resolve()),
    setDailyBudgetNow: vi.fn(() => Promise.resolve()),
  };
  const audit = vi.fn(() => Promise.resolve());
  const service = new InboxService(
    db,
    {} as MetaAds,
    ads as unknown as AdsService,
    {} as SettingsService,
    { record: audit } as unknown as AuditService,
  );
  return { service, ads, audit, updates };
}

describe("InboxService", () => {
  describe("apply", () => {
    it("changes the budget and marks the suggestion applied", async () => {
      const { service, ads, audit, updates } = setup(suggestion());
      const applied = await service.apply(actor, "s1");
      expect(ads.setDailyBudgetNow).toHaveBeenCalledWith(actor, "set1", 960);
      expect(applied.status).toBe("applied");
      expect(updates[0]!.resolvedAt).toBeInstanceOf(Date);
      expect(audit).toHaveBeenCalledWith({
        workspaceId: "w1",
        actor: "user",
        actorId: "u1",
        action: "suggestion.applied",
        target: "s1",
        data: { rule: "scale_winner", entityId: "set1", via: "app" },
      });
    });

    it("pauses an ad", async () => {
      const { service, ads } = setup(
        suggestion({
          rule: "expensive",
          entityType: "ad",
          entityId: "ad1",
          action: { type: "pause", id: "ad1" },
        }),
      );
      expect((await service.apply(actor, "s1")).status).toBe("applied");
      expect(ads.pause).toHaveBeenCalledWith(actor, "ad1");
    });

    it("refuses suggestions without an automatic action", async () => {
      const { service, ads, updates } = setup(
        suggestion({ action: { type: "none" } }),
      );
      await expect(service.apply(actor, "s1")).rejects.toMatchObject({
        httpStatus: 400,
      });
      expect(ads.pause).not.toHaveBeenCalled();
      expect(updates).toHaveLength(0);
    });

    it("leaves the suggestion open when Meta fails", async () => {
      const { service, ads, updates } = setup(suggestion());
      ads.setDailyBudgetNow.mockRejectedValueOnce(new Error("Meta is down"));
      await expect(service.apply(actor, "s1")).rejects.toThrow("Meta is down");
      expect(updates).toHaveLength(0);
    });
  });

  describe("dismiss", () => {
    it("marks it dismissed without touching the ads", async () => {
      const { service, ads, audit } = setup(suggestion());
      const dismissed = await service.dismiss(actor, "s1");
      expect(dismissed.status).toBe("dismissed");
      expect(dismissed.snoozedUntil).toBeNull();
      expect(ads.setDailyBudgetNow).not.toHaveBeenCalled();
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "suggestion.dismissed" }),
      );
    });
  });

  describe("snooze", () => {
    it("hides it for seven days", async () => {
      const { service, audit } = setup(suggestion());
      const before = Date.now();
      const snoozed = await service.snooze(actor, "s1");
      expect(snoozed.status).toBe("snoozed");
      const until = Date.parse(snoozed.snoozedUntil!);
      expect(until - before).toBeGreaterThanOrEqual(7 * 86_400_000);
      expect(until - before).toBeLessThan(7 * 86_400_000 + 60_000);
      expect(audit).not.toHaveBeenCalled();
    });
  });

  describe("handled suggestions", () => {
    it.each(["applied", "dismissed", "snoozed", "expired"] as const)(
      "refuses to act on a %s suggestion",
      async (status) => {
        const { service, ads, updates } = setup(suggestion({ status }));
        for (const act of [
          () => service.apply(actor, "s1"),
          () => service.dismiss(actor, "s1"),
          () => service.snooze(actor, "s1"),
        ])
          await expect(act()).rejects.toMatchObject({
            httpStatus: 409,
            message: "This suggestion was already handled.",
          });
        expect(ads.setDailyBudgetNow).not.toHaveBeenCalled();
        expect(updates).toHaveLength(0);
      },
    );

    it("says when a suggestion doesn't exist", async () => {
      const { service } = setup(null);
      await expect(service.dismiss(actor, "s1")).rejects.toMatchObject({
        httpStatus: 404,
      });
    });
  });
});
