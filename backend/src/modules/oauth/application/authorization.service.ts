import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { AuditService } from "@modules/audit/application/audit.service";
import { IdentityService } from "@modules/iam/application/identity.service";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import { REDIS } from "@shared/cache/redis";
import { AppConfig, appUrl, mcpResourceUrl } from "@shared/config/app-config";
import { CodedError } from "@shared/errors/domain-error";
import { ErrorCode } from "@shared/errors/error-codes";
import { CryptoService } from "@shared/security/crypto.service";
import { TenantContext } from "@shared/tenant/tenant-context";

import {
  AuthorizationContext,
  AuthorizationParams,
  StoredCode,
} from "../domain/oauth.types";
import { OAUTH_POLICY, SCOPES } from "../domain/oauth.policy";
import { isValidChallenge } from "../domain/pkce";
import { matchesRedirect } from "../domain/redirect-uri";
import {
  grantableScopes,
  parseScopes,
  unsupportedScopes,
} from "../domain/scopes";
import { OAuthGrantRepository } from "../infrastructure/oauth-grant.repository";
import { OAuthClientRow } from "../infrastructure/oauth.tables";
import { ClientRegistryService } from "./client-registry.service";

export const CODE_KEY = (hash: string) => `oauth:code:${hash}`;

const invalid = (message: string) =>
  new CodedError(ErrorCode.OAUTH_REQUEST_INVALID, 400, message);

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly registry: ClientRegistryService,
    private readonly grants: OAuthGrantRepository,
    private readonly identity: IdentityService,
    private readonly meta: MetaConnectionService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  async context(
    ctx: TenantContext,
    params: AuthorizationParams,
  ): Promise<AuthorizationContext> {
    const { client, scopes } = await this.validate(params);
    const [me, assets] = await Promise.all([
      this.identity.me(ctx),
      this.meta.listAssets(ctx.workspaceId),
    ]);
    const adAccount = assets.data.find(
      (a) => a.kind === "ad_account" && a.isPrimary,
    );
    return {
      client: {
        name: client.name,
        kind: client.kind,
        clientUri: client.clientUri,
        logoUri: client.logoUri,
      },
      redirectHost: new URL(params.redirect_uri).host,
      workspace: { id: me.workspace.id, name: me.workspace.name },
      adAccount: adAccount
        ? { id: adAccount.externalId, name: adAccount.name }
        : null,
      writeRequested: scopes.includes(SCOPES.WRITE),
    };
  }

  async decide(
    ctx: TenantContext,
    params: AuthorizationParams,
    decision: { approve: boolean; allowWrite: boolean },
  ): Promise<{ redirectTo: string }> {
    const { client, scopes } = await this.validate(params);
    if (!decision.approve) {
      return {
        redirectTo: this.redirect(params, {
          error: "access_denied",
          error_description: "The user declined the request.",
        }),
      };
    }

    const granted = grantableScopes(scopes, decision.allowWrite);
    const grant = await this.grants.database.transaction(async (tx) => {
      const existing = await this.grants.findActive(
        ctx.userId,
        ctx.workspaceId,
        client.id,
        tx,
      );
      if (!existing) {
        return this.grants.insert(
          {
            userId: ctx.userId,
            workspaceId: ctx.workspaceId,
            clientId: client.id,
            scopes: granted,
          },
          tx,
        );
      }
      await this.grants.setScopes(existing.id, granted, tx);
      return { ...existing, scopes: granted };
    });

    const code = this.crypto.randomToken(32);
    const stored: StoredCode = {
      grantId: grant.id,
      clientId: client.clientId,
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      redirectUri: params.redirect_uri,
      codeChallenge: params.code_challenge,
      scopes: granted,
    };
    await this.redis.set(
      CODE_KEY(this.crypto.hash(code)),
      JSON.stringify(stored),
      "EX",
      OAUTH_POLICY.codeTtlSeconds,
    );
    await this.audit.record({
      workspaceId: ctx.workspaceId,
      actor: "user",
      actorId: ctx.userId,
      action: "oauth.app_connected",
      target: grant.id,
      data: { client: client.name, scopes: granted },
    });
    return { redirectTo: this.redirect(params, { code }) };
  }

  private async validate(
    params: AuthorizationParams,
  ): Promise<{ client: OAuthClientRow; scopes: string[] }> {
    const client = await this.registry.resolve(params.client_id);
    if (!client) {
      throw invalid(
        "This app isn't registered with us. Start the connection again from your AI app.",
      );
    }
    if (!matchesRedirect(client.redirectUris, params.redirect_uri)) {
      throw invalid(
        "This app asked to return to an address it didn't register.",
      );
    }
    if (params.response_type !== "code") {
      throw this.redirectable(
        params,
        "unsupported_response_type",
        "Only response_type=code is supported.",
      );
    }
    if (
      params.code_challenge_method !== "S256" ||
      !isValidChallenge(params.code_challenge)
    ) {
      throw this.redirectable(
        params,
        "invalid_request",
        "PKCE with S256 is required.",
      );
    }
    if (
      params.resource &&
      params.resource.replace(/\/+$/, "") !== mcpResourceUrl(this.config)
    ) {
      throw this.redirectable(params, "invalid_target", "Unknown resource.");
    }
    const scopes = parseScopes(params.scope);
    const unknown = unsupportedScopes(scopes);
    if (unknown.length) {
      throw this.redirectable(
        params,
        "invalid_scope",
        `Unsupported scope: ${unknown.join(" ")}`,
      );
    }
    return { client, scopes };
  }

  private redirectable(
    params: AuthorizationParams,
    error: string,
    description: string,
  ): CodedError {
    return new CodedError(ErrorCode.OAUTH_REQUEST_INVALID, 400, description, {
      redirectTo: this.redirect(params, {
        error,
        error_description: description,
      }),
    });
  }

  private redirect(
    params: AuthorizationParams,
    values: Record<string, string>,
  ): string {
    const url = new URL(params.redirect_uri);
    for (const [k, v] of Object.entries(values)) url.searchParams.set(k, v);
    if (params.state) url.searchParams.set("state", params.state);
    url.searchParams.set("iss", appUrl(this.config));
    return url.toString();
  }
}
