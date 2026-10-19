export interface LoginDialogInput {
  version: string;
  appId: string;
  configId: string;
  redirectUri: string;
  state: string;
}

export function loginDialogUrl(input: LoginDialogInput): string {
  const url = new URL(`https://www.facebook.com/${input.version}/dialog/oauth`);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("config_id", input.configId);
  url.searchParams.set("override_default_response_type", "true");
  return url.toString();
}

export function safeNext(value?: string | null): string | null {
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

export function loginErrorMessage(query: {
  error?: string;
  error_reason?: string;
}): string {
  return query.error === "access_denied" || query.error_reason === "user_denied"
    ? "Facebook sign-in was cancelled."
    : "Facebook sign-in didn't finish. Try again.";
}
