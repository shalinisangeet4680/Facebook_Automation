import { Inject, Injectable } from "@nestjs/common";

import { CreativesService } from "@modules/creatives/application/creatives.service";
import { POST_AI, PostAi } from "@modules/engine/domain/ports/post-ai";
import { ReplyAiError } from "@modules/engine/domain/ports/reply-ai";
import { scheduleProblem } from "@modules/social/domain/post.rules";
import {
  DomainError,
  NotFoundError,
  ValidationError,
} from "@shared/errors/domain-error";

import { bestHourFor, defaultBestTimes } from "../domain/best-time";
import { planWeek } from "../domain/calendar";
import {
  BrandKit,
  CONTENT_LABELS,
  ContentType,
  FORMATS_BY_PLATFORM,
  FORMAT_LABELS,
  MediaItem,
  MediaKind,
  POST_STATUSES,
  PostContent,
  PostFormat,
  PostStatus,
  SocialPlatform,
  bannedWordIn,
  checkPost,
  defined,
  fullCaption,
  normalizeBrandKit,
} from "../domain/social.types";
import {
  addDays,
  isWeekStart,
  localParts,
  weekStartOf,
  zonedTime,
} from "../domain/time";
import {
  SocialAccountRow,
  SocialAutopostRow,
  SocialPlanRow,
} from "../infrastructure/social-engine.tables";
import { SocialActor, SocialEngine, contentOf } from "./social-engine.service";

export type BrandKitPatch = Partial<Omit<BrandKit, "colors" | "fonts">> & {
  colors?: Partial<BrandKit["colors"]>;
  fonts?: Partial<BrandKit["fonts"]>;
};

export interface MediaInput {
  creativeId?: string;
  url?: string;
  kind?: MediaKind;
}

export interface PostInput {
  accountId: string;
  format: PostFormat;
  contentType?: ContentType;
  idea?: string | null;
  caption?: string;
  hashtags?: string[];
  firstComment?: string | null;
  altText?: string | null;
  media?: MediaInput[];
  link?: string | null;
  location?: string | null;
  collaborators?: string[];
  when: "draft" | "approval" | "schedule" | "now";
  scheduledAt?: string | null;
  generateCaption?: boolean;
  generateImage?: boolean;
}

export type PostPatch = Partial<
  Omit<PostInput, "accountId" | "when" | "generateCaption" | "generateImage">
>;

const EDITABLE: PostStatus[] = [
  "draft",
  "pending_approval",
  "scheduled",
  "failed",
];

const BRAND_LABELS: Record<string, string> = {
  name: "Name",
  businessType: "Business type",
  audience: "Audience",
  voice: "Voice",
  topics: "Topics",
  offers: "Offers and products",
  hashtagSets: "Hashtag sets",
  bannedWords: "Banned words",
  logoUrl: "Logo",
  colors: "Colours",
  fonts: "Fonts",
  cta: "Call to action",
  link: "Link",
  websiteUrl: "Website",
  city: "City",
  language: "Language",
};

const show = (v: unknown): string => {
  if (Array.isArray(v))
    return v.length
      ? v
          .map((x: unknown) =>
            x && typeof x === "object" && "name" in x
              ? String((x as { name: string }).name)
              : JSON.stringify(x).replace(/^"|"$/g, ""),
          )
          .join(", ")
      : "none";
  if (v && typeof v === "object")
    return Object.values(v as Record<string, string>).join(" / ");
  if (v === null || v === undefined || v === "") return "empty";
  return typeof v === "string" ? v : JSON.stringify(v);
};

@Injectable()
export class SocialContentService {
  constructor(
    private readonly engine: SocialEngine,
    private readonly creatives: CreativesService,
    @Inject(POST_AI) private readonly postAi: PostAi,
  ) {}

  private get repo() {
    return this.engine.repo;
  }

  private async accountRow(workspaceId: string, id: string) {
    const account = await this.repo.account(workspaceId, id);
    if (!account) throw new NotFoundError("This account isn't connected.");
    return account;
  }

  async brandKit(workspaceId: string, accountId?: string | null) {
    const account = accountId
      ? await this.accountRow(workspaceId, accountId)
      : null;
    const own = account
      ? await this.repo.brandKit(workspaceId, account.id)
      : null;
    const shared = await this.repo.brandKit(workspaceId, null);
    const kit = await this.engine.brandFor(workspaceId, account);
    return {
      accountId: account?.id ?? null,
      custom: Boolean(own),
      saved: Boolean(own ?? shared),
      prefilledAt: (own ?? shared)?.prefilledAt?.toISOString() ?? null,
      kit,
    };
  }

