import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { REDIS } from "@shared/cache/redis";
import { AppConfig, mcpResourceUrl } from "@shared/config/app-config";
import { CryptoService } from "@shared/security/crypto.service";
import { TokenService } from "@shared/security/token.service";

import { oauthError } from "../domain/oauth.errors";
import { OAUTH_POLICY } from "../domain/oauth.policy";
import { StoredCode, TokenResponse } from "../domain/oauth.types";
import { verifyPkce } from "../domain/pkce";
import { OAuthGrantRepository } from "../infrastructure/oauth-grant.repository";
import { OAuthClientRow, OAuthGrantRow } from "../infrastructure/oauth.tables";
import { CODE_KEY } from "./authorization.service";
import { ClientRegistryService } from "./client-registry.service";

type Form = Record<string, unknown>;

const field = (form: Form, name: string): string | undefined => {
  const value = form[name];
  return typeof value === "string" && value ? value : undefined;
};

const JWT_BEARER = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

function assertionIssuer(form: Form): string | null {
  const assertion = field(form, "client_assertion");
  if (field(form, "client_assertion_type") !== JWT_BEARER || !assertion)
    return null;
  try {
    const payload = JSON.parse(
      Buffer.from(assertion.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { iss?: unknown; sub?: unknown };
    return typeof payload.iss === "string" && payload.iss === payload.sub
      ? payload.iss
      : null;
  } catch {
    return null;
  }
}

@Injectable()
export class TokenEndpointService {
  constructor(
    private readonly registry: ClientRegistryService,
    private readonly grants: OAuthGrantRepository,
    private readonly tokens: TokenService,
    private readonly crypto: CryptoService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  async exchange(form: Form, authorization?: string): Promise<TokenResponse> {
    const grantType = field(form, "grant_type");
    if (grantType === "authorization_code")
      return this.fromCode(form, authorization);
    if (grantType === "refresh_token")
      return this.fromRefresh(form, authorization);
    throw oauthError(
      "unsupported_grant_type",
      "Use authorization_code or refresh_token.",
    );
  }

  async revoke(form: Form, authorization?: string): Promise<void> {
    const token = field(form, "token");
    if (!token) throw oauthError("invalid_request", "token is required.");
    const client = await this.client(form, authorization);
    const refresh = await this.grants.findRefresh(this.crypto.hash(token));
    let grantId = refresh?.grantId;
    if (!grantId) {
      try {
        grantId = this.tokens.verifyMcp(
          token,
          mcpResourceUrl(this.config),
        ).grantId;
      } catch {
        return;
      }
    }
    const grant = await this.grants.findById(grantId);
    if (grant && grant.clientId === client.id)
      await this.grants.revoke(grant.id);
  }

  private async fromCode(
    form: Form,
    authorization?: string,
  ): Promise<TokenResponse> {
    const code = field(form, "code");
    const verifier = field(form, "code_verifier");
    const redirectUri = field(form, "redirect_uri");
    if (!code || !verifier) {
      throw oauthError(
        "invalid_request",
        "code and code_verifier are required.",
      );
    }
    const client = await this.client(form, authorization);
    const raw = await this.redis.getdel(CODE_KEY(this.crypto.hash(code)));
    if (!raw)
      throw oauthError(
        "invalid_grant",
        "The authorization code is invalid or expired.",
      );
    const stored = JSON.parse(raw) as StoredCode;
    if (stored.clientId !== client.clientId) {
      throw oauthError(
        "invalid_grant",
        "The code was issued to another client.",
      );
    }
    if (redirectUri !== stored.redirectUri) {
      throw oauthError(
        "invalid_grant",
        "redirect_uri does not match the authorization request.",
      );
    }
    if (!verifyPkce(verifier, stored.codeChallenge)) {
      throw oauthError("invalid_grant", "PKCE verification failed.");
    }
    const grant = await this.activeGrant(stored.grantId, client);
    return this.issue(grant, client);
  }

  private async fromRefresh(
    form: Form,
    authorization?: string,
  ): Promise<TokenResponse> {
    const token = field(form, "refresh_token");
    if (!token)
      throw oauthError("invalid_request", "refresh_token is required.");
    const client = await this.client(form, authorization);
    const row = await this.grants.findRefresh(this.crypto.hash(token));
    const expired = oauthError(
      "invalid_grant",
      "The refresh token is invalid or expired.",
    );
    if (!row || row.revokedAt || row.expiresAt < new Date()) throw expired;
    if (row.replacedAt) {
      const age = Date.now() - row.replacedAt.getTime();
      if (age > OAUTH_POLICY.refreshReuseGraceSeconds * 1000) {
        await this.grants.revoke(row.grantId);
      }
      throw expired;
    }
    const grant = await this.activeGrant(row.grantId, client);
    const claimed = await this.grants.markRefreshReplaced(row.id);
    if (!claimed) throw expired;
    return this.issue(grant, client);
  }

  private async client(
    form: Form,
    authorization?: string,
  ): Promise<OAuthClientRow> {
    let clientId = field(form, "client_id");
    if (!clientId && authorization?.startsWith("Basic ")) {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString(
        "utf8",
      );
      clientId = decodeURIComponent(decoded.split(":")[0] ?? "");
    }
    const fromAssertion = !clientId ? assertionIssuer(form) : null;
    clientId ??= fromAssertion ?? undefined;
    if (!clientId)
      throw oauthError("invalid_client", "client_id is required.", 401);
    const client = await this.registry.resolve(clientId);
    if (!client) throw oauthError("invalid_client", "Unknown client.", 401);
    if (fromAssertion && client.authMethod !== "none")
      throw oauthError("invalid_client", "Client authentication failed.", 401);
    this.registry.authenticate(client, {
      clientId: field(form, "client_id") ?? clientId,
      clientSecret: field(form, "client_secret"),
      authorization,
    });
    return client;
  }

  private async activeGrant(
    grantId: string,
    client: OAuthClientRow,
  ): Promise<OAuthGrantRow> {
    const grant = await this.grants.findById(grantId);
    if (!grant || grant.revokedAt || grant.clientId !== client.id) {
      throw oauthError(
        "invalid_grant",
        "This connection was removed. Connect again.",
      );
    }
    return grant;
  }

  private async issue(
    grant: OAuthGrantRow,
    client: OAuthClientRow,
  ): Promise<TokenResponse> {
    const refresh = this.crypto.randomToken(32);
    await this.grants.insertRefresh({
      grantId: grant.id,
      tokenHash: this.crypto.hash(refresh),
      expiresAt: new Date(
        Date.now() + OAUTH_POLICY.refreshTokenTtlDays * 86_400_000,
      ),
    });
    const access = this.tokens.signMcp({
      userId: grant.userId,
      workspaceId: grant.workspaceId,
      grantId: grant.id,
      clientId: client.clientId,
      scopes: grant.scopes,
      audience: mcpResourceUrl(this.config),
      ttlSeconds: OAUTH_POLICY.accessTokenTtlSeconds,
    });
    return {
      access_token: access,
      token_type: "Bearer",
      expires_in: OAUTH_POLICY.accessTokenTtlSeconds,
      refresh_token: refresh,
      scope: grant.scopes.join(" "),
    };
  }
}
