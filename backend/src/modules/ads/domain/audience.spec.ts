import { hasLocation, parseAudience, targetingSchema } from "./audience";

const targeting = {
  regions: [{ key: "1730", name: "Bihar" }],
  ageMin: 25,
  ageMax: 45,
  interests: [{ id: "6003107902433", name: "Physician" }],
};

describe("saved audiences", () => {
  it("accepts a plan-shaped targeting and fills in defaults", () => {
    const parsed = parseAudience({ name: "  Bihar doctors ", targeting });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.audience.name).toBe("Bihar doctors");
    expect(parsed.audience.targeting).toMatchObject({
      countries: [],
      cities: [],
      genders: "all",
      workPositions: [],
      customAudiences: [],
      excludedCustomAudiences: [],
    });
    expect(hasLocation(parsed.audience.targeting)).toBe(true);
  });

  it("rejects bad names, ages and unknown genders", () => {
    expect(parseAudience({ name: "", targeting }).ok).toBe(false);
    expect(parseAudience({ name: "x".repeat(81), targeting }).ok).toBe(false);
    const ages = parseAudience({
      name: "Ages",
      targeting: { ...targeting, ageMin: 50, ageMax: 30 },
    });
    expect(!ages.ok && ages.message).toContain("ageMin");
    expect(
      parseAudience({
        name: "Young",
        targeting: { ...targeting, ageMin: 13 },
      }).ok,
    ).toBe(false);
    expect(
      parseAudience({
        name: "G",
        targeting: { ...targeting, genders: "other" },
      }).ok,
    ).toBe(false);
    expect(parseAudience({ name: "No targeting" }).ok).toBe(false);
  });

  it("checks custom audiences", () => {
    const both = targetingSchema.safeParse({
      ...targeting,
      customAudiences: [{ id: "23851000000000001", name: "Visitors" }],
      excludedCustomAudiences: [{ id: "23851000000000001", name: "Visitors" }],
    });
    expect(both.success).toBe(false);
    expect(
      targetingSchema.safeParse({
        ...targeting,
        customAudiences: [{ id: "abc", name: "Bad id" }],
      }).success,
    ).toBe(false);
    expect(
      targetingSchema.safeParse({
        ...targeting,
        customAudiences: [{ id: "23851000000000001", name: "Visitors" }],
        excludedCustomAudiences: [
          { id: "23851000000000002", name: "Customers" },
        ],
      }).success,
    ).toBe(true);
  });

  it("knows when no location is chosen", () => {
    const t = targetingSchema.parse({ ageMin: 18, ageMax: 65 });
    expect(hasLocation(t)).toBe(false);
  });
});
