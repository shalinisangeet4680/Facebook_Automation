export const JOBS = {
  TOKEN_HEALTH: "token-health",
  CLEANUP: "cleanup",
  REFRESH_ASSETS: "refresh-assets",
  PUBLISH_POST: "publish-post",
} as const;

export interface WorkspaceJobData {
  workspaceId: string;
  requestedBy?: string;
}
