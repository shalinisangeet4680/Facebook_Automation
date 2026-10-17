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
  AUTOPOST: "autopost",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
