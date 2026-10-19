import { AdsService } from "@modules/ads/application/ads.service";
import { ConfirmationService } from "@modules/ads/application/confirmation.service";
import { AuditService } from "@modules/audit/application/audit.service";
import { LeadSyncService } from "@modules/leads/application/lead-sync.service";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import { GraphAdsClient } from "@modules/meta/infrastructure/graph-ads.client";
import { SettingsService } from "@modules/settings/application/settings.service";
import { AppConfig } from "@shared/config/app-config";
import { CacheService } from "@shared/cache/cache.service";
import { CryptoService } from "@shared/security/crypto.service";
import { TenantContext } from "@shared/tenant/tenant-context";

import { PlanRepository } from "../infrastructure/plan.repository";
import { CampaignPlanRow } from "../infrastructure/plans.tables";
import { PlanGeneratorService } from "./plan-generator.service";
import { PlanService } from "./plan.service";
import { PlansController } from "../interface/plans.controller";

const WORKSPACE = "w1";
const actor = { userId: "u1", workspaceId: WORKSPACE, via: "app" };

const plan = {
  name: "Clinic demo – Traffic",
  summary: "Send clinic owners to the demo page.",
  goal: "traffic",
  dailyBudget: 500,
  targeting: { countries: ["IN"], ageMin: 25, ageMax: 55 },
  creative: {
    primaryText: "Run a paperless clinic.",
    headline: "Free demo",
    linkUrl: "https://example.com/demo",
    imageUrl: "https://example.com/ad.png",
    callToAction: "LEARN_MORE",
  },
  reasons: {
    goal: "Visits to the demo page.",
    audience: "Clinic owners.",
    budget: "A fair test budget.",
    creative: "Shows the product.",
  },
};

const leadPlan = {
  ...plan,
  name: "Clinic demo – Instant form",
  goal: "instant_leads",
  creative: { ...plan.creative, callToAction: "SIGN_UP" },
  leadForm: {
    name: "Clinic demo form",
    locale: "EN_US",
    intro: { headline: "Free clinic demo", description: null },
    questions: ["FULL_NAME", "PHONE"],
    customQuestions: [],
    privacyPolicyUrl: "https://example.com/privacy",
    thankYou: {
      title: "Thanks!",
      body: "We'll call you soon.",
      button: { type: "website", text: "Visit", url: "https://example.com/" },
    },
  },
};

class MemoryPlans {
  rows = new Map<string, CampaignPlanRow>();
  private queue: Promise<unknown> = Promise.resolve();
  private sequence = 0;

  transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const snapshot = new Map(
        [...this.rows].map(([id, row]) => [id, { ...row }]),
      );
      try {
        return await fn({});
      } catch (err) {
        this.rows = snapshot;
        throw err;
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  insert(input: Partial<CampaignPlanRow>): Promise<CampaignPlanRow> {
    const now = new Date();
    const row = {
      id: `00000000-0000-4000-8000-${String(++this.sequence).padStart(12, "0")}`,
      status: "draft",
      meta: null,
      adAccountId: null,
      error: null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      ...input,
    } as CampaignPlanRow;
    this.rows.set(row.id, row);
    return Promise.resolve({ ...row });
  }

  find(workspaceId: string, id: string): Promise<CampaignPlanRow | null> {
    const row = this.rows.get(id);
    return Promise.resolve(
      row && row.workspaceId === workspaceId ? { ...row } : null,
    );
  }

  update(id: string, values: Partial<CampaignPlanRow>) {
    const row = { ...this.rows.get(id)!, ...values, updatedAt: new Date() };
    this.rows.set(id, row);
    return Promise.resolve({ ...row });
  }
}

const assets = [
  {
    id: "a1",
    kind: "ad_account",
    externalId: "act_1",
    name: "Main account",
    isPrimary: true,
    details: { currency: "INR" },
  },
  {
    id: "p1",
    kind: "page",
    externalId: "p1",
    name: "Clinic",
    isPrimary: true,
    details: {},
  },
];

const connections = {
  accessToken: () => Promise.resolve("tok"),
  listAssets: () => Promise.resolve({ data: assets }),
} as unknown as MetaConnectionService;

const settings = {
  targets: () =>
    Promise.resolve({
      maxDailyBudget: 2000,
      monthlyBudget: null,
      targetCostPerResult: null,
    }),
} as unknown as SettingsService;

const draftResult = {
  status: "created_paused" as const,
  campaignId: "c1",
  adSetId: "s1",
  creativeId: "cr1",
  adId: "ad1",
  ads: [{ label: "", adId: "ad1", creativeId: "cr1" }],
  adAccountId: "act_1",
  pageId: "p1",
  dailyBudget: 500,
  currency: "INR",
  adsManagerUrl: "https://adsmanager.facebook.com/c1",
  next: "",
};

function setup(ads: Partial<Record<keyof AdsService, unknown>> = {}) {
  const repo = new MemoryPlans();
  const audit = vi.fn(() => Promise.resolve());
  const trackCreatedForm = vi.fn(() => Promise.resolve());
  const fakes = {
    createDraft: vi.fn(() => Promise.resolve(draftResult)),
    launchNow: vi.fn(() => Promise.resolve({ activated: [] })),
    ...ads,
  };
  const adsService = fakes as unknown as AdsService;
  const service = new PlanService(
    repo as unknown as PlanRepository,
    adsService,
    connections,
    { record: audit } as unknown as AuditService,
    settings,
    { trackCreatedForm } as unknown as LeadSyncService,
    {} as AppConfig,
  );
  const actions = () =>
    (audit.mock.calls as unknown as [{ action: string }][]).map(
      ([e]) => e.action,
    );
  return { repo, service, ads: fakes, actions, trackCreatedForm };
}

describe("PlanService", () => {
  describe("editing", () => {
    it("saves changes while the plan is a draft", async () => {
      const { service } = setup();
      const proposed = await service.propose(actor, plan);
      const saved = await service.replace(actor, proposed.id, {
        ...plan,
        dailyBudget: 700,
      });
      expect(saved).toMatchObject({ status: "draft", error: null });
      expect(saved.plan.dailyBudget).toBe(700);
    });

    it("rejects edits and discards once the plan is in Meta", async () => {
      const { service } = setup();
      const { id } = await service.propose(actor, plan);
      await service.createInMeta(actor, id);
      await expect(
        service.replace(actor, id, { ...plan, dailyBudget: 700 }),
      ).rejects.toMatchObject({
        httpStatus: 409,
        message: "Only draft plans can be edited.",
      });
      await expect(service.discard(actor, id)).rejects.toMatchObject({
        httpStatus: 409,
      });
    });

    it("rejects edits to a discarded plan", async () => {
      const { service } = setup();
      const { id } = await service.propose(actor, plan);
      expect((await service.discard(actor, id)).status).toBe("discarded");
      await expect(service.replace(actor, id, plan)).rejects.toMatchObject({
        httpStatus: 409,
      });
      await expect(service.createInMeta(actor, id)).rejects.toMatchObject({
        httpStatus: 409,
      });
    });

    it("validates the plan and the workspace budget limit", async () => {
      const { service } = setup();
      const { id } = await service.propose(actor, plan);
      await expect(
        service.replace(actor, id, { ...plan, dailyBudget: 5000 }),
      ).rejects.toMatchObject({ code: "BUDGET_LIMIT", httpStatus: 422 });
      await expect(
        service.replace(actor, id, { ...plan, goal: "sales" }),
      ).rejects.toMatchObject({ httpStatus: 400 });
      await expect(
        service.propose(actor, { ...plan, name: "" }),
      ).rejects.toMatchObject({ httpStatus: 400 });
    });

    it("hides plans from other workspaces", async () => {
      const { service } = setup();
      const { id } = await service.propose(actor, plan);
      const stranger = { ...actor, workspaceId: "w2" };
      await expect(service.replace(stranger, id, plan)).rejects.toMatchObject({
        httpStatus: 404,
      });
      await expect(service.createInMeta(stranger, id)).rejects.toMatchObject({
        httpStatus: 404,
      });
    });
  });

  describe("createInMeta", () => {
    it("creates the campaign paused and stores the Meta ids", async () => {
      const { service, actions } = setup();
      const { id } = await service.propose(actor, plan);
      const created = await service.createInMeta(actor, id);
      expect(created).toMatchObject({
        status: "created",
        meta: { campaignId: "c1", adAccountId: "act_1" },
        adAccount: { id: "act_1", name: "Main account", currency: "INR" },
        error: null,
      });
      expect(actions()).toEqual(["plan.proposed", "plan.created_in_meta"]);
    });

    it("needs an image, a video or a post", async () => {
      const { service, ads } = setup();
      const { id } = await service.propose(actor, {
        ...plan,
        creative: { ...plan.creative, imageUrl: null },
      });
      await expect(service.createInMeta(actor, id)).rejects.toMatchObject({
        httpStatus: 400,
      });
      expect(ads.createDraft).not.toHaveBeenCalled();
    });

    it("keeps the plan a draft and records Meta's error when creation fails", async () => {
      const failure = Object.assign(new Error("Bad targeting"), {
        code: "META_REJECTED",
        httpStatus: 422,
      });
      const { service, repo, actions, trackCreatedForm } = setup({
        createDraft: vi.fn(() => Promise.reject(failure)),
      });
      const { id } = await service.propose(actor, leadPlan);
      await expect(service.createInMeta(actor, id)).rejects.toBe(failure);
      expect(repo.rows.get(id)).toMatchObject({
        status: "draft",
        meta: null,
        error: "Bad targeting",
      });
      expect(actions()).toEqual(["plan.proposed"]);
      expect(trackCreatedForm).not.toHaveBeenCalled();
    });

    it("clears the error after a later successful attempt", async () => {
      const createDraft = vi
        .fn()
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce(draftResult);
      const { service, repo } = setup({ createDraft });
      const { id } = await service.propose(actor, plan);
      await expect(service.createInMeta(actor, id)).rejects.toThrow(
        "Temporary failure",
      );
      expect(repo.rows.get(id)!.error).toBe("Temporary failure");
      const created = await service.createInMeta(actor, id);
      expect(created).toMatchObject({ status: "created", error: null });
    });

    it("tracks the lead form it created", async () => {
      const { service, trackCreatedForm } = setup({
        createDraft: vi.fn(() =>
          Promise.resolve({ ...draftResult, leadFormId: "f1" }),
        ),
      });
      const { id } = await service.propose(actor, leadPlan);
      const created = await service.createInMeta(actor, id);
      expect(created.meta).toMatchObject({ leadFormId: "f1" });
      expect(trackCreatedForm).toHaveBeenCalledWith(WORKSPACE, {
        formId: "f1",
        pageId: "p1",
        name: "Clinic demo form",
        planId: id,
        questions: [
          { key: "full_name", label: "FULL_NAME", type: "FULL_NAME" },
          { key: "phone_number", label: "PHONE", type: "PHONE" },
        ],
      });
    });

    it("creates the campaign once when two requests race", async () => {
      let release!: () => void;
      const createDraft = vi.fn(
        () =>
          new Promise((resolve) => {
            release = () => resolve(draftResult);
          }),
      );
      const { service } = setup({ createDraft });
      const { id } = await service.propose(actor, plan);
      const first = service.createInMeta(actor, id);
      const second = service.createInMeta(actor, id);
      await vi.waitFor(() => expect(createDraft).toHaveBeenCalled());
      release();
      const [a, b] = await Promise.allSettled([first, second]);
      expect(a).toMatchObject({
        status: "fulfilled",
        value: { status: "created" },
      });
      expect(b).toMatchObject({
        status: "rejected",
        reason: {
          httpStatus: 409,
          message: "This plan was already created in Meta.",
        },
      });
      expect(createDraft).toHaveBeenCalledTimes(1);
    });
  });

  describe("createInMeta with the Graph API failing partway", () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterAll(() => vi.unstubAllGlobals());

    class TestClient extends GraphAdsClient {
      protected override wait(): Promise<void> {
        return Promise.resolve();
      }
    }

    function realAds() {
      const client = new TestClient({
        get: () => "v23.0",
      } as unknown as AppConfig);
      return new AdsService(
        connections,
        client,
        {} as ConfirmationService,
        { record: () => Promise.resolve() } as unknown as AuditService,
        {
          get: () => Promise.resolve(null),
          set: () => Promise.resolve(),
        } as unknown as CacheService,
        { hash: (s: string) => String(s.length) } as unknown as CryptoService,
        settings,
      );
    }

    it("deletes the campaign, archives the lead form and leaves the plan a draft", async () => {
      const ads = realAds();
      const { service, repo, trackCreatedForm } = setup({
        createDraft: ads.createDraft.bind(ads),
      });
      const { id } = await service.propose(actor, leadPlan);
      fetchMock
        .mockResolvedValueOnce(json({ access_token: "page-tok", id: "p1" }))
        .mockResolvedValueOnce(json({ id: "f1" }))
        .mockResolvedValueOnce(json({ id: "c1" }))
        .mockResolvedValueOnce(json({ id: "s1" }))
        .mockResolvedValueOnce(
          json({ error: { code: 100, message: "Invalid creative" } }, 400),
        )
        .mockResolvedValueOnce(json({ success: true }))
        .mockResolvedValueOnce(json({ success: true }));

      await expect(service.createInMeta(actor, id)).rejects.toMatchObject({
        code: "META_REJECTED",
      });

      const calls = fetchMock.mock.calls.map(([url, init]) => ({
        url: url as string,
        method: init?.method,
        body: init?.body as URLSearchParams | undefined,
      }));
      expect(calls).toHaveLength(7);
      expect(calls[5]).toMatchObject({ method: "DELETE" });
      expect(calls[5]!.url).toContain("/c1");
      expect(calls[6]!.url).toContain("/f1");
      expect(calls[6]!.body?.get("status")).toBe("ARCHIVED");
      expect(repo.rows.get(id)).toMatchObject({ status: "draft", meta: null });
      expect(repo.rows.get(id)!.error).toBeTruthy();
      expect(trackCreatedForm).not.toHaveBeenCalled();
    });
  });

  describe("launch", () => {
    it("launches a created plan in its own ad account", async () => {
      const { service, ads, actions } = setup();
      const { id } = await service.propose(actor, plan);
      await service.createInMeta(actor, id);
      const launched = await service.launch(actor, id);
      expect(launched.status).toBe("launched");
      expect(ads.launchNow).toHaveBeenCalledWith(actor, "c1", "act_1");
      expect(actions()).toContain("plan.launched");
      await expect(service.launch(actor, id)).rejects.toMatchObject({
        httpStatus: 409,
      });
    });

    it("refuses to launch a draft", async () => {
      const { service, ads } = setup();
      const { id } = await service.propose(actor, plan);
      await expect(service.launch(actor, id)).rejects.toMatchObject({
        httpStatus: 409,
        message: "Create the campaign in Meta before launching it.",
      });
      expect(ads.launchNow).not.toHaveBeenCalled();
    });

    it("stays created when Meta refuses to activate", async () => {
      const { service, repo } = setup({
        launchNow: vi.fn(() => Promise.reject(new Error("Ad account closed"))),
      });
      const { id } = await service.propose(actor, plan);
      await service.createInMeta(actor, id);
      await expect(service.launch(actor, id)).rejects.toThrow(
        "Ad account closed",
      );
      expect(repo.rows.get(id)!.status).toBe("created");
    });

    it("needs an explicit confirmation from the app", async () => {
      const launch = vi.fn(() => Promise.resolve({ status: "launched" }));
      const controller = new PlansController(
        { launch } as unknown as PlanService,
        {} as PlanGeneratorService,
      );
      const ctx: TenantContext = {
        userId: "u1",
        workspaceId: WORKSPACE,
        sessionId: "s1",
      };
      expect(() => controller.launch(ctx, "p1", { confirm: false })).toThrow(
        "Confirm the launch to continue.",
      );
      expect(launch).not.toHaveBeenCalled();
      await controller.launch(ctx, "p1", { confirm: true });
      expect(launch).toHaveBeenCalledWith(actor, "p1");
    });
  });
});
