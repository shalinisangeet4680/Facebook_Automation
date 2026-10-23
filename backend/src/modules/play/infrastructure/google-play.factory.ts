import { ConfigService } from "@nestjs/config";

import { Env } from "@shared/config/env.validation";

import { ServiceAccountKey } from "../domain/ports/play-api";
import { parseServiceAccount } from "../domain/service-account";
import { GooglePlayClient } from "./google-play.client";

export function platformKey(
  config: ConfigService<Env, true>,
): ServiceAccountKey | null {
  const raw = config.get("PLAY_PLATFORM_SA_KEY", { infer: true });
  if (!raw) return null;
  const json = raw.startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  const key = parseServiceAccount(json);
  if (typeof key === "string")
    throw new Error(`PLAY_PLATFORM_SA_KEY is invalid: ${key}`);
  const projectId = config.get("PLAY_GCP_PROJECT_ID", { infer: true });
  return projectId ? { ...key, projectId } : key;
}

export const googlePlayClient = (config: ConfigService<Env, true>) =>
  new GooglePlayClient(fetch, platformKey(config));
