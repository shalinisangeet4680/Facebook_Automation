import { Inject, Injectable } from "@nestjs/common";
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
import { MetaAssetKind, MetaAssetRow } from "../infrastructure/meta.tables";

const TOKEN_PATTERN = /^EAA[A-Za-z0-9]{30,}$/;
const MAX_AD_ACCOUNTS_FOR_DATASETS = 10;

export interface AssetSelection {
  adAccountId?: string;
  pageId?: string;
  instagramId?: string;
  datasetId?: string;
}

@Injectable()
export class MetaConnectionService {
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

  async connect(ctx: TenantContext, rawToken: string): Promise<ConnectionView> {
    const token = rawToken.trim();
    if (!TOKEN_PATTERN.test(token)) {
      throw new ValidationError(
        "That doesn't look like a Meta access token. It should start with EAA.",
      );
    }

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
      throw new CodedError(
        ErrorCode.META_PERMISSIONS_MISSING,
        422,
        `The token is missing required permissions: ${missing.required.join(", ")}. Generate a new token with every required permission ticked.`,
        { checks: baseChecks, missing },
      );
    }

    const discovered = await this.discover(token);
    const checks = [...baseChecks, ...assetChecks(discovered)];
    if (checks.some((c) => c.status === "failed")) {
      throw new CodedError(
        ErrorCode.META_ASSETS_MISSING,
        422,
        "Some required assets aren't assigned to the system user yet. Assign them in Business settings and try again.",
        { checks, missing },
      );
    }

    await this.db.transaction(async (tx) => {
      await this.connections.upsert(
        {
          workspaceId: ctx.workspaceId,
          tokenCiphertext: this.crypto.encrypt(token),
          tokenLast4: token.slice(-4),
          systemUserId: identity.id,
          systemUserName: identity.name,
          grantedScopes: granted,
        },
        tx,
      );
      await this.assets.sync(ctx.workspaceId, discovered, tx);
      await this.assets.autoSelectSingles(ctx.workspaceId, tx);
    });

    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "meta.connected",
      target: identity.id,
      data: { systemUser: identity.name, assets: discovered.length },
    });
    this.events.emit(META_EVENTS.CONNECTED, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    } satisfies MetaConnectedEvent);

    return { ...(await this.view(ctx.workspaceId)), checks };
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
    return this.buildView(ctx.workspaceId);
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
