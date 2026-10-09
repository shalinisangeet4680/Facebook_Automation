import { ProtocolError } from "@shared/errors/domain-error";

export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "invalid_redirect_uri"
  | "invalid_client_metadata"
  | "access_denied";

export const oauthError = (
  error: OAuthErrorCode,
  description: string,
  status = 400,
  headers: Record<string, string> = {},
) =>
  new ProtocolError(status, { error, error_description: description }, headers);
