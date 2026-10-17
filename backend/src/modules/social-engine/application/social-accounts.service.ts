import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { QuietHours } from "@modules/engine/domain/engine.types";
import { AppConfig, allowedOrigin, appUrl } from "@shared/config/app-config";
import {
  DomainError,
  NotFoundError,
  ValidationError,
} from "@shared/errors/domain-error";
import { CryptoService } from "@shared/security/crypto.service";

import { defaultBestTimes } from "../domain/best-time";
import {
  FACEBOOK_LOGIN_SCOPES,
  INSTAGRAM_LOGIN_SCOPES,
} from "../domain/ports/social-api";
import {
  AutopostSettings,
  CommentSettings,
  ContentType,
  LoginKind,
  PostFormat,
  PostMode,
  SocialPlatform,
  CommentClass,
  defaultSettings,
  defined,
} from "../domain/social.types";
import { SocialAccountRow } from "../infrastructure/social-engine.tables";
import { SocialCommentsService } from "./social-comments.service";
import {
  PRODUCT_PATH,
  SocialActor,
  SocialEngine,
} from "./social-engine.service";
import { SocialInsightsService } from "./social-insights.service";

const STATE_TTL_MS = 10 * 60_000;

export interface OAuthState {
  n: string;
  w: string;
  u: string | null;
  o: string;
  p: SocialPlatform;
  k: LoginKind;
  e: number;
}

export interface SettingsPatch {
  timezone?: string;
  quietHours?: QuietHours | null;
  dailyLimit?: number;
  weeklyLimit?: number;
  postsPerWeek?: number;
  neverAutoWords?: string[];
  autoPause?: boolean;
  weeklyPlan?: boolean;
  modes?: Partial<Record<ContentType, PostMode>>;
  formats?: PostFormat[];
  comments?: Partial<Omit<CommentSettings, "modes">> & {
    modes?: Partial<Record<CommentClass, PostMode>>;
  };
}

