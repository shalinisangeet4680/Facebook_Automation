import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const CODE = "123456";
export const API_PHONE = "9000000007";
export const JOURNEY_PHONES: Record<string, string> = {
  desktop: "9000000009",
  mobile: "9000000008",
};
export const VALID_TOKEN = `EAA${"e".repeat(60)}`;
export const NO_PERMS_TOKEN = `EAA${"e".repeat(40)}noperms`;
export const STORAGE_STATE = "e2e/.auth/state.json";

export async function signInViaApi(request: APIRequestContext, phone: string) {
  await request.post("/api/v1/auth/otp/request", { data: { phone } });
  const res = await request.post("/api/v1/auth/otp/verify", { data: { phone, code: CODE } });
  expect(res.ok(), `sign-in failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

export async function goToCode(page: Page, phone: string) {
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Enter the code" })).toBeVisible();
}
