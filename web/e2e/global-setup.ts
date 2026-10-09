import { request } from "@playwright/test";
import { execSync } from "child_process";
import { mkdirSync } from "fs";

import { API_PHONE, JOURNEY_PHONES, STORAGE_STATE, signInViaApi } from "./fixtures";

function resetLocalState() {
  if (process.env.CI) return;
  const phones = [API_PHONE, ...Object.values(JOURNEY_PHONES)].map((p) => `'+91${p}'`).join(",");
  try {
    execSync(`redis-cli --scan --pattern "throttle:*" | xargs redis-cli del`, { stdio: "ignore" });
    execSync(
      `psql -d ${process.env.E2E_DATABASE ?? "adpilot_dev"} -qc "delete from otp_challenges where phone in (${phones})"`,
      {
        stdio: "ignore",
        env: { ...process.env, PATH: `/opt/homebrew/opt/postgresql@17/bin:${process.env.PATH}` },
      },
    );
  } catch {
    return;
  }
}

export default async function globalSetup() {
  resetLocalState();
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3200";
  const context = await request.newContext({ baseURL, extraHTTPHeaders: { "X-Client": "web" } });
  await signInViaApi(context, API_PHONE);
  mkdirSync("e2e/.auth", { recursive: true });
  await context.storageState({ path: STORAGE_STATE });
  await context.dispose();
}
