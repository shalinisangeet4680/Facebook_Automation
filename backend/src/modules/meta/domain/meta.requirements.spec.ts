import { missingPermissions, PERMISSIONS } from "./meta.requirements";

describe("missingPermissions", () => {
  it("returns nothing missing when everything is granted", () => {
    expect(missingPermissions(PERMISSIONS.map((p) => p.name))).toEqual({
      required: [],
      recommended: [],
      optional: [],
    });
  });

  it("groups missing permissions by level", () => {
    const granted = PERMISSIONS.filter(
      (p) =>
        !["ads_management", "pages_manage_posts", "leads_retrieval"].includes(
          p.name,
        ),
    ).map((p) => p.name);
    expect(missingPermissions(granted)).toEqual({
      required: ["ads_management"],
      recommended: ["pages_manage_posts"],
      optional: ["leads_retrieval"],
    });
  });
});
