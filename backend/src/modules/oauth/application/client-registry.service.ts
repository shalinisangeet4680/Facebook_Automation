import { Injectable, Logger } from "@nestjs/common";

import { CryptoService } from "@shared/security/crypto.service";

import { oauthError } from "../domain/oauth.errors";
import {
  OAUTH_POLICY,
  TOKEN_AUTH_METHODS,
  TokenAuthMethod,
} from "../domain/oauth.policy";
import { isRegistrableRedirect } from "../domain/redirect-uri";
import { CimdFetcher } from "../infrastructure/cimd.fetcher";
import { OAuthClientRepository } from "../infrastructure/oauth-client.repository";
import { OAuthClientRow } from "../infrastructure/oauth.tables";

export interface RegistrationResponse {
  client_id: string;
  client_id_issued_at: number;
  client_secret?: string;
  client_secret_expires_at?: number;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: TokenAuthMethod;
}

export interface ClientCredentials {
  clientId?: string;
  clientSecret?: string;
  authorization?: string;
}

const str = (v: unknown, max = 500): string | null =>
  typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;

const httpsUrl = (v: unknown): string | null => {
  const value = str(v, 2000);
  if (!value) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};

export function isCimdClientId(clientId: string): boolean {
  try {
    const url = new URL(clientId);
    return url.protocol === "https:" && url.pathname.length > 1;
  } catch {
    return false;
  }
}

@Injectable()
export class ClientRegistryService {
  private readonly logger = new Logger(ClientRegistryService.name);

  constructor(
    private readonly clients: OAuthClientRepository,
    private readonly cimd: CimdFetcher,
    private readonly crypto: CryptoService,
  ) {}

  async register(body: Record<string, unknown>): Promise<RegistrationResponse> {
    const redirectUris = this.redirectUris(
      body.redirect_uris,
      "invalid_redirect_uri",
    );
    const method = (body.token_endpoint_auth_method ??
      "client_secret_basic") as string;
    if (!TOKEN_AUTH_METHODS.includes(method as TokenAuthMethod)) {
      throw oauthError(
        "invalid_client_metadata",
        `token_endpoint_auth_method must be one of ${TOKEN_AUTH_METHODS.join(", ")}.`,
      );
    }
    const grantTypes = Array.isArray(body.grant_types)
      ? (body.grant_types as unknown[])
      : ["authorization_code", "refresh_token"];
    if (!grantTypes.includes("authorization_code")) {
      throw oauthError(
        "invalid_client_metadata",
        "grant_types must include authorization_code.",
      );
    }
    const responseTypes = Array.isArray(body.response_types)
      ? (body.response_types as unknown[])
      : ["code"];
    if (responseTypes.some((t) => t !== "code")) {
      throw oauthError(
        "invalid_client_metadata",
        "Only the code response type is supported.",
      );
    }

    const clientId = `mcp_${this.crypto.randomToken(16)}`;
    const secret = method === "none" ? null : this.crypto.randomToken(32);
    const name = str(body.client_name, 100) ?? "MCP client";
    const row = await this.clients.insert({
      clientId,
      kind: "dcr",
      name,
      redirectUris,
      authMethod: method,
      secretHash: secret ? this.crypto.hash(secret) : null,
      clientUri: httpsUrl(body.client_uri),
      logoUri: httpsUrl(body.logo_uri),
    });
    return {
      client_id: row.clientId,
      client_id_issued_at: Math.floor(row.createdAt.getTime() / 1000),
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      client_name: row.name,
      redirect_uris: row.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: method as TokenAuthMethod,
    };
  }

  async resolve(clientId: string): Promise<OAuthClientRow | null> {
    const existing = await this.clients.findByClientId(clientId);
    if (!isCimdClientId(clientId)) return existing;
    const fresh =
      existing?.fetchedAt &&
      Date.now() - existing.fetchedAt.getTime() <
        OAUTH_POLICY.cimdCacheSeconds * 1000;
    if (fresh) return existing;
    try {
      return await this.loadMetadataDocument(clientId);
    } catch (err) {
      this.logger.warn(
        `Client metadata for ${clientId} rejected: ${(err as Error).message}`,
      );
      return existing;
    }
  }

  authenticate(client: OAuthClientRow, credentials: ClientCredentials): void {
    let id = credentials.clientId;
    let secret = credentials.clientSecret;
    const header = credentials.authorization;
    if (header?.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const index = decoded.indexOf(":");
      if (index > 0) {
        id = decodeURIComponent(decoded.slice(0, index));
        secret = decodeURIComponent(decoded.slice(index + 1));
      }
    }
    if (id !== client.clientId) {
      throw oauthError("invalid_client", "Client authentication failed.", 401);
    }
    if (client.authMethod === "none") return;
    if (
      !secret ||
      !client.secretHash ||
      !this.crypto.safeEqual(this.crypto.hash(secret), client.secretHash)
    ) {
      throw oauthError("invalid_client", "Client authentication failed.", 401);
    }
  }

  private async loadMetadataDocument(url: string): Promise<OAuthClientRow> {
    const doc = (await this.cimd.fetch(url)) as Record<string, unknown> | null;
    if (!doc || typeof doc !== "object") throw new Error("Not a JSON object");
    if (doc.client_id !== url)
      throw new Error("client_id does not match the document URL");
    const method = (doc.token_endpoint_auth_method ?? "none") as string;
    if (method !== "none") throw new Error(`Unsupported auth method ${method}`);
    const redirectUris = this.redirectUris(
      doc.redirect_uris,
      "invalid_client_metadata",
    );
    return this.clients.upsert({
      clientId: url,
      kind: "cimd",
      name: str(doc.client_name, 100) ?? new URL(url).hostname,
      redirectUris,
      authMethod: "none",
      secretHash: null,
      clientUri: httpsUrl(doc.client_uri),
      logoUri: httpsUrl(doc.logo_uri),
      fetchedAt: new Date(),
    });
  }

  private redirectUris(
    value: unknown,
    code: "invalid_redirect_uri" | "invalid_client_metadata",
  ): string[] {
    if (
      !Array.isArray(value) ||
      !value.length ||
      value.length > OAUTH_POLICY.maxRedirectUris ||
      !value.every(
        (v) =>
          typeof v === "string" && v.length <= 2000 && isRegistrableRedirect(v),
      )
    ) {
      throw oauthError(
        code,
        "redirect_uris must list 1 to 10 https or loopback http URLs.",
      );
    }
    return [...new Set(value as string[])];
  }
}
