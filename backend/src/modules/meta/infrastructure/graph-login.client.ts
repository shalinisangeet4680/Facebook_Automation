import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { metaRejected, metaUnavailable } from "../domain/meta.errors";
import { loginDialogUrl } from "../domain/meta-login";
import { MetaLogin } from "../domain/ports/meta-login";

const TIMEOUT_MS = 15_000;

@Injectable()
export class GraphLoginClient implements MetaLogin {
  private readonly logger = new Logger(GraphLoginClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get settings() {
    return {
      version: this.config.get("META_GRAPH_VERSION", { infer: true }),
      appId: this.config.get("META_APP_ID", { infer: true }) ?? "",
      appSecret: this.config.get("META_APP_SECRET", { infer: true }) ?? "",
      configId:
        this.config.get("META_ADS_LOGIN_CONFIG_ID", { infer: true }) ?? "",
    };
  }

  configured(): boolean {
    const { appId, appSecret, configId } = this.settings;
    return Boolean(appId && appSecret && configId);
  }

  dialogUrl(redirectUri: string, state: string): string {
    const { version, appId, configId } = this.settings;
    return loginDialogUrl({ version, appId, configId, redirectUri, state });
  }

  async exchangeCode(code: string, redirectUri: string): Promise<string> {
    const { version, appId, appSecret } = this.settings;
    const url = new URL(
      `https://graph.facebook.com/${version}/oauth/access_token`,
    );
    url.search = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    }).toString();
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      this.logger.warn(
        `Facebook code exchange failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw metaUnavailable();
    }
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      error?: { message?: string };
    };
    if (!res.ok || body.error || !body.access_token) {
      this.logger.warn(
        `Facebook code exchange rejected (${res.status}): ${body.error?.message ?? "no token"}`,
      );
      throw metaRejected(
        "Facebook didn't accept this sign-in. Continue with Facebook again.",
      );
    }
    return body.access_token;
  }
}
