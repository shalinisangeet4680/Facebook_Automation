export const JOBS = {
  TOKEN_HEALTH: "token-health",
  CLEANUP: "cleanup",
  REFRESH_ASSETS: "refresh-assets",
} as const;

export interface WorkspaceJobData {
  workspaceId: string;
  requestedBy?: string;
}
