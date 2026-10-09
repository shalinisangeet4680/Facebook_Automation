export const QUEUES = {
  META_SYNC: "meta-sync",
  AUTOPILOT: "autopilot",
  AI: "ai",
  MEDIA: "media",
  NOTIFICATIONS: "notifications",
  MAINTENANCE: "maintenance",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