const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(
    private readonly engine: SocialEngine,
    private readonly comments: SocialCommentsService,
    private readonly insights: SocialInsightsService,
    private readonly crypto: CryptoService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  private get repo() {
    return this.engine.repo;
  }

  private redirectUri(origin = appUrl(this.config)) {
    return `${origin}/api/v1/autopost/oauth/callback`;
  }

  configured(login: LoginKind) {
    if (this.config.get("META_MOCK", { infer: true })) return true;
    return login === "facebook"
      ? Boolean(
          this.config.get("META_APP_ID", { infer: true }) &&
          this.config.get("META_APP_SECRET", { infer: true }),
        )
      : Boolean(
          this.config.get("INSTAGRAM_APP_ID", { infer: true }) &&
          this.config.get("INSTAGRAM_APP_SECRET", { infer: true }),
        );
  }

  status() {
    return {
      mock: this.config.get("META_MOCK", { infer: true }),
      facebookLogin: this.configured("facebook"),
      instagramLogin: this.configured("instagram"),
      redirectUri: this.redirectUri(),
      facebookScopes: FACEBOOK_LOGIN_SCOPES,
      instagramScopes: INSTAGRAM_LOGIN_SCOPES,
    };
  }

  start(
    actor: SocialActor,
    input: { login: LoginKind; product: SocialPlatform; origin?: string },
  ) {
    if (!this.configured(input.login))
      throw new ValidationError(
        input.login === "facebook"
          ? "Facebook sign-in isn't set up on this server yet. Add META_APP_ID and META_APP_SECRET."
          : "Instagram sign-in isn't set up on this server yet. Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET.",
      );
    const origin = allowedOrigin(this.config, input.origin);
    const nonce = this.crypto.randomToken(16);
    const state: OAuthState = {
      n: nonce,
      w: actor.workspaceId,
      u: actor.userId,
      o: origin,
      p: input.product,
      k: input.login,
      e: Date.now() + STATE_TTL_MS,
    };
    const encoded = Buffer.from(
      this.crypto.encrypt(JSON.stringify(state)),
    ).toString("base64url");
    return {
      url: this.engine.api.authUrl(
        input.login,
        this.redirectUri(origin),
        encoded,
      ),
      nonce,
      ttlSeconds: STATE_TTL_MS / 1000,
    };
  }

  readState(raw?: string): OAuthState | null {
    if (!raw) return null;
    try {
      return JSON.parse(
        this.crypto.decrypt(Buffer.from(raw, "base64url").toString()),
      ) as OAuthState;
    } catch {
      return null;
    }
  }

  async callback(
    query: { code?: string; state?: string; error?: string },
    cookieNonce: string | undefined,
  ): Promise<string> {
    const state = this.readState(query.state);
    const origin = allowedOrigin(this.config, state?.o);
    const product: SocialPlatform =
      state?.p === "facebook" ? "facebook" : "instagram";
    const base = `${origin}${PRODUCT_PATH[product]}/accounts`;
    const fail = (message: string) =>
      `${base}?error=${encodeURIComponent(message)}`;
    const via = state?.k === "instagram" ? "Instagram" : "Facebook";
    if (query.error)
      return fail(
        query.error === "access_denied"
          ? `${via} sign-in was cancelled.`
          : `${via} sign-in didn't finish. Try again.`,
      );
    if (
      !state ||
      !query.code ||
      state.e < Date.now() ||
      !cookieNonce ||
      !this.crypto.safeEqual(cookieNonce, state.n)
    )
      return fail("This sign-in link expired. Start again from TreeVook.");
    try {
      const grant = await this.engine.api.exchangeCode(
        state.k,
        query.code,
        this.redirectUri(origin),
      );
      const found = await this.engine.api.accounts(state.k, grant);
      if (!found.length)
        return fail(
          state.k === "facebook"
            ? "No Facebook Pages were shared. Sign in again and choose at least one Page."
            : "No Instagram professional account was found. Switch the account to Business or Creator and try again.",
        );
      const actor = { userId: state.u, workspaceId: state.w, via: "app" };
      let added = 0;
      for (const a of found) {
        const { row, created } = await this.repo.upsertAccount({
          workspaceId: state.w,
          platform: a.platform,
          login: state.k,
          externalId: a.externalId,
          name: a.name,
          username: a.username,
          avatarUrl: a.avatarUrl,
          category: a.category,
          pageId: a.pageId,
          tokenCiphertext: this.engine.encrypt(a.token),
          tokenExpiresAt: a.tokenExpiresAt,
          followers: a.followers,
          settings: defaultSettings(a.platform),
          connectedBy: state.u,
        });
        if (created) {
          added++;
          await this.firstSync(row);
        }
        await this.engine.record(
          actor,
          created ? "account_connected" : "account_reconnected",
          row.id,
          { platform: a.platform, login: state.k, name: a.name },
        );
      }
      return `${origin}${PRODUCT_PATH[product]}/accounts?connected=${added}`;
    } catch (err) {
      if (!(err instanceof DomainError))
        this.logger.error(
          "Social sign-in failed",
          err instanceof Error ? err.stack : String(err),
        );
      return fail(
        err instanceof DomainError
          ? err.message
          : `${via} sign-in didn't finish. Try again.`,
      );
    }
  }

  private async firstSync(account: SocialAccountRow) {
    try {
      await this.engine.importHistory(account);
      const fresh = (await this.repo.accountById(account.id))!;
      await this.insights.syncMetrics(fresh);
      await this.comments.sync((await this.repo.accountById(account.id))!);
    } catch (err) {
      this.logger.warn(
        `First sync failed for ${account.name}: ${(err as Error).message}`,
      );
    }
  }

  async accountRow(workspaceId: string, id: string) {
    const account = await this.repo.account(workspaceId, id);
    if (!account) throw new NotFoundError("This account isn't connected.");
    return account;
  }

  private view(
    a: SocialAccountRow,
    posts: { pending: number; scheduled: number } | undefined,
    comments: { open: number; waiting: number } | undefined,
  ) {
    return {
      id: a.id,
      platform: a.platform,
      login: a.login,
      externalId: a.externalId,
      name: a.name,
      username: a.username,
      avatarUrl: a.avatarUrl,
      category: a.category,
      pageId: a.pageId,
      status: a.status,
      error: a.error,
      followers: a.followers,
      tokenExpiresAt: a.tokenExpiresAt?.toISOString() ?? null,
      pausedUntil: a.pausedUntil?.toISOString() ?? null,
      pauseReason: a.pauseReason,
      commentsSyncedAt: a.commentsSyncedAt?.toISOString() ?? null,
      metricsSyncedAt: a.metricsSyncedAt?.toISOString() ?? null,
      pendingPosts: posts?.pending ?? 0,
      scheduledPosts: posts?.scheduled ?? 0,
      openComments: comments?.open ?? 0,
      waitingReplies: comments?.waiting ?? 0,
      createdAt: a.createdAt.toISOString(),
    };
  }

  async accounts(workspaceId: string, platform?: SocialPlatform) {
    const rows = await this.repo.accounts(workspaceId, platform);
    const ids = rows.map((r) => r.id);
    const [posts, comments] = await Promise.all([
      this.repo.postCounts(ids),
      this.repo.commentCounts(ids),
    ]);
    return {
      data: rows.map((a) => this.view(a, posts.get(a.id), comments.get(a.id))),
    };
  }

  async account(workspaceId: string, id: string) {
    const a = await this.accountRow(workspaceId, id);
    const [posts, comments, brand] = await Promise.all([
      this.repo.postCounts([a.id]),
      this.repo.commentCounts([a.id]),
      this.engine.brandFor(workspaceId, a),
    ]);
    return {
      ...this.view(a, posts.get(a.id), comments.get(a.id)),
      settings: this.engine.settingsOf(a),
      bestTimes:
        a.bestTimes ?? defaultBestTimes(a.platform, brand.businessType),
    };
  }

  merge(account: SocialAccountRow, patch: SettingsPatch): AutopostSettings {
    const current = this.engine.settingsOf(account);
    const { modes, comments, ...rest } = defined(patch);
    const next = {
      ...current,
      ...rest,
      modes: { ...current.modes, ...defined(modes) },
      comments: {
        ...current.comments,
        ...defined(comments),
        modes: { ...current.comments.modes, ...defined(comments?.modes) },
      },
    } as AutopostSettings;
    if (!validTimezone(next.timezone))
      throw new ValidationError("Choose a valid time zone.");
    if (
      next.quietHours &&
      (!HHMM.test(next.quietHours.start) || !HHMM.test(next.quietHours.end))
    )
      throw new ValidationError("Quiet hours use HH:MM times.");
    if (next.weeklyLimit < next.dailyLimit)
      throw new ValidationError(
        "The weekly limit can't be lower than the daily limit.",
      );
    return this.engine.settingsOf({ ...account, settings: next });
  }

  async updateAccount(actor: SocialActor, id: string, patch: SettingsPatch) {
    const account = await this.accountRow(actor.workspaceId, id);
    const settings = this.merge(account, patch);
    await this.repo.updateAccount(account.id, {
      settings,
      ...(settings.autoPause ? {} : { pausedUntil: null, pauseReason: null }),
    });
    await this.engine.record(actor, "settings_updated", account.id, {
      changed: Object.keys(patch),
    });
    return this.account(actor.workspaceId, id);
  }

  async resume(actor: SocialActor, id: string) {
    const account = await this.accountRow(actor.workspaceId, id);
    await this.repo.updateAccount(account.id, {
      pausedUntil: null,
      pauseReason: null,
    });
    await this.engine.record(actor, "safety_resumed", account.id);
    return this.account(actor.workspaceId, id);
  }

  async remove(actor: SocialActor, id: string) {
    const account = await this.accountRow(actor.workspaceId, id);
    await this.repo.deleteAccount(account.id);
    await this.engine.record(actor, "account_removed", account.id, {
      platform: account.platform,
      name: account.name,
    });
  }

  async sync(actor: SocialActor, id: string) {
    const account = await this.accountRow(actor.workspaceId, id);
    this.engine.usable(account);
    const comments = await this.comments.sync(account);
    const metrics = await this.insights.syncMetrics(
      (await this.repo.accountById(account.id))!,
    );
    await this.engine.record(actor, "account_synced", account.id);
    return { comments, metrics };
  }
}
