import { REPLY_LIMITS } from "@modules/engine/domain/engine.types";

export const REPLY_MAX = REPLY_LIMITS.google_play.max;

export const SYNC_ERROR_KINDS = [
  "no_permission",
  "api_disabled",
  "disconnected",
  "quota",
  "error",
] as const;
export type PlayErrorKindView = (typeof SYNC_ERROR_KINDS)[number];
