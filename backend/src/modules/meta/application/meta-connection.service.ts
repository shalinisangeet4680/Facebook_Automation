import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { AuditService } from "@modules/audit/application/audit.service";
import { DATABASE, Database } from "@shared/database/database";
import {
  CodedError,
  DomainError,
  NotFoundError,
  ValidationError,
} from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";
import { CryptoService } from "@shared/security/crypto.service";
import { TenantContext } from "@shared/tenant/tenant-context";

import { metaNotConnected } from "../domain/meta.errors";
import {
  GUIDE_STEPS,
  missingPermissions,
  PERMISSIONS,
} from "../domain/meta.requirements";
import {
  AssetView,
  ConnectionCheck,
  ConnectionView,
  DiscoveredAsset,
  META_EVENTS,
  MetaConnectedEvent,
} from "../domain/meta.types";
import { META_GRAPH, MetaGraph } from "../domain/ports/meta-graph";
import { MetaAssetRepository } from "../infrastructure/meta-asset.repository";
import { MetaConnectionRepository } from "../infrastructure/meta-connection.repository";
import {
  MetaAssetKind,
  MetaAssetRow,
  MetaConnectionMethod,
} from "../infrastructure/meta.tables";

const TOKEN_PATTERN = /^EAA[A-Za-z0-9]{30,}$/;
const MAX_AD_ACCOUNTS_FOR_DATASETS = 10;

export type MetaActor = Pick<TenantContext, "workspaceId" | "userId">;

export interface AdAccountSwitch {
  adAccount: { id: string; name: string; currency: string };
  changed: boolean;
  dataset: "kept" | "switched" | "cleared";
  needsReview: boolean;
  connection: ConnectionView;
}

export function datasetBelongs(
  dataset: Pick<MetaAssetRow, "data">,
  adAccountId: string,
): boolean {
  const ids = dataset.data.adAccountIds;
  if (Array.isArray(ids)) return ids.includes(adAccountId);
  const single = dataset.data.adAccountId;
  return typeof single !== "string" || single === adAccountId;
}

export function datasetFor(
  rows: Pick<MetaAssetRow, "kind" | "externalId" | "isPrimary" | "data">[],
  adAccountId: string,
):
  | { action: "keep" }
  | { action: "select"; datasetId: string }
  | { action: "clear" } {
  const datasets = rows.filter((r) => r.kind === "dataset");
  const current = datasets.find((d) => d.isPrimary);
  if (current && datasetBelongs(current, adAccountId))
    return { action: "keep" };
  const fitting = datasets.filter((d) => datasetBelongs(d, adAccountId));
  if (fitting.length === 1)
    return { action: "select", datasetId: fitting[0]!.externalId };
  return current ? { action: "clear" } : { action: "keep" };
}

export interface AssetSelection {
  adAccountId?: string;
  pageId?: string;
  instagramId?: string;
  datasetId?: string;
}

