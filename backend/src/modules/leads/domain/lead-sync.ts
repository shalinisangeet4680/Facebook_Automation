export const SYNC_EVERY_MS = 15 * 60_000;
export const RECONCILE_EVERY_MS = 60 * 60_000;
export const CURSOR_OVERLAP_SECONDS = 300;
export const ALERT_LIMIT = 5;
export const LEADS_PERMISSION = "leads_retrieval";

export type SyncErrorCode =
  "permission_missing" | "not_connected" | "no_page" | "failed";

export const SCHEDULER_PREFIX = "leads-sync:";

export function schedulerId(workspaceId: string): string {
  return `${SCHEDULER_PREFIX}${workspaceId}`;
}

export function sinceFor(lastLeadAt: Date | null): number | null {
  if (!lastLeadAt) return null;
  return Math.max(
    0,
    Math.floor(lastLeadAt.getTime() / 1000) - CURSOR_OVERLAP_SECONDS,
  );
}

export function isPermissionError(err: unknown): boolean {
  const e = err as {
    code?: string;
    message?: string;
    details?: { metaCode?: number | null };
  };
  if (e?.code !== "META_REJECTED") return false;
  const code = e.details?.metaCode;
  return (
    code === 10 ||
    code === 200 ||
    code === 283 ||
    /leads_retrieval|pages_manage_ads|permission/i.test(e.message ?? "")
  );
}

export function permissionFixes(method: string | null): string[] {
  return method === "facebook_login"
    ? [
        "Open Setup and select Continue with Facebook again. Keep the leads permission switched on when Facebook asks.",
      ]
    : [
        "In Meta Business settings, open System users, generate a new token for your app and tick leads_retrieval and pages_manage_ads.",
        "Paste the new token in Setup → Connect Meta. Or reconnect with Continue with Facebook instead.",
      ];
}

export function shouldAlert(leadCreated: Date, trackedSince: Date): boolean {
  return leadCreated.getTime() >= trackedSince.getTime() - 5 * 60_000;
}
