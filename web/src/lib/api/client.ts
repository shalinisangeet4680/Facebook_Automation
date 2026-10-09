import createClient from "openapi-fetch";

import { toApiError } from "./errors";
import type { paths } from "./schema";

const NO_REFRESH = ["/api/v1/auth/otp/", "/api/v1/auth/refresh"];

let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "X-Client": "web" },
    credentials: "same-origin",
  })
    .then((res) => res.ok || res.status === 409)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

let expiredHandler: () => void = () => undefined;

export function onSessionExpired(handler: () => void): () => void {
  expiredHandler = handler;
  return () => {
    expiredHandler = () => undefined;
  };
}

function sessionExpired(): void {
  expiredHandler();
}

export async function authFetch(request: Request): Promise<Response> {
  const retry = request.clone();
  const response = await fetch(request);
  const path = new URL(request.url).pathname;
  if (response.status !== 401 || NO_REFRESH.some((p) => path.startsWith(p))) {
    return response;
  }
  if (await refreshSession()) return fetch(retry);
  sessionExpired();
  return response;
}

export const api = createClient<paths>({
  baseUrl: "",
  fetch: authFetch,
  credentials: "same-origin",
  headers: { "X-Client": "web" },
});

export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok) throw toApiError(response.status, error);
  return data as T;
}
