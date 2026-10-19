import { contactOf } from "./lead-fields";
import {
  isPermissionError,
  permissionFixes,
  shouldAlert,
  sinceFor,
} from "./lead-sync";

describe("contactOf", () => {
  it("reads the prefilled fields and labels custom answers", () => {
    expect(
      contactOf(
        [
          { name: "full_name", values: ["Priya Sharma"] },
          { name: "phone_number", values: ["+919812345678"] },
          { name: "email", values: ["priya@example.com"] },
          { name: "city", values: ["Patna"] },
          { name: "custom_1", values: ["Morning"] },
          { name: "clinic_size", values: ["5", "10"] },
          { name: "empty", values: [""] },
        ],
        [{ key: "custom_1", label: "Best time to call?" }],
      ),
    ).toEqual({
      name: "Priya Sharma",
      phone: "+919812345678",
      email: "priya@example.com",
      city: "Patna",
      answers: [
        { key: "custom_1", label: "Best time to call?", value: "Morning" },
        { key: "clinic_size", label: "Clinic size", value: "5, 10" },
      ],
    });
  });

  it("joins first and last names and tolerates missing fields", () => {
    expect(
      contactOf([
        { name: "first_name", values: ["Rohan"] },
        { name: "last_name", values: ["Verma"] },
      ]),
    ).toMatchObject({ name: "Rohan Verma", phone: null, email: null });
    expect(contactOf([])).toMatchObject({ name: null, answers: [] });
  });
});

describe("lead sync rules", () => {
  it("re-reads a short overlap after the last lead", () => {
    expect(sinceFor(null)).toBeNull();
    expect(sinceFor(new Date("2026-10-19T10:00:00Z"))).toBe(
      Date.parse("2026-10-19T10:00:00Z") / 1000 - 300,
    );
  });

  it("only alerts for leads that arrived after the form was tracked", () => {
    const tracked = new Date("2026-10-19T10:00:00Z");
    expect(shouldAlert(new Date("2026-10-19T10:30:00Z"), tracked)).toBe(true);
    expect(shouldAlert(new Date("2026-10-19T09:58:00Z"), tracked)).toBe(true);
    expect(shouldAlert(new Date("2026-10-18T10:00:00Z"), tracked)).toBe(false);
  });

  it("recognises Meta permission errors", () => {
    expect(
      isPermissionError({
        code: "META_REJECTED",
        message: "Something",
        details: { metaCode: 200 },
      }),
    ).toBe(true);
    expect(
      isPermissionError({
        code: "META_REJECTED",
        message: "Requires leads_retrieval permission",
      }),
    ).toBe(true);
    expect(
      isPermissionError({ code: "META_REJECTED", message: "Bad form" }),
    ).toBe(false);
    expect(isPermissionError(new Error("leads_retrieval"))).toBe(false);
  });

  it("explains how to fix the permission for each connection method", () => {
    expect(permissionFixes("facebook_login")[0]).toContain(
      "Continue with Facebook",
    );
    expect(permissionFixes("system_user_token").join(" ")).toContain(
      "leads_retrieval",
    );
  });
});
