export const PLATFORMS = ["facebook", "instagram"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CAPTION_LIMITS = { facebook: 5000, instagram: 2200 } as const;
export const MAX_HASHTAGS = 30;
export const MIN_SCHEDULE_MS = 2 * 60_000;
export const MAX_SCHEDULE_MS = 60 * 86_400_000;

export function captionProblem(
  platform: Platform,
  caption: string | null | undefined,
): string | null {
  const text = caption?.trim() ?? "";
  if (!text)
    return `Write a ${platform === "facebook" ? "Facebook" : "Instagram"} caption.`;
  if (text.length > CAPTION_LIMITS[platform]) {
    return `The ${platform === "facebook" ? "Facebook" : "Instagram"} caption is longer than ${CAPTION_LIMITS[platform]} characters.`;
  }
  if (
    platform === "instagram" &&
    (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > MAX_HASHTAGS
  ) {
    return `Instagram allows at most ${MAX_HASHTAGS} hashtags.`;
  }
  return null;
}

export function scheduleProblem(
  scheduledAt: Date | null,
  now = Date.now(),
): string | null {
  if (!scheduledAt) return null;
  const delta = scheduledAt.getTime() - now;
  if (Number.isNaN(delta)) return "Choose a valid date and time.";
  if (delta < MIN_SCHEDULE_MS)
    return "Schedule at least 2 minutes ahead, or post now.";
  if (delta > MAX_SCHEDULE_MS) return "Schedule within the next 60 days.";
  return null;
}
