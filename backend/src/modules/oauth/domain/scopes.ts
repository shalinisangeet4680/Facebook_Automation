import { RESOURCE_SCOPES, SCOPES, SUPPORTED_SCOPES } from "./oauth.policy";

export function parseScopes(raw: string | undefined | null): string[] {
  const requested = (raw ?? "").split(/\s+/).filter(Boolean);
  if (!requested.length) return [...RESOURCE_SCOPES];
  return [...new Set(requested)];
}

export function unsupportedScopes(scopes: string[]): string[] {
  return scopes.filter((s) => !SUPPORTED_SCOPES.includes(s));
}

export function grantableScopes(
  requested: string[],
  allowWrite: boolean,
): string[] {
  const out = new Set<string>([SCOPES.READ]);
  if (allowWrite && requested.includes(SCOPES.WRITE)) out.add(SCOPES.WRITE);
  return [...out];
}