  mergeKit(current: BrandKit, patch: BrandKitPatch): BrandKit {
    const clean = defined(patch);
    const next = normalizeBrandKit({
      ...current,
      ...clean,
      colors: { ...current.colors, ...defined(clean.colors) },
      fonts: { ...current.fonts, ...defined(clean.fonts) },
    });
    for (const [k, v] of Object.entries(next.colors))
      if (!/^#[0-9a-f]{6}$/i.test(v))
        throw new ValidationError(`The ${k} colour must look like #1A2B3C.`);
    for (const url of [next.link, next.logoUrl, next.websiteUrl])
      if (url && !/^https?:\/\//i.test(url))
        throw new ValidationError("Links must start with https://.");
    next.hashtagSets = next.hashtagSets.map((s) => ({
      name: s.name.trim(),
      tags: [
        ...new Set(
          s.tags.map((t) => t.trim().replace(/^#+/, "")).filter(Boolean),
        ),
      ],
    }));
    return next;
  }

  async previewBrandKit(
    workspaceId: string,
    accountId: string | null,
    patch: BrandKitPatch,
  ) {
    const current = (await this.brandKit(workspaceId, accountId)).kit;
    const next = this.mergeKit(current, patch);
    const changes: string[] = [];
    for (const key of Object.keys(BRAND_LABELS) as (keyof BrandKit)[]) {
      if (JSON.stringify(current[key]) !== JSON.stringify(next[key]))
        changes.push(
          `${BRAND_LABELS[key]}: ${show(current[key])} → ${show(next[key])}`,
        );
    }
    return { changes, enablesAuto: false };
  }

  async saveBrandKit(
    actor: SocialActor,
    accountId: string | null,
    patch: BrandKitPatch,
    prefilled = false,
  ) {
    const current = (await this.brandKit(actor.workspaceId, accountId)).kit;
    const kit = this.mergeKit(current, patch);
    await this.repo.saveBrandKit(actor.workspaceId, accountId, kit, prefilled);
    await this.engine.record(
      actor,
      "brand_kit_saved",
      accountId ?? actor.workspaceId,
      {
        account: accountId,
        changed: Object.keys(patch),
      },
    );
    return this.brandKit(actor.workspaceId, accountId);
  }

  async resetAccountKit(actor: SocialActor, accountId: string) {
    await this.accountRow(actor.workspaceId, accountId);
    await this.repo.deleteBrandKit(actor.workspaceId, accountId);
    return this.brandKit(actor.workspaceId, accountId);
  }

  async prefill(
    actor: SocialActor,
    input: {
      accountId?: string | null;
      websiteUrl?: string | null;
      save?: boolean;
    },
  ) {
    const account = input.accountId
      ? await this.accountRow(actor.workspaceId, input.accountId)
      : ((await this.repo.accounts(actor.workspaceId))[0] ?? null);
    const current = await this.engine.brandFor(actor.workspaceId, account);
    const websiteUrl = input.websiteUrl?.trim() || current.websiteUrl;
    let websiteText = "";
    if (websiteUrl)
      try {
        websiteText = await this.engine.api.readWebsite(websiteUrl);
      } catch (err) {
        if (!(err instanceof DomainError)) throw err;
        throw new ValidationError(err.message);
      }
    const captions = account
      ? (
          await this.repo.posts(
            actor.workspaceId,
            { accountId: account.id, statuses: ["published"], limit: 30 },
            "desc",
          )
        ).map((p) => p.caption)
      : [];
    if (!websiteText && !captions.length)
      throw new ValidationError(
        "Add your website address or connect an account with a few posts first.",
      );
    const { key } = await this.engine.aiKey(actor.workspaceId);
    if (!key)
      throw new ValidationError(
        "AI drafting is off for this workspace. Turn it on in settings to prefill the brand kit.",
      );
    let suggestion;
    try {
      suggestion = await this.postAi.brandKit(key, {
        name: current.name,
        websiteUrl: websiteUrl ?? null,
        websiteText,
        recentCaptions: captions,
      });
    } catch (err) {
      if (err instanceof ReplyAiError) throw new ValidationError(err.message);
      throw err;
    }
    const patch: BrandKitPatch = {
      websiteUrl: websiteUrl ?? null,
      businessType: current.businessType || suggestion.businessType,
      audience: current.audience || suggestion.audience,
      voice: suggestion.voice,
      topics: current.topics.length ? current.topics : suggestion.topics,
      offers: current.offers.length ? current.offers : suggestion.offers,
      hashtagSets: current.hashtagSets.length
        ? current.hashtagSets
        : suggestion.hashtags.length
          ? [{ name: "Brand", tags: suggestion.hashtags }]
          : [],
      cta: current.cta || suggestion.cta,
      city: current.city || suggestion.city,
      link: current.link || websiteUrl || null,
    };
    if (input.save)
      return {
        ...(await this.saveBrandKit(
          actor,
          input.accountId ?? null,
          patch,
          true,
        )),
        suggested: true,
      };
    return {
      accountId: input.accountId ?? null,
      custom: false,
      saved: false,
      prefilledAt: null,
      kit: this.mergeKit(current, patch),
      suggested: true,
    };
  }

  async resolveMedia(
    workspaceId: string,
    items: MediaInput[],
  ): Promise<MediaItem[]> {
    const out: MediaItem[] = [];
    for (const m of items) {
      if (m.creativeId) {
        const row = await this.creatives.get(workspaceId, m.creativeId);
        const view = this.creatives.view(row);
        out.push({
          url: view.url,
          kind: view.kind,
          creativeId: view.id,
          width: view.width,
          height: view.height,
          durationSeconds: view.durationSeconds,
        });
      } else if (m.url) {
        if (!/^https:\/\//i.test(m.url))
          throw new ValidationError("Media links must start with https://.");
        out.push({
          url: m.url,
          kind:
            m.kind ?? (/\.(mp4|mov)(\?|$)/i.test(m.url) ? "video" : "image"),
          creativeId: null,
          width: null,
          height: null,
          durationSeconds: null,
        });
      }
    }
    return out;
  }

  private problemsFor(
    platform: SocialPlatform,
    format: PostFormat,
    content: PostContent,
    brand: BrandKit,
  ) {
    const banned = bannedWordIn(fullCaption(content), brand.bannedWords);
    return [
      ...checkPost(platform, format, content),
      ...(banned ? [`Uses the banned word "${banned}".`] : []),
    ];
  }

  postView(
    p: SocialAutopostRow,
    account: SocialAccountRow | null,
    brand: BrandKit | null,
  ) {
    return {
      id: p.id,
      accountId: p.accountId,
      accountName: account?.username ?? account?.name ?? "",
      planId: p.planId,
      platform: p.platform,
      format: p.format,
      contentType: p.contentType,
      idea: p.idea,
      caption: p.caption,
      hashtags: p.hashtags,
      firstComment: p.firstComment,
      altText: p.altText,
      media: p.media,
      link: p.link,
      location: p.location,
      collaborators: p.collaborators,
      status: p.status,
      mode: p.mode,
      heldReason: p.heldReason,
      scheduledAt: p.scheduledAt?.toISOString() ?? null,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      permalink: p.permalink,
      error: p.error,
      source: p.source,
      aiWritten: p.aiWritten,
      problems:
        p.status === "published" || !brand
          ? []
          : this.problemsFor(p.platform, p.format, contentOf(p), brand),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private async views(workspaceId: string, rows: SocialAutopostRow[]) {
    const accounts = new Map<string, SocialAccountRow>();
    const brands = new Map<string, BrandKit>();
    for (const id of new Set(rows.map((r) => r.accountId))) {
      const a = await this.repo.accountById(id);
      if (a) {
        accounts.set(id, a);
        brands.set(id, await this.engine.brandFor(workspaceId, a));
      }
    }
    return rows.map((r) =>
      this.postView(
        r,
        accounts.get(r.accountId) ?? null,
        brands.get(r.accountId) ?? null,
      ),
    );
  }

  async view(workspaceId: string, id: string) {
    const row = await this.repo.post(workspaceId, id);
    if (!row) throw new NotFoundError("This post doesn't exist.");
    return (await this.views(workspaceId, [row]))[0]!;
  }

  async posts(
    workspaceId: string,
    q: {
      platform?: SocialPlatform;
      accountId?: string;
      statuses?: PostStatus[];
      from?: string;
      to?: string;
      limit?: number;
    },
  ) {
    const statuses = q.statuses?.filter((s) => POST_STATUSES.includes(s));
    const rows = await this.repo.posts(
      workspaceId,
      {
        platform: q.platform,
        accountId: q.accountId,
        statuses: statuses?.length ? statuses : undefined,
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        limit: q.limit ?? 200,
      },
      q.from ? "asc" : "desc",
    );
    return { data: await this.views(workspaceId, rows) };
  }

  planView(plan: SocialPlanRow) {
    return {
      id: plan.id,
      accountId: plan.accountId,
      weekStart: plan.weekStart,
      summary: plan.summary,
      source: plan.source,
      createdAt: plan.createdAt.toISOString(),
    };
  }

  async calendar(
    workspaceId: string,
    q: {
      platform: SocialPlatform;
      accountId?: string;
      from: string;
      to: string;
    },
  ) {
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to <= from
    )
      throw new ValidationError("Choose a valid date range.");
    if (to.getTime() - from.getTime() > 62 * 86_400_000)
      throw new ValidationError("Show at most two months at a time.");
    const accounts = (await this.repo.accounts(workspaceId, q.platform)).filter(
      (a) => !q.accountId || a.id === q.accountId,
    );
    const rows = (
      await this.repo.posts(workspaceId, {
        platform: q.platform,
        accountId: q.accountId,
        from,
        to,
        limit: 500,
      })
    ).filter((p) => p.status !== "cancelled");
    const plans = await this.repo.plans(
      workspaceId,
      accounts.map((a) => a.id),
      12,
    );
    return {
      data: await this.views(workspaceId, rows),
      plans: plans.map((p) => this.planView(p)),
    };
  }

  nextBestTime(account: SocialAccountRow, after: Date): Date {
    const settings = this.engine.settingsOf(account);
    const times = account.bestTimes ?? defaultBestTimes(account.platform, "");
    const today = localParts(after, settings.timezone).day;
    for (let d = 0; d < 8; d++) {
      const day = addDays(today, d);
      const weekday = localParts(
        zonedTime(day, 12, 0, settings.timezone),
        settings.timezone,
      ).weekday;
      const hours = times.slots
        .filter((s) => s.weekday === weekday)
        .map((s) => s.hour)
        .sort((a, b) => a - b);
      for (const hour of hours.length ? hours : [bestHourFor(weekday, times)]) {
        const at = zonedTime(day, hour, 0, settings.timezone);
        if (at.getTime() > after.getTime() + 30 * 60_000) return at;
      }
    }
    return new Date(after.getTime() + 86_400_000);
  }

  private defaultWeek(account: SocialAccountRow, now: Date) {
    const tz = this.engine.settingsOf(account).timezone;
    const local = localParts(now, tz);
    return local.weekday <= 3
      ? weekStartOf(now, tz)
      : addDays(weekStartOf(now, tz), 7);
  }

  async generatePlan(
    actor: SocialActor,
    input: { accountId: string; weekStart?: string | null },
  ) {
    const account = await this.accountRow(actor.workspaceId, input.accountId);
    this.engine.usable(account);
    const settings = this.engine.settingsOf(account);
    const now = new Date();
    const weekStart = input.weekStart ?? this.defaultWeek(account, now);
    const thisWeek = weekStartOf(now, settings.timezone);
    if (!isWeekStart(weekStart))
      throw new ValidationError("A week starts on a Monday (YYYY-MM-DD).");
    if (weekStart < thisWeek || weekStart > addDays(thisWeek, 56))
      throw new ValidationError(
        "Plan this week or one of the next eight weeks.",
      );
    const brand = await this.engine.brandFor(actor.workspaceId, account);
    const bestTimes =
      account.bestTimes ??
      defaultBestTimes(account.platform, brand.businessType);
    const slots = planWeek({
      weekStart,
      timezone: settings.timezone,
      platform: account.platform,
      postsPerWeek: settings.postsPerWeek,
      formats: settings.formats,
      bestTimes,
      brand,
      now,
    });
    const existing = await this.repo.plan(account.id, weekStart);
    if (existing) await this.repo.clearPlanDrafts(existing.id);
    const counts = new Map<string, number>();
    for (const s of slots)
      counts.set(
        CONTENT_LABELS[s.contentType],
        (counts.get(CONTENT_LABELS[s.contentType]) ?? 0) + 1,
      );
    const plan = await this.repo.savePlan({
      workspaceId: actor.workspaceId,
      accountId: account.id,
      weekStart,
      summary: slots.length
        ? `${slots.length} posts: ${[...counts.entries()].map(([k, n]) => `${n} ${k.toLowerCase()}`).join(", ")}.`
        : "No slots left this week.",
      source: actor.via,
      createdBy: actor.userId,
    });
    const { key, allowance: start } = await this.engine.aiKey(
      actor.workspaceId,
    );
    let allowance = start;
    for (const slot of slots) {
      const written = await this.engine.write(
        account.platform,
        brand,
        { format: slot.format, contentType: slot.contentType, idea: slot.idea },
        allowance > 0 ? key : null,
      );
      if (written.ai) allowance--;
      const media = await this.engine.visuals(
        actor,
        brand,
        slot.format,
        slot.contentType,
        written.headline,
        written.caption,
      );
      const content: PostContent = {
        caption: written.caption,
        hashtags: written.hashtags,
        firstComment: slot.format === "story" ? null : written.firstComment,
        altText: written.altText,
        media,
        link: slot.format === "link" ? (brand.link ?? brand.websiteUrl) : null,
        location: null,
        collaborators: [],
      };
      const mode = settings.modes[slot.contentType];
      const decision = await this.engine.decide(account, {
        mode,
        platform: account.platform,
        format: slot.format,
        content,
        scheduledAt: slot.at,
      });
      await this.repo.insertPost({
        workspaceId: actor.workspaceId,
        accountId: account.id,
        planId: plan.id,
        platform: account.platform,
        format: slot.format,
        contentType: slot.contentType,
        idea: slot.idea,
        ...content,
        status: decision.status,
        mode,
        heldReason:
          decision.held ??
          (slot.format === "reel" || slot.format === "video"
            ? "Upload a video before this goes out."
            : null),
        scheduledAt: decision.scheduledAt,
        source: actor.via === "app" ? "plan" : `plan:${actor.via}`,
        aiWritten: written.ai,
        createdBy: actor.userId,
      });
    }
    await this.engine.record(actor, "plan_generated", plan.id, {
      account: account.id,
      weekStart,
      posts: slots.length,
    });
    const posts = await this.repo.posts(actor.workspaceId, {
      accountId: account.id,
      from: zonedTime(weekStart, 0, 0, settings.timezone),
      to: zonedTime(addDays(weekStart, 7), 0, 0, settings.timezone),
    });
    return {
      plan: this.planView(plan),
      posts: await this.views(
        actor.workspaceId,
        posts.filter((p) => p.planId === plan.id),
      ),
    };
  }

  async plans(workspaceId: string, platform: SocialPlatform) {
    const accounts = await this.repo.accounts(workspaceId, platform);
    const rows = await this.repo.plans(
      workspaceId,
      accounts.map((a) => a.id),
    );
    return { data: rows.map((p) => this.planView(p)) };
  }

  async write(
    actor: SocialActor,
    input: {
      accountId: string;
      format: PostFormat;
      contentType: ContentType;
      idea: string;
      avoid?: string | null;
    },
  ) {
    const account = await this.accountRow(actor.workspaceId, input.accountId);
    const brand = await this.engine.brandFor(actor.workspaceId, account);
    const { key, allowance } = await this.engine.aiKey(actor.workspaceId);
    const written = await this.engine.write(
      account.platform,
      brand,
      input,
      allowance > 0 ? key : null,
    );
    return {
      headline: written.headline,
      caption: written.caption,
      hashtags: written.hashtags,
      firstComment: written.firstComment,
      altText: written.altText,
      ai: written.ai,
    };
  }

  private async build(
    actor: SocialActor,
    account: SocialAccountRow,
    input: PostInput | (PostPatch & { format: PostFormat }),
    base: PostContent | null,
    generate: { caption: boolean; image: boolean; contentType: ContentType },
  ) {
    if (!FORMATS_BY_PLATFORM[account.platform].includes(input.format))
      throw new ValidationError(
        `${account.platform === "instagram" ? "Instagram" : "Facebook"} doesn't support ${FORMAT_LABELS[input.format]} posts.`,
      );
    const brand = await this.engine.brandFor(actor.workspaceId, account);
    let content: PostContent = {
      caption: input.caption ?? base?.caption ?? "",
      hashtags: (input.hashtags ?? base?.hashtags ?? [])
        .map((t) => t.trim().replace(/^#+/, ""))
        .filter(Boolean),
      firstComment:
        input.firstComment !== undefined
          ? input.firstComment?.trim() || null
          : (base?.firstComment ?? null),
      altText:
        input.altText !== undefined
          ? input.altText?.trim() || null
          : (base?.altText ?? null),
      media: input.media
        ? await this.resolveMedia(actor.workspaceId, input.media)
        : (base?.media ?? []),
      link:
        input.link !== undefined ? input.link || null : (base?.link ?? null),
      location:
        input.location !== undefined
          ? input.location || null
          : (base?.location ?? null),
      collaborators: (input.collaborators ?? base?.collaborators ?? [])
        .map((c) => c.trim().replace(/^@/, ""))
        .filter(Boolean),
    };
    let aiWritten = false;
    let headline = input.idea ?? "";
    if (generate.caption) {
      if (!input.idea?.trim())
        throw new ValidationError(
          "Describe the post idea so it can be written.",
        );
      const { key, allowance } = await this.engine.aiKey(actor.workspaceId);
      const written = await this.engine.write(
        account.platform,
        brand,
        {
          format: input.format,
          contentType: generate.contentType,
          idea: input.idea,
        },
        allowance > 0 ? key : null,
      );
      aiWritten = written.ai;
      headline = written.headline;
      content = {
        ...content,
        caption: written.caption,
        hashtags: content.hashtags.length ? content.hashtags : written.hashtags,
        firstComment: content.firstComment ?? written.firstComment,
        altText: content.altText ?? written.altText,
      };
    }
    if (generate.image && !content.media.length)
      content.media = await this.engine.visuals(
        actor,
        brand,
        input.format,
        generate.contentType,
        headline ||
          content.caption.split(/[.!?\n]/)[0]!.slice(0, 60) ||
          brand.name,
        content.caption,
      );
    if (input.format === "story") content.firstComment = null;
    return {
      content,
      aiWritten,
      problems: this.problemsFor(
        account.platform,
        input.format,
        content,
        brand,
      ),
    };
  }

  async check(actor: SocialActor, input: PostInput) {
    const account = await this.accountRow(actor.workspaceId, input.accountId);
    const { problems } = await this.build(actor, account, input, null, {
      caption: false,
      image: false,
      contentType: input.contentType ?? "tip",
    });
    return { problems };
  }

  async createPost(actor: SocialActor, input: PostInput) {
    const account = await this.accountRow(actor.workspaceId, input.accountId);
    const contentType = input.contentType ?? "announcement";
    const { content, aiWritten, problems } = await this.build(
      actor,
      account,
      input,
      null,
      {
        caption: Boolean(input.generateCaption),
        image: Boolean(input.generateImage),
        contentType,
      },
    );
    const requested = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (requested && Number.isNaN(requested.getTime()))
      throw new ValidationError("Choose a valid date and time.");
    if ((input.when === "schedule" || input.when === "now") && problems.length)
      throw new ValidationError(problems.join(" "));
    if (input.when === "schedule") {
      const problem = scheduleProblem(requested);
      if (!requested) throw new ValidationError("Choose when to post.");
      if (problem) throw new ValidationError(problem);
    }
    const scheduledAt =
      input.when === "now"
        ? new Date()
        : (requested ??
          (input.when === "approval"
            ? this.nextBestTime(account, new Date())
            : null));
    const status: PostStatus =
      input.when === "now"
        ? "publishing"
        : input.when === "schedule"
          ? "scheduled"
          : input.when === "approval"
            ? "pending_approval"
            : "draft";
    const row = await this.repo.insertPost({
      workspaceId: actor.workspaceId,
      accountId: account.id,
      platform: account.platform,
      format: input.format,
      contentType,
      idea: input.idea ?? null,
      ...content,
      status,
      mode: input.when === "draft" ? "manual" : "approval",
      scheduledAt,
      source: actor.via,
      aiWritten,
      createdBy: actor.userId,
      approvedBy:
        input.when === "schedule" || input.when === "now" ? actor.userId : null,
    });
    await this.engine.record(actor, "post_created", row.id, {
      account: account.id,
      format: input.format,
      when: input.when,
    });
    if (input.when === "now") {
      const published = await this.engine.publish(row, actor);
      if (published.status === "failed")
        throw new ValidationError(
          published.error ?? "The post couldn't be published.",
        );
    }
    return this.view(actor.workspaceId, row.id);
  }

  private async editable(workspaceId: string, id: string) {
    const row = await this.repo.post(workspaceId, id);
    if (!row) throw new NotFoundError("This post doesn't exist.");
    if (!EDITABLE.includes(row.status))
      throw new ValidationError(
        row.status === "published"
          ? "Published posts can't be edited here."
          : "This post can't be changed now.",
      );
    return row;
  }

  async updatePost(actor: SocialActor, id: string, patch: PostPatch) {
    const row = await this.editable(actor.workspaceId, id);
    const account = await this.accountRow(actor.workspaceId, row.accountId);
    const format = patch.format ?? row.format;
    const { content, problems } = await this.build(
      actor,
      account,
      { ...patch, format },
      contentOf(row),
      {
        caption: false,
        image: false,
        contentType: patch.contentType ?? row.contentType,
      },
    );
    let scheduledAt = row.scheduledAt;
    if (patch.scheduledAt !== undefined) {
      scheduledAt = patch.scheduledAt ? new Date(patch.scheduledAt) : null;
      if (scheduledAt && Number.isNaN(scheduledAt.getTime()))
        throw new ValidationError("Choose a valid date and time.");
      if (row.status === "scheduled") {
        const problem = scheduleProblem(scheduledAt);
        if (!scheduledAt || problem)
          throw new ValidationError(problem ?? "Choose when to post.");
      }
    }
    if (row.status === "scheduled" && problems.length)
      throw new ValidationError(problems.join(" "));
    await this.repo.updatePost(row.id, {
      ...content,
      format,
      contentType: patch.contentType ?? row.contentType,
      idea: patch.idea !== undefined ? patch.idea : row.idea,
      scheduledAt,
      heldReason: null,
      error: row.status === "failed" ? row.error : null,
    });
    await this.engine.record(actor, "post_updated", row.id, {
      changed: Object.keys(patch),
    });
    return this.view(actor.workspaceId, row.id);
  }

  async approve(actor: SocialActor, id: string) {
    const row = await this.repo.post(actor.workspaceId, id);
    if (!row) throw new NotFoundError("This post doesn't exist.");
    if (!["draft", "pending_approval"].includes(row.status))
      throw new ValidationError(
        "Only drafts and posts waiting for approval can be approved.",
      );
    const account = await this.accountRow(actor.workspaceId, row.accountId);
    const brand = await this.engine.brandFor(actor.workspaceId, account);
    const problems = this.problemsFor(
      row.platform,
      row.format,
      contentOf(row),
      brand,
    );
    if (problems.length) throw new ValidationError(problems.join(" "));
    const soon = new Date(Date.now() + 60_000);
    const scheduledAt =
      row.scheduledAt && row.scheduledAt > soon
        ? row.scheduledAt
        : this.nextBestTime(account, new Date());
    await this.repo.updatePost(row.id, {
      status: "scheduled",
      scheduledAt,
      approvedBy: actor.userId,
      heldReason: null,
      error: null,
    });
    await this.engine.record(actor, "post_approved", row.id);
    return this.view(actor.workspaceId, row.id);
  }

  async approveAll(
    actor: SocialActor,
    input: { platform: SocialPlatform; accountId?: string; ids?: string[] },
  ) {
    const rows = input.ids?.length
      ? (
          await Promise.all(
            input.ids.map((id) => this.repo.post(actor.workspaceId, id)),
          )
        ).filter((r): r is SocialAutopostRow => Boolean(r))
      : await this.repo.posts(actor.workspaceId, {
          platform: input.platform,
          accountId: input.accountId,
          statuses: ["pending_approval"],
          limit: 100,
        });
    let approved = 0;
    const failed: { id: string; error: string }[] = [];
    for (const r of rows.filter((x) => x.status === "pending_approval")) {
      try {
        await this.approve(actor, r.id);
        approved++;
      } catch (err) {
        failed.push({ id: r.id, error: this.engine.message(err, "Failed.") });
      }
    }
    return { approved, failed };
  }

  async cancel(actor: SocialActor, id: string) {
    const row = await this.editable(actor.workspaceId, id);
    await this.repo.updatePost(row.id, { status: "cancelled" });
    await this.engine.record(actor, "post_cancelled", row.id);
    return this.view(actor.workspaceId, row.id);
  }

  async remove(actor: SocialActor, id: string) {
    const row = await this.repo.post(actor.workspaceId, id);
    if (!row) throw new NotFoundError("This post doesn't exist.");
    if (row.status === "publishing")
      throw new ValidationError("This post is being published right now.");
    await this.repo.deletePost(row.id);
    await this.engine.record(actor, "post_deleted", row.id);
  }

  async retry(actor: SocialActor, id: string) {
    const row = await this.repo.post(actor.workspaceId, id);
    if (!row) throw new NotFoundError("This post doesn't exist.");
    if (row.status !== "failed")
      throw new ValidationError("Only failed posts can be retried.");
    await this.repo.updatePost(row.id, {
      status: "scheduled",
      scheduledAt: new Date(),
      attempts: 0,
      error: null,
    });
    await this.engine.record(actor, "post_retried", row.id);
    return this.view(actor.workspaceId, row.id);
  }

  async publishNow(actor: SocialActor, id: string) {
    const row = await this.repo.post(actor.workspaceId, id);
    if (!row) throw new NotFoundError("This post doesn't exist.");
    const account = await this.accountRow(actor.workspaceId, row.accountId);
    const brand = await this.engine.brandFor(actor.workspaceId, account);
    const problems = this.problemsFor(
      row.platform,
      row.format,
      contentOf(row),
      brand,
    );
    if (problems.length) throw new ValidationError(problems.join(" "));
    const claimed = await this.repo.claimPost(row.id);
    if (!claimed)
      throw new ValidationError("This post can't be published now.");
    await this.repo.updatePost(row.id, { approvedBy: actor.userId });
    const published = await this.engine.publish(
      { ...claimed, approvedBy: actor.userId },
      actor,
    );
    if (published.status === "failed")
      throw new ValidationError(
        published.error ?? "The post couldn't be published.",
      );
    return this.view(actor.workspaceId, row.id);
  }

  async regenerate(actor: SocialActor, id: string, part: "caption" | "image") {
    const row = await this.editable(actor.workspaceId, id);
    const account = await this.accountRow(actor.workspaceId, row.accountId);
    const brand = await this.engine.brandFor(actor.workspaceId, account);
    if (part === "caption") {
      const { key, allowance } = await this.engine.aiKey(actor.workspaceId);
      const written = await this.engine.write(
        account.platform,
        brand,
        {
          format: row.format,
          contentType: row.contentType,
          idea:
            row.idea ??
            (row.caption.slice(0, 120) || CONTENT_LABELS[row.contentType]),
          avoid: row.caption,
        },
        allowance > 0 ? key : null,
      );
      await this.repo.updatePost(row.id, {
        caption: written.caption,
        hashtags: written.hashtags,
        firstComment: row.format === "story" ? null : written.firstComment,
        altText: written.altText,
        aiWritten: written.ai,
      });
    } else {
      const media = await this.engine.visuals(
        actor,
        { ...brand, colors: this.shuffle(brand.colors, row.media.length) },
        row.format,
        row.contentType,
        row.idea?.replace(/^[^:]+:\s*/, "") || row.caption.slice(0, 60),
        row.caption,
      );
      if (!media.length)
        throw new ValidationError(
          "This format uses your own video; upload one instead.",
        );
      await this.repo.updatePost(row.id, { media });
    }
    await this.engine.record(actor, "post_regenerated", row.id, { part });
    return this.view(actor.workspaceId, row.id);
  }

  private shuffle(
    colors: BrandKit["colors"],
    seed: number,
  ): BrandKit["colors"] {
    return seed % 2
      ? colors
      : {
          primary: colors.secondary,
          secondary: colors.primary,
          accent: colors.accent,
        };
  }

  async weeklyPlans(now = new Date(), limit = 20) {
    let created = 0;
    for (const account of await this.repo.activeAccounts(500)) {
      if (created >= limit) break;
      const settings = this.engine.settingsOf(account);
      if (!settings.weeklyPlan) continue;
      if (localParts(now, settings.timezone).weekday !== 6) continue;
      const next = addDays(weekStartOf(now, settings.timezone), 7);
      if (await this.repo.plan(account.id, next)) continue;
      try {
        await this.generatePlan(
          { userId: null, workspaceId: account.workspaceId, via: "schedule" },
          { accountId: account.id, weekStart: next },
        );
        created++;
      } catch {
        continue;
      }
    }
    return created;
  }
}
