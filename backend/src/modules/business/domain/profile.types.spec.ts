import {
  toLocation,
  toNewLocation,
  toVerification,
} from "../infrastructure/google-business.client";
import {
  NewBusiness,
  checkNewBusiness,
  newBusinessSummary,
} from "./profile.types";

const business = (patch: Partial<NewBusiness> = {}): NewBusiness => ({
  title: "Smile Care",
  primaryCategory: {
    name: "categories/gcid:dentist",
    displayName: "Dentist",
  },
  additionalCategories: [],
  phone: "+91 98765 43210",
  website: "https://smile.example.in",
  description: "",
  address: {
    lines: ["1 Main Road"],
    locality: "Patna",
    region: "Bihar",
    postalCode: "800001",
    country: "IN",
  },
  serviceArea: null,
  hours: [{ day: "MONDAY", open: "09:00", close: "24:00" }],
  languageCode: "en",
  ...patch,
});

describe("new business profiles", () => {
  it("accepts a complete storefront and a service-area business", () => {
    expect(checkNewBusiness(business())).toEqual([]);
    expect(
      checkNewBusiness(
        business({
          address: null,
          serviceArea: { regionCode: "IN", places: ["Patna"] },
        }),
      ),
    ).toEqual([]);
  });

  it("explains what is missing or wrong", () => {
    expect(
      checkNewBusiness(
        business({
          primaryCategory: null,
          phone: null,
          website: "http://smile.example.in",
          address: null,
        }),
      ),
    ).toEqual([
      "Choose a category from Google's list.",
      "The website must start with https://.",
      "Add the address customers visit, or the areas you serve if you go to them.",
    ]);
    expect(checkNewBusiness(business({ phone: "+91 98x65" }))).toContain(
      "Use a phone number like +91 98765 43210, with digits only.",
    );
    expect(
      checkNewBusiness(business({ phone: null, website: null })),
    ).toContain("Add a phone number or website so customers can reach you.");
    expect(
      checkNewBusiness(
        business({
          address: null,
          serviceArea: { regionCode: "IN", places: [] },
        }),
      ),
    ).toEqual(["Add at least one city or area you serve."]);
  });

  it("summarizes a draft for confirmation", () => {
    expect(newBusinessSummary(business({ hours: [] }))).toEqual([
      "Name: Smile Care",
      "Category: Dentist",
      "Address: 1 Main Road, Patna, Bihar, 800001",
      "Phone: +91 98765 43210",
      "Website: https://smile.example.in",
      "Hours: not set",
    ]);
  });

  it("maps a draft to Google's location shape", () => {
    const sab = toNewLocation(
      business({
        address: null,
        serviceArea: { regionCode: "IN", places: ["Patna", "Danapur"] },
      }),
    );
    expect(sab).toMatchObject({
      title: "Smile Care",
      categories: { primaryCategory: { name: "categories/gcid:dentist" } },
      serviceArea: {
        businessType: "CUSTOMER_LOCATION_ONLY",
        regionCode: "IN",
        places: {
          placeInfos: [{ placeName: "Patna" }, { placeName: "Danapur" }],
        },
      },
      regularHours: {
        periods: [
          {
            openDay: "MONDAY",
            closeDay: "TUESDAY",
            closeTime: { hours: 0, minutes: 0 },
          },
        ],
      },
    });
    expect(sab).not.toHaveProperty("storefrontAddress");
    expect(toNewLocation(business()).storefrontAddress).toEqual({
      regionCode: "IN",
      languageCode: "en",
      postalCode: "800001",
      administrativeArea: "Bihar",
      locality: "Patna",
      addressLines: ["1 Main Road"],
    });
  });

  it("reads service areas and verification states from Google", () => {
    const l = toLocation({
      name: "locations/1",
      title: "Clean Co",
      serviceArea: {
        regionCode: "IN",
        places: { placeInfos: [{ placeName: "Patna" }] },
      },
      metadata: { hasVoiceOfMerchant: false },
    });
    expect(l.info.serviceArea).toEqual({ regionCode: "IN", places: ["Patna"] });
    expect(l.info.address).toBeNull();
    expect(l.verified).toBe(false);
    expect(
      toVerification({ name: "locations/1/verifications/2", method: "SMS" }),
    ).toMatchObject({ method: "SMS", state: "PENDING" });
    expect(
      toVerification({
        name: "locations/1/verifications/3",
        method: "VIDEO",
        state: "COMPLETED",
      }),
    ).toMatchObject({ method: "VETTED_PARTNER", state: "COMPLETED" });
  });
});
