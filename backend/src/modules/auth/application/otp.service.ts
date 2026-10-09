import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomInt } from "crypto";

import { otpTestNumbers } from "@shared/config/app-config";
import { Env } from "@shared/config/env.validation";
import { CryptoService } from "@shared/security/crypto.service";

import {
  otpExpired,
  otpInvalid,
  otpTooSoon,
  phoneNotAllowed,
} from "../domain/auth.errors";
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_WINDOW,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
  OTP_WINDOW_SECONDS,
} from "../domain/auth.policy";
import { OtpRequested, RequestMeta } from "../domain/auth.types";
import {
  displayPhone,
  localDigits,
  normalizeIndianPhone,
} from "../domain/phone";
import { OTP_SENDER, OtpSender } from "../domain/ports/otp-sender";
import { OtpChallengeRepository } from "../infrastructure/otp-challenge.repository";

@Injectable()
export class OtpService {
  private readonly testNumbers: Map<string, string>;

  constructor(
    config: ConfigService<Env, true>,
    private readonly challenges: OtpChallengeRepository,
    private readonly crypto: CryptoService,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
  ) {
    this.testNumbers = otpTestNumbers(config);
  }

  async request(rawPhone: string, meta: RequestMeta): Promise<OtpRequested> {
    const phone = normalizeIndianPhone(rawPhone);
    const fixedCode = this.testNumbers.get(localDigits(phone));
    if (!fixedCode) throw phoneNotAllowed();

    const now = Date.now();
    const last = await this.challenges.latest(phone);
    if (last) {
      const elapsed = Math.floor((now - last.createdAt.getTime()) / 1000);
      if (elapsed < OTP_RESEND_SECONDS) {
        throw otpTooSoon(OTP_RESEND_SECONDS - elapsed);
      }
    }
    const recent = await this.challenges.countSince(
      phone,
      new Date(now - OTP_WINDOW_SECONDS * 1000),
    );
    if (recent >= OTP_MAX_PER_WINDOW) throw otpTooSoon(OTP_WINDOW_SECONDS);

    const code = fixedCode ?? this.randomCode();
    await this.challenges.create({
      phone,
      codeHash: this.hashCode(phone, code),
      expiresAt: new Date(now + OTP_TTL_SECONDS * 1000),
      ip: meta.ip,
    });
    await this.sender.send(phone, code);
    return {
      phone: displayPhone(phone),
      expiresInSeconds: OTP_TTL_SECONDS,
      resendInSeconds: OTP_RESEND_SECONDS,
    };
  }

  async verify(rawPhone: string, code: string): Promise<string> {
    const phone = normalizeIndianPhone(rawPhone);
    const challenge = await this.challenges.latestOpen(phone);
    if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
      throw otpExpired();
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) throw otpInvalid(0);

    const attempts = await this.challenges.incrementAttempts(challenge.id);
    if (
      !this.crypto.safeEqual(this.hashCode(phone, code), challenge.codeHash)
    ) {
      throw otpInvalid(Math.max(0, OTP_MAX_ATTEMPTS - attempts));
    }
    if (!(await this.challenges.consume(challenge.id))) throw otpExpired();
    return phone;
  }

  private hashCode(phone: string, code: string): string {
    return this.crypto.hash(`otp:${phone}:${code}`);
  }

  private randomCode(): string {
    return randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, "0");
  }
}