@Injectable()
export class MetaConnectionService {
  private readonly logger = new Logger(MetaConnectionService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(META_GRAPH) private readonly graph: MetaGraph,
    private readonly connections: MetaConnectionRepository,
    private readonly assets: MetaAssetRepository,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  requirements() {
    return { steps: GUIDE_STEPS, permissions: PERMISSIONS };
  }

  connect(ctx: TenantContext, rawToken: string): Promise<ConnectionView> {
    const token = rawToken.trim();
    if (!TOKEN_PATTERN.test(token)) {
      throw new ValidationError(
        "That doesn't look like a Meta access token. It should start with EAA.",
      );
    }
    return this.connectWith(ctx, token, "system_user_token");
  }

  async connectWith(
    actor: MetaActor,
    token: string,
    method: MetaConnectionMethod,
  ): Promise<ConnectionView> {
    const viaLogin = method === "facebook_login";
    const identity = await this.graph.identity(token);
    const granted = await this.graph.grantedPermissions(token);
    const missing = missingPermissions(granted);
    const baseChecks: ConnectionCheck[] = [
      check("token", "Token", "passed", "Token is valid."),
      check(
        "identity",
        "System user",
        "passed",
        `Connected as ${identity.name}.`,
      ),
      permissionCheck(missing),
    ];

    if (missing.required.length) {
      this.logger.warn(
        `Meta token missing permissions (${viaLogin ? "facebook_login" : "system_user_token"}): granted=[${granted.join(",")}] missing=[${missing.required.join(",")}]`,
      );
      throw new CodedError(
        ErrorCode.META_PERMISSIONS_MISSING,
        422,
        viaLogin
          ? `Facebook didn't grant every permission we need: ${missing.required.join(", ")}. Continue with Facebook again and keep every permission switched on.`
          : `The token is missing required permissions: ${missing.required.join(", ")}. Generate a new token with every required permission ticked.`,
        { checks: baseChecks, missing },
      );
    }

    const discovered = await this.discover(token);
    const checks = [...baseChecks, ...assetChecks(discovered)];
    const failed = checks.filter((c) => c.status === "failed");
    if (failed.length) {
      throw new CodedError(
        ErrorCode.META_ASSETS_MISSING,
        422,
        viaLogin
          ? missingSharedAssets(failed.map((c) => c.key))
          : "Some required assets aren't assigned to the system user yet. Assign them in Business settings and try again.",
        { checks, missing },
      );
    }

    await this.db.transaction(async (tx) => {
      await this.connections.upsert(
        {
          workspaceId: actor.workspaceId,
          tokenCiphertext: this.crypto.encrypt(token),
          tokenLast4: token.slice(-4),
          systemUserId: identity.id,
          systemUserName: identity.name,
          grantedScopes: granted,
          method,
        },
        tx,
      );
      await this.assets.sync(actor.workspaceId, discovered, tx);
      await this.assets.autoSelectSingles(actor.workspaceId, tx);
    });

    await this.audit.record({
      workspaceId: actor.workspaceId,
      actor: "user",
      actorId: actor.userId,
      action: "meta.connected",
      target: identity.id,
      data: { systemUser: identity.name, assets: discovered.length, method },
    });
    this.events.emit(META_EVENTS.CONNECTED, {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
    } satisfies MetaConnectedEvent);

    return { ...(await this.view(actor.workspaceId)), checks };
  }

  view(workspaceId: string): Promise<ConnectionView> {
    return this.buildView(workspaceId);
  }

  async listAssets(workspaceId: string): Promise<{ data: AssetView[] }> {
    return { data: (await this.assets.list(workspaceId)).map(toAssetView) };
  }

  async select(
    ctx: TenantContext,
    selection: AssetSelection,
  ): Promise<ConnectionView> {
    if (!(await this.connections.find(ctx.workspaceId)))
      throw metaNotConnected();
    const rows = selection.adAccountId
      ? await this.assets.list(ctx.workspaceId)
      : [];
    const before = rows.find(
      (r) => r.kind === "ad_account" && r.isPrimary,
    )?.externalId;
    const dataset =
      selection.adAccountId && !selection.datasetId
        ? datasetFor(rows, selection.adAccountId)
        : null;
    const wanted: [MetaAssetKind, string | undefined][] = [
      ["ad_account", selection.adAccountId],
      ["page", selection.pageId],
      ["instagram", selection.instagramId],
      ["dataset", selection.datasetId],
    ];
    await this.db.transaction(async (tx) => {
      for (const [kind, externalId] of wanted) {
        if (!externalId) continue;
        const ok = await this.assets.setPrimary(
          ctx.workspaceId,
          kind,
          externalId,
          tx,
        );
        if (!ok) {
          throw new NotFoundError(
            `That ${kind.replace("_", " ")} isn't available in your connected account.`,
          );
        }
      }
      if (dataset?.action === "select")
        await this.assets.setPrimary(
          ctx.workspaceId,
          "dataset",
          dataset.datasetId,
          tx,
        );
      if (dataset?.action === "clear")
        await this.assets.clearPrimary(ctx.workspaceId, "dataset", tx);
    });
    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "meta.assets_selected",
      data: { ...selection },
    });
    this.events.emit(META_EVENTS.ASSETS_SELECTED, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    } satisfies MetaConnectedEvent);
    if (selection.adAccountId && before !== selection.adAccountId)
      await this.events.emitAsync(META_EVENTS.AD_ACCOUNT_SWITCHED, {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
      } satisfies MetaConnectedEvent);
    return this.buildView(ctx.workspaceId);
  }

  async switchAdAccount(
    ctx: TenantContext,
    adAccountId: string,
  ): Promise<AdAccountSwitch> {
    if (!(await this.connections.find(ctx.workspaceId)))
      throw metaNotConnected();
    const rows = await this.assets.list(ctx.workspaceId);
    const target = rows.find(
      (r) => r.kind === "ad_account" && r.externalId === adAccountId,
    );
    if (!target)
      throw new NotFoundError(
        "That ad account isn't available in your connected account.",
      );
    const previous = rows.find((r) => r.kind === "ad_account" && r.isPrimary);
    const plan = datasetFor(rows, adAccountId);
    await this.db.transaction(async (tx) => {
      await this.assets.setPrimary(
        ctx.workspaceId,
        "ad_account",
        adAccountId,
        tx,
      );
      if (plan.action === "select")
        await this.assets.setPrimary(
          ctx.workspaceId,
          "dataset",
          plan.datasetId,
          tx,
        );
      if (plan.action === "clear")
        await this.assets.clearPrimary(ctx.workspaceId, "dataset", tx);
    });
    const changed = previous?.externalId !== adAccountId;
    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "meta.ad_account_switched",
      target: adAccountId,
      data: {
        from: previous?.externalId ?? null,
        to: adAccountId,
        dataset: plan.action,
      },
    });
    if (changed) {
      await this.events.emitAsync(META_EVENTS.AD_ACCOUNT_SWITCHED, {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
      } satisfies MetaConnectedEvent);
      this.events.emit(META_EVENTS.ASSETS_SELECTED, {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
      } satisfies MetaConnectedEvent);
    }
    const connection = await this.buildView(ctx.workspaceId);
    const currency = target.data.currency;
    return {
      adAccount: {
        id: target.externalId,
        name: target.name,
        currency: typeof currency === "string" ? currency : "INR",
      },
      changed,
      dataset:
        plan.action === "keep"
          ? "kept"
          : plan.action === "select"
            ? "switched"
            : "cleared",
      needsReview: plan.action === "clear",
      connection,
    };
  }

  async disconnect(ctx: TenantContext): Promise<void> {
    if (!(await this.connections.find(ctx.workspaceId)))
      throw metaNotConnected();
    await this.db.transaction(async (tx) => {
      await this.assets.deleteAll(ctx.workspaceId, tx);
      await this.connections.delete(ctx.workspaceId, tx);
    });
    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "meta.disconnected",
    });
    this.events.emit(META_EVENTS.DISCONNECTED, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    } satisfies MetaConnectedEvent);
  }

  async setupState(
    workspaceId: string,
  ): Promise<{ connected: boolean; primaryKinds: MetaAssetKind[] }> {
    const connection = await this.connections.find(workspaceId);
    if (!connection || connection.status !== "active") {
      return { connected: false, primaryKinds: [] };
    }
    const rows = await this.assets.list(workspaceId);
    return {
      connected: true,
      primaryKinds: rows.filter((r) => r.isPrimary).map((r) => r.kind),
    };
  }

  async accessToken(workspaceId: string): Promise<string> {
    const connection = await this.connections.find(workspaceId);
    if (!connection || connection.status !== "active") throw metaNotConnected();
    return this.crypto.decrypt(connection.tokenCiphertext);
  }

  async checkHealth(workspaceId: string): Promise<"active" | "invalid"> {
    const connection = await this.connections.find(workspaceId);
    if (!connection) throw metaNotConnected();
    const token = this.crypto.decrypt(connection.tokenCiphertext);
    try {
      await this.graph.identity(token);
      const granted = await this.graph.grantedPermissions(token);
      if (missingPermissions(granted).required.length) {
        await this.connections.markInvalid(workspaceId);
        return "invalid";
      }
      await this.connections.markChecked(workspaceId, granted);
      return "active";
    } catch (err) {
      if (
        err instanceof DomainError &&
        err.code === ErrorCode.META_TOKEN_INVALID
      ) {
        await this.connections.markInvalid(workspaceId);
        await this.audit.record({
          workspaceId,
          actor: "system",
          action: "meta.token_invalid",
        });
        return "invalid";
      }
      throw err;
    }
  }

  async refreshAssets(workspaceId: string): Promise<number> {
    const token = await this.accessToken(workspaceId);
    const discovered = await this.discover(token);
    await this.db.transaction(async (tx) => {
      await this.assets.sync(workspaceId, discovered, tx);
      await this.assets.autoSelectSingles(workspaceId, tx);
    });
    return discovered.length;
  }

  private async discover(token: string): Promise<DiscoveredAsset[]> {
    const [businesses, adAccounts, pages] = await Promise.all([
      this.graph.businesses(token),
      this.graph.adAccounts(token),
      this.graph.pages(token),
    ]);
    const datasets = (
      await Promise.all(
        adAccounts
          .slice(0, MAX_AD_ACCOUNTS_FOR_DATASETS)
          .map((a) => this.graph.datasets(token, a.id)),
      )
    ).flat();
    const datasetAccounts = new Map<string, string[]>();
    for (const d of datasets)
      datasetAccounts.set(d.id, [
        ...new Set([...(datasetAccounts.get(d.id) ?? []), d.adAccountId]),
      ]);
    const uniqueDatasets = [
      ...new Map(datasets.map((d) => [d.id, d])).values(),
    ];

    const knownBusinesses = new Set(businesses.map((b) => b.id));
    for (const account of adAccounts) {
      if (account.businessId && !knownBusinesses.has(account.businessId)) {
        knownBusinesses.add(account.businessId);
        businesses.push({
          id: account.businessId,
          name: account.businessName ?? "Business",
          verificationStatus: null,
        });
      }
    }

    return [
      ...businesses.map((b) =>
        asset("business", b.id, b.name, {
          verificationStatus: b.verificationStatus,
        }),
      ),
      ...adAccounts.map((a) =>
        asset("ad_account", a.id, a.name, {
          accountId: a.accountId,
          currency: a.currency,
          timezone: a.timezone,
          status: a.status,
          amountSpent: a.amountSpent,
          spendCap: a.spendCap,
          businessId: a.businessId,
          businessName: a.businessName,
        }),
      ),
      ...pages.map((p) =>
        asset("page", p.id, p.name, {
          category: p.category,
          pictureUrl: p.pictureUrl,
          instagramId: p.instagram?.id ?? null,
        }),
      ),
      ...pages
        .filter((p) => p.instagram)
        .map((p) =>
          asset("instagram", p.instagram!.id, `@${p.instagram!.username}`, {
            username: p.instagram!.username,
            pictureUrl: p.instagram!.pictureUrl,
            pageId: p.id,
          }),
        ),
      ...uniqueDatasets.map((d) =>
        asset("dataset", d.id, d.name, {
          adAccountId: d.adAccountId,
          adAccountIds: datasetAccounts.get(d.id) ?? [d.adAccountId],
          lastFiredTime: d.lastFiredTime,
          isUnavailable: d.isUnavailable,
        }),
      ),
    ];
  }

  private async buildView(workspaceId: string): Promise<ConnectionView> {
    const connection = await this.connections.find(workspaceId);
    if (!connection) {
      return {
        status: "not_connected",
        method: null,
        systemUser: null,
        tokenLast4: null,
        connectedAt: null,
        checkedAt: null,
        permissions: {
          granted: [],
          missingRequired: PERMISSIONS.filter(
            (p) => p.level === "required",
          ).map((p) => p.name),
          missingRecommended: [],
          missingOptional: [],
        },
        checks: [],
        assets: [],
      };
    }
    const rows = await this.assets.list(workspaceId);
    const missing = missingPermissions(connection.grantedScopes);
    const discovered = rows.map((r) =>
      asset(r.kind, r.externalId, r.name, r.data),
    );
    return {
      status: connection.status,
      method: connection.method,
      systemUser: {
        id: connection.systemUserId,
        name: connection.systemUserName,
      },
      tokenLast4: connection.tokenLast4,
      connectedAt: connection.createdAt.toISOString(),
      checkedAt: connection.checkedAt.toISOString(),
      permissions: {
        granted: connection.grantedScopes,
        missingRequired: missing.required,
        missingRecommended: missing.recommended,
        missingOptional: missing.optional,
      },
      checks: [
        check(
          "token",
          "Token",
          connection.status === "active" ? "passed" : "failed",
          connection.status === "active"
            ? "Token is valid."
            : "Token stopped working. Reconnect with a new token.",
        ),
        permissionCheck(missing),
        ...assetChecks(discovered),
      ],
      assets: rows.map(toAssetView),
    };
  }
}

