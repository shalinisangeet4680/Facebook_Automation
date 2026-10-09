import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";

import { Env } from "@shared/config/env.validation";

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService<Env, true>) {
    this.key = Buffer.from(
      config.get("TOKEN_ENCRYPTION_KEY", { infer: true }),
      "base64",
    );
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return [
      "v1",
      iv.toString("base64"),
      cipher.getAuthTag().toString("base64"),
      data.toString("base64"),
    ].join(".");
  }

  decrypt(payload: string): string {
    const [version, iv, tag, data] = payload.split(".");
    if (version !== "v1" || !iv || !tag || !data) {
      throw new Error("Unsupported ciphertext");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }

  hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString("base64url");
  }

  safeEqual(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  }
}
