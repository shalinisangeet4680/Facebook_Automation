import { ServiceAccountKey } from "./ports/play-api";

export const PACKAGE_NAME = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

export function parseServiceAccount(raw: string): ServiceAccountKey | string {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw.trim()) as Record<string, unknown>;
  } catch {
    return "Paste the whole JSON key file you downloaded from Google Cloud.";
  }
  if (!json || typeof json !== "object") return "This isn't a JSON key file.";
  if (json.type !== "service_account")
    return "This is not a service account key. In Google Cloud, create a key for a service account and choose JSON.";
  const clientEmail = json.client_email;
  const privateKey = json.private_key;
  const projectId = json.project_id;
  if (
    typeof clientEmail !== "string" ||
    !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(clientEmail)
  )
    return "The key has no valid client_email.";
  if (
    typeof privateKey !== "string" ||
    !privateKey.includes("-----BEGIN PRIVATE KEY-----")
  )
    return "The key has no private_key. Download a new JSON key.";
  if (typeof projectId !== "string" || !projectId)
    return "The key has no project_id.";
  const tokenUri =
    typeof json.token_uri === "string" &&
    json.token_uri.startsWith("https://oauth2.googleapis.com/")
      ? json.token_uri
      : "https://oauth2.googleapis.com/token";
  return { clientEmail, privateKey, projectId, tokenUri };
}
