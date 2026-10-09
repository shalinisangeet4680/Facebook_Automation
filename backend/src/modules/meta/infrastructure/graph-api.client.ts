import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import {
  metaThrottled,
  metaTokenInvalid,
  metaUnavailable,
} from "../domain/meta.errors";
import {
  GraphAdAccount,
  GraphBusiness,
  GraphDataset,
  GraphIdentity,
  GraphPage,
  MetaGraph,
} from "../domain/ports/meta-graph";

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const THROTTLE_CODES = new Set([4, 17, 32, 613]);
const TRANSIENT_CODES = new Set([1, 2]);
const AUTH_CODES = new Set([102, 190]);

interface GraphError {
  message?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface Paged<T> {
  data?: T[];
  paging?: { next?: string };
}

class GraphRequestError extends Error {
  constructor(
    readonly kind: "auth" | "throttled" | "transient" | "fatal",
    readonly graph: GraphError,
    readonly retryAfterSeconds = 0,
  ) {
    super(graph.message ?? "Graph request failed");
  }
}

@Injectable()
export class GraphApiClient implements MetaGraph {
  private readonly logger = new Logger(GraphApiClient.name);
  private readonly base: string;

  constructor(config: ConfigService<Env, true>) {
    this.base = `https://graph.facebook.com/${config.get("META_GRAPH_VERSION", { infer: true })}`;
  }

  async identity(token: string): Promise<GraphIdentity> {
    const me = await this.get<{ id: string; name: string }>(token, "/me", {
      fields: "id,name",
    });
    return { id: me.id, name: me.name };
  }

  async grantedPermissions(token: string): Promise<string[]> {
    const rows = await this.list<{ permission: string; status: string }>(
      token,
      "/me/permissions",
      {},
    );
    return rows.filter((r) => r.status === "granted").map((r) => r.permission);
  }

  async businesses(token: string): Promise<GraphBusiness[]> {
    const rows = await this.list<{
      id: string;
      name: string;
      verification_status?: string;
    }>(token, "/me/businesses", { fields: "id,name,verification_status" });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      verificationStatus: r.verification_status ?? null,
    }));
  }

  async adAccounts(token: string): Promise<GraphAdAccount[]> {
    const rows = await this.list<{
      id: string;
      account_id: string;
      name: string;
      currency: string;
      timezone_name?: string;
      account_status: number;
      amount_spent?: string;
      spend_cap?: string;
      business?: { id: string; name: string };
    }>(token, "/me/adaccounts", {
      fields:
        "id,account_id,name,currency,timezone_name,account_status,amount_spent,spend_cap,business{id,name}",
    });
    return rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      name: r.name,
      currency: r.currency,
      timezone: r.timezone_name ?? null,
      status: r.account_status,
      amountSpent: r.amount_spent ?? null,
      spendCap: r.spend_cap ?? null,
      businessId: r.business?.id ?? null,
      businessName: r.business?.name ?? null,
    }));
  }

  async pages(token: string): Promise<GraphPage[]> {
    const rows = await this.list<{
      id: string;
      name: string;
      category?: string;
      picture?: { data?: { url?: string } };
      instagram_business_account?: {
        id: string;
        username?: string;
        profile_picture_url?: string;
      };
    }>(token, "/me/accounts", {
      fields:
        "id,name,category,picture{url},instagram_business_account{id,username,profile_picture_url}",
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category ?? null,
      pictureUrl: r.picture?.data?.url ?? null,
      instagram: r.instagram_business_account
        ? {
            id: r.instagram_business_account.id,
            username: r.instagram_business_account.username ?? "",
            pictureUrl:
              r.instagram_business_account.profile_picture_url ?? null,
          }
        : null,
    }));
  }

  async datasets(token: string, adAccountId: string): Promise<GraphDataset[]> {
    const rows = await this.list<{
      id: string;
      name: string;
      last_fired_time?: string;
      is_unavailable?: boolean;
    }>(token, `/${adAccountId}/adspixels`, {
      fields: "id,name,last_fired_time,is_unavailable",
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      adAccountId,
      lastFiredTime: r.last_fired_time ?? null,
      isUnavailable: r.is_unavailable ?? false,
    }));
  }

  protected wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async list<T>(
    token: string,
    path: string,
    params: Record<string, string>,
  ): Promise<T[]> {
    const out: T[] = [];
    let page = await this.get<Paged<T>>(token, path, {
      ...params,
      limit: "100",
    });
    out.push(...(page.data ?? []));
    let guard = 0;
    while (page.paging?.next && guard < 20) {
      page = await this.request<Paged<T>>(token, page.paging.next);
      out.push(...(page.data ?? []));
      guard += 1;
    }
    return out;
  }

  private get<T>(
    token: string,
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return this.request<T>(token, url.toString());
  }

  private async request<T>(token: string, url: string): Promise<T> {
    let lastError: GraphRequestError | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.once<T>(token, url);
      } catch (err) {
        if (!(err instanceof GraphRequestError)) throw err;
        lastError = err;
        if (err.kind === "auth") throw metaTokenInvalid(err.graph.message);
        if (err.kind === "fatal") break;
        if (attempt < MAX_ATTEMPTS) {
          const delay =
            err.kind === "throttled"
              ? Math.min(err.retryAfterSeconds * 1000 || 2000, 8000)
              : 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
          await this.wait(delay);
        }
      }
    }
    if (lastError?.kind === "throttled") {
      throw metaThrottled(lastError.retryAfterSeconds || 60);
    }
    this.logger.warn(
      `Graph request failed: ${lastError?.message ?? "unknown"} (${lastError?.graph.fbtrace_id ?? "-"})`,
    );
    throw metaUnavailable();
  }

  private async once<T>(token: string, url: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new GraphRequestError("transient", {
        message: (err as Error).message,
      });
    }
    this.inspectUsage(res.headers);
    const body = (await res.json().catch(() => ({}))) as {
      error?: GraphError;
    } & T;
    if (res.ok && !body.error) return body;

    const error = body.error ?? { message: `HTTP ${res.status}` };
    const code = error.code ?? 0;
    if (AUTH_CODES.has(code)) throw new GraphRequestError("auth", error);
    if (THROTTLE_CODES.has(code) || (code >= 80000 && code <= 80014)) {
      throw new GraphRequestError(
        "throttled",
        error,
        this.regainSeconds(res.headers),
      );
    }
    if (TRANSIENT_CODES.has(code) || res.status >= 500) {
      throw new GraphRequestError("transient", error);
    }
    throw new GraphRequestError("fatal", error);
  }

  private inspectUsage(headers: Headers): void {
    for (const name of ["x-app-usage", "x-ad-account-usage"]) {
      const raw = headers.get(name);
      if (!raw) continue;
      try {
        const usage = JSON.parse(raw) as Record<string, number>;
        const peak = Math.max(
          ...Object.values(usage).filter((v) => typeof v === "number"),
        );
        if (peak >= 75) this.logger.warn(`${name} at ${peak}%`);
      } catch {
        continue;
      }
    }
  }

  private regainSeconds(headers: Headers): number {
    const raw = headers.get("x-business-use-case-usage");
    if (!raw) return 0;
    try {
      const usage = JSON.parse(raw) as Record<
        string,
        { estimated_time_to_regain_access?: number }[]
      >;
      const minutes = Math.max(
        0,
        ...Object.values(usage)
          .flat()
          .map((u) => u.estimated_time_to_regain_access ?? 0),
      );
      return minutes * 60;
    } catch {
      return 0;
    }
  }
}
