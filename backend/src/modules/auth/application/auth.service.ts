import { Injectable } from "@nestjs/common";

import { IdentityService } from "@modules/iam/application/identity.service";

import { RequestMeta, SignInResult } from "../domain/auth.types";
import { OtpService } from "./otp.service";
import { SessionService } from "./session.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly identity: IdentityService,
    private readonly sessions: SessionService,
  ) {}

  async verifyAndSignIn(
    rawPhone: string,
    code: string,
    meta: RequestMeta,
  ): Promise<SignInResult> {
    const phone = await this.otp.verify(rawPhone, code);
    const identity = await this.identity.signIn(phone);
    const tokens = await this.sessions.start(
      identity.user.id,
      identity.workspace.id,
      meta,
    );
    return { ...identity, tokens };
  }
}
