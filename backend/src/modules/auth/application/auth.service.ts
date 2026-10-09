import { Injectable } from "@nestjs/common";

import { AuditService } from "@modules/audit/application/audit.service";
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
    private readonly audit: AuditService,
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
    await this.audit.record({
      workspaceId: identity.workspace.id,
      actor: "user",
      actorId: identity.user.id,
      action: identity.isNewUser ? "auth.signed_up" : "auth.signed_in",
      data: { ip: meta.ip, userAgent: meta.userAgent },
    });
    return { ...identity, tokens };
  }
}
