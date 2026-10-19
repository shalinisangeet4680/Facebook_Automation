import { AuditService } from "@modules/audit/application/audit.service";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import {
  CampaignDraftInput,
  MetaAds,
} from "@modules/meta/domain/ports/meta-ads";
import { SettingsService } from "@modules/settings/application/settings.service";
import { CacheService } from "@shared/cache/cache.service";
import { CryptoService } from "@shared/security/crypto.service";

import { DraftInput } from "../domain/ads.types";
import { AdsService } from "./ads.service";
import { ConfirmationService } from "./confirmation.service";

const asset = (kind: string, externalId: string, isPrimary = true) => ({
  id: externalId,
  kind,
  externalId,
  name: externalId,
  isPrimary,
  details: kind === "ad_account" ? { currency: "INR" } : {},
});

function setup() {
  const drafts: CampaignDraftInput[] = [];
  const uploadVideo = vi.fn((_t: string, _a: string, url: string) =>
    Promise.resolve({
      videoId: `v-${url.slice(-5)}`,
      thumbnailUrl: url.includes("nothumb") ? null : `${url}.jpg`,
    }),
  );
  const meta = {
    uploadVideo,
    createDraft: vi.fn((_t: string, input: CampaignDraftInput) => {
      drafts.push(input);
      return Promise.resolve({
        campaignId: "c1",
        adSetId: "s1",
        creativeId: "cr1",
        adId: "a1",
        ads: [{ label: "A", adId: "a1", creativeId: "cr1" }],
      });
    }),
  } as unknown as MetaAds;
  const connections = {
    accessToken: () => Promise.resolve("tok"),
    listAssets: () =>
      Promise.resolve({
        data: [
          asset("ad_account", "act_1"),
          asset("ad_account", "act_2", false),
          asset("page", "p1"),
        ],
      }),
  } as unknown as MetaConnectionService;
  const service = new AdsService(
    connections,
    meta,
    {} as ConfirmationService,
    { record: () => Promise.resolve() } as unknown as AuditService,
    {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(),
    } as unknown as CacheService,
    { hash: (s: string) => String(s.length) } as unknown as CryptoService,
    {
      targets: () =>
        Promise.resolve({
          maxDailyBudget: 5000,
          monthlyBudget: null,
          targetCostPerResult: null,
        }),
    } as unknown as SettingsService,
  );
  return { service, drafts, uploadVideo };
}

const actor = { userId: "u1", workspaceId: "w1", via: "app" };
const input: DraftInput = {
  name: "Clinic tour",
  goal: "traffic",
  dailyBudget: 500,
  targeting: { countries: ["IN"] },
  creative: {
    primaryText: "Main",
    headline: "Head",
    linkUrl: "https://example.com/",
    videoUrl: "https://app.example.com/media/clip1.mp4",
    callToAction: "LEARN_MORE",
  },
};

describe("AdsService.createDraft", () => {
  it("uploads each video once and uses Meta's thumbnail", async () => {
    const { service, drafts, uploadVideo } = setup();
    const result = await service.createDraft(actor, {
      ...input,
      variants: [
        { label: "B", primaryText: "Second", headline: "Two" },
        {
          label: "C",
          primaryText: "Third",
          headline: "Three",
          imageUrl: "https://example.com/c.png",
        },
      ],
    });
    expect(uploadVideo).toHaveBeenCalledTimes(1);
    expect(uploadVideo.mock.calls[0]!.slice(1, 3)).toEqual([
      "act_1",
      "https://app.example.com/media/clip1.mp4",
    ]);
    const draft = drafts[0]!;
    expect(draft.creative).toMatchObject({
      videoId: "v-1.mp4",
      imageUrl: "https://app.example.com/media/clip1.mp4.jpg",
      message: "Main",
    });
    expect(draft.variants).toEqual([
      expect.objectContaining({
        label: "B",
        creative: expect.objectContaining({
          videoId: "v-1.mp4",
          message: "Second",
          headline: "Two",
        }),
      }),
      expect.objectContaining({
        label: "C",
        creative: expect.objectContaining({
          videoId: null,
          imageUrl: "https://example.com/c.png",
        }),
      }),
    ]);
    expect(result).toMatchObject({ adAccountId: "act_1", campaignId: "c1" });
  });

  it("includes and excludes custom audiences in the ad set targeting", async () => {
    const { service, drafts } = setup();
    await service.createDraft(actor, {
      ...input,
      targeting: {
        countries: ["IN"],
        customAudiences: [{ id: "238510001" }],
        excludedCustomAudiences: [{ id: "238510002" }],
      },
    });
    expect(drafts[0]!.adSet.targeting).toMatchObject({
      custom_audiences: [{ id: "238510001" }],
      excluded_custom_audiences: [{ id: "238510002" }],
    });
  });

  it("needs a thumbnail when Meta doesn't make one", async () => {
    const { service } = setup();
    await expect(
      service.createDraft(actor, {
        ...input,
        creative: {
          ...input.creative,
          videoUrl: "https://app.example.com/nothumb.mp4",
        },
      }),
    ).rejects.toThrow("thumbnail");
  });

  it("refuses versions of an existing post", async () => {
    const { service } = setup();
    await expect(
      service.createDraft(actor, {
        ...input,
        creative: {
          ...input.creative,
          videoUrl: undefined,
          post: { platform: "facebook", id: "1_2" },
        },
        variants: [{ label: "B", primaryText: "x", headline: "y" }],
      }),
    ).rejects.toThrow("versions");
  });

  it("acts on a plan's own ad account even after switching", async () => {
    const { service } = setup();
    const ws = await service.account("w1", "act_2");
    expect(ws.adAccount.externalId).toBe("act_2");
    await expect(service.account("w1", "act_9")).rejects.toThrow(
      "no longer connected",
    );
  });
});
