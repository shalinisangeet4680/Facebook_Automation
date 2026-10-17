export const QUEUES = {
  META_SYNC: "meta-sync",
  AUTOPILOT: "autopilot",
  AI: "ai",
  MEDIA: "media",
  SOCIAL: "social",
  NOTIFICATIONS: "notifications",
  MAINTENANCE: "maintenance",
  PLAY: "play",
  BUSINESS: "business",
  PLAY_RELEASES: "play-releases",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
