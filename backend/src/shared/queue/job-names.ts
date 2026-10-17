export const JOBS = {
  TOKEN_HEALTH: "token-health",
  CLEANUP: "cleanup",
  REFRESH_ASSETS: "refresh-assets",
  PUBLISH_POST: "publish-post",
  RUN_RULES_ALL: "run-rules-all",
  PLAY_TICK: "play-tick",
  BUSINESS_TICK: "business-tick",
  AUTOPOST_TICK: "autopost-tick",
} as const;

export interface WorkspaceJobData {
  workspaceId: string;
  requestedBy?: string;
}