function check(
  key: string,
  label: string,
  status: ConnectionCheck["status"],
  message: string,
): ConnectionCheck {
  return { key, label, status, message };
}

function asset(
  kind: MetaAssetKind,
  externalId: string,
  name: string,
  data: Record<string, unknown>,
): DiscoveredAsset {
  return { kind, externalId, name, data };
}

function permissionCheck(
  missing: ReturnType<typeof missingPermissions>,
): ConnectionCheck {
  if (missing.required.length) {
    return check(
      "permissions",
      "Permissions",
      "failed",
      `Missing required: ${missing.required.join(", ")}.`,
    );
  }
  if (missing.recommended.length) {
    return check(
      "permissions",
      "Permissions",
      "warning",
      `Some features will stay off until you add: ${missing.recommended.join(", ")}.`,
    );
  }
  return check(
    "permissions",
    "Permissions",
    "passed",
    "All permissions granted.",
  );
}

function assetChecks(discovered: DiscoveredAsset[]): ConnectionCheck[] {
  const count = (kind: MetaAssetKind) =>
    discovered.filter((a) => a.kind === kind).length;
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`;
  const ads = count("ad_account");
  const pages = count("page");
  const ig = count("instagram");
  const datasets = count("dataset");
  return [
    ads
      ? check(
          "ad_accounts",
          "Ad accounts",
          "passed",
          `${plural(ads, "ad account")} found.`,
        )
      : check(
          "ad_accounts",
          "Ad accounts",
          "failed",
          "No ad account is assigned to the system user.",
        ),
    pages
      ? check(
          "pages",
          "Facebook Pages",
          "passed",
          `${plural(pages, "Page")} found.`,
        )
      : check(
          "pages",
          "Facebook Pages",
          "failed",
          "No Facebook Page is assigned to the system user.",
        ),
    ig
      ? check(
          "instagram",
          "Instagram",
          "passed",
          `${plural(ig, "Instagram account")} found.`,
        )
      : check(
          "instagram",
          "Instagram",
          "warning",
          "No Instagram account is linked to your Page yet.",
        ),
    datasets
      ? check(
          "datasets",
          "Datasets (Pixel)",
          "passed",
          `${plural(datasets, "dataset")} found.`,
        )
      : check(
          "datasets",
          "Datasets (Pixel)",
          "warning",
          "No dataset found. You can add one later.",
        ),
  ];
}

function missingSharedAssets(failedKeys: string[]): string {
  const ads = failedKeys.includes("ad_accounts");
  const pages = failedKeys.includes("pages");
  const what =
    ads && pages
      ? "No ad account or Facebook Page was shared"
      : ads
        ? "No ad account was shared"
        : "No Facebook Page was shared";
  return `${what}. Continue with Facebook again and pick at least one ad account and one Page.`;
}

function toAssetView(r: MetaAssetRow): AssetView {
  return {
    id: r.id,
    kind: r.kind,
    externalId: r.externalId,
    name: r.name,
    isPrimary: r.isPrimary,
    details: r.data,
  };
}
