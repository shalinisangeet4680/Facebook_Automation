import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { metaRejected } from "../domain/meta.errors";
import { MetaLogin } from "../domain/ports/meta-login";

export const MOCK_LOGIN_TOKEN = `EAA${"F".repeat(40)}`;

@Injectable()
export class MockMetaLogin implements MetaLogin {
  constructor(private readonly config: ConfigService<Env, true>) {}

  configured(): boolean {
    return Boolean(
      this.config.get("META_ADS_LOGIN_CONFIG_ID", { infer: true }),
    );
  }

  dialogUrl(redirectUri: string, state: string): string {
    const url = new URL(redirectUri);
    url.searchParams.set("code", "mock");
    url.searchParams.set("state", state);
    return url.toString();
  }

  exchangeCode(code: string): Promise<string> {
    if (!/^mock[a-z]*$/.test(code))
      return Promise.reject(
        metaRejected(
          "Facebook didn't accept this sign-in. Continue with Facebook again.",
        ),
      );
    return Promise.resolve(`${MOCK_LOGIN_TOKEN}${code.slice(4)}`);
  }
}
