import { ConfigService } from "@nestjs/config";

import { Env } from "./env.validation";

export type AppConfig = ConfigService<Env, true>;

export function isProduction(config: AppConfig): boolean {
  return config.get("NODE_ENV", { infer: true }) === "production";
}

export function webOrigins(config: AppConfig): string[] {
  return config.get("WEB_ORIGINS", { infer: true });
}

export function otpTestNumbers(config: AppConfig): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of config.get("OTP_TEST_NUMBERS", { infer: true }).split(",")) {
    const [phone, code] = pair.split(":").map((s) => s.trim());
    if (phone && code) map.set(phone.replace(/\D/g, "").slice(-10), code);
  }
  return map;
}
