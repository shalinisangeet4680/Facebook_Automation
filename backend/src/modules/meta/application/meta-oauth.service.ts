import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { OnboardingService } from "@modules/onboarding/application/onboarding.service";
import { AppConfig, allowedOrigin, appUrl } from "@shared/config/app-config";
import { DomainError, ValidationError } from "@shared/errors/domain-error";
import { CryptoService } from "@shared/security/crypto.service";

import { loginErrorMessage, safeNext } from "../domain/meta-login";
import { META_LOGIN, MetaLogin } from "../domain/ports/meta-login";
import { MetaActor, MetaConnectionService } from "./meta-connection.service";

const STATE_TTL_MS = 10 * 60_000;
const SETUP_FLOW = "/setup/start";
const CONNECT_PAGE = "/setup/connect-meta";

export interface MetaOAuthState {
  n: string;
  w: string;
  u: string;
  o: string;
  x: string;
  e: number;
}

export interface MetaOAuthCallback {
  code?: string;
  state?: string;
  error?: string;
  error_reason?: string;
}

@Injectable()
export class MetaOAuthService {
  private readonly logger = new Logger(MetaOAuthService.name);

  constructor(
    @Inject(META_LOGIN) private readonly login: MetaLogin,
    private readonly connections: MetaConnectionService,
    private readonly onboarding: OnboardingService,
    private readonly crypto: CryptoService,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  redirectUri(origin = appUrl(this.config)) {
    return `${origin}/api/v1/meta/oauth/callback`;
  }

  status() {
    return {
      facebookLogin: this.login.configured(),
      redirectUri: this.redirectUri(),
    };
  }

  async start(actor: MetaActor, input: { next?: string; origin?: string }) {
    if (!this.login.configured())
      throw new ValidationError(
        "Facebook sign-in isn't set up on this server yet. Connect with a system user token instead.",
      );
    const origin = allowedOrigin(this.config, input.origin);
    const nonce = this.crypto.randomToken(16);
    const state: MetaOAuthState = {
      n: nonce,
      w: actor.workspaceId,
      u: actor.userId,
      o: origin,
      x: safeNext(input.next) ?? (await this.defaultNext(actor.workspaceId)),
      e: Date.now() + STATE_TTL_MS,
    };
    const encoded = Buffer.from(
      this.crypto.encrypt(JSON.stringify(state)),
    ).toString("base64url");
    return {
      url: this.login.dialogUrl(this.redirectUri(origin), encoded),
      nonce,
      ttlSeconds: STATE_TTL_MS / 1000,
    };
  }

  async callback(
    query: MetaOAuthCallback,
    cookieNonce: string | undefined,
  ): Promise<string> {
    const state = this.readState(query.state);
    const origin = allowedOrigin(this.config, state?.o);
    const back = (params: Record<string, string>) => {
      const url = new URL(safeNext(state?.x) ?? CONNECT_PAGE, origin);
      for (const [key, value] of Object.entries(params))
        url.searchParams.set(key, value);
      return url.toString();
    };
    if (query.error) return back({ error: loginErrorMessage(query) });
    if (
      !state ||
      !query.code ||
      state.e < Date.now() ||
      !cookieNonce ||
      !this.crypto.safeEqual(cookieNonce, state.n)
    )
      return back({
        error: "This sign-in link expired. Start again from TreeVook.",
      });
    try {
      const token = await this.login.exchangeCode(
        query.code,
        this.redirectUri(origin),
      );
      await this.connections.connectWith(
        { workspaceId: state.w, userId: state.u },
        token,
        "facebook_login",
      );
      return back({ connected: "facebook" });
    } catch (err) {
      if (!(err instanceof DomainError))
        this.logger.error(
          "Facebook sign-in for Ads failed",
          err instanceof Error ? err.stack : String(err),
        );
      return back({
        error:
          err instanceof DomainError
            ? err.message
            : "Facebook sign-in didn't finish. Try again.",
      });
    }
  }

  private readState(raw?: string): MetaOAuthState | null {
    if (!raw) return null;
    try {
      return JSON.parse(
        this.crypto.decrypt(Buffer.from(raw, "base64url").toString()),
      ) as MetaOAuthState;
    } catch {
      return null;
    }
  }

  private async defaultNext(workspaceId: string): Promise<string> {
    try {
      const view = await this.onboarding.view(workspaceId);
      return view.isComplete ? CONNECT_PAGE : SETUP_FLOW;
    } catch {
      return CONNECT_PAGE;
    }
  }
}
