import {
  BusinessAddress,
  OpeningPeriod,
  ServiceArea,
  checkInfo,
  hoursText,
} from "./business.types";

export const VERIFICATION_METHODS = [
  "SMS",
  "PHONE_CALL",
  "EMAIL",
  "ADDRESS",
  "AUTO",
  "VETTED_PARTNER",
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const VERIFICATION_STATES = [
  "verified",
  "unverified",
  "pending",
  "failed",
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const METHOD_LABEL: Record<VerificationMethod, string> = {
  SMS: "Text message",
  PHONE_CALL: "Phone call",
  EMAIL: "Email",
  ADDRESS: "Postcard by mail",
  AUTO: "Instant verification",
  VETTED_PARTNER: "Verified partner",
};

export const CODE_METHODS: VerificationMethod[] = [
  "SMS",
  "PHONE_CALL",
  "EMAIL",
  "ADDRESS",
];

export interface BusinessCategory {
  name: string;
  displayName: string;
}

export interface NewBusiness {
  title: string;
  primaryCategory: BusinessCategory | null;
  additionalCategories: BusinessCategory[];
  phone: string | null;
  website: string | null;
  description: string;
  address: BusinessAddress | null;
  serviceArea: ServiceArea | null;
  hours: OpeningPeriod[];
  languageCode: string;
}

export interface GoogleSearchInput {
  query: string;
  address: string | null;
  phone: string | null;
  regionCode: string;
}

const PHONE = /^\+?[0-9][0-9\s\-().]{5,22}$/;
const POSTAL: Record<string, RegExp> = {
  IN: /^\d{6}$/,
  US: /^\d{5}(-\d{4})?$/,
};

export function checkNewBusiness(b: NewBusiness): string[] {
  const problems = checkInfo({
    title: b.title,
    description: b.description,
    phone: b.phone,
    website: b.website,
    hours: b.hours,
  });
  if (!b.primaryCategory?.name.startsWith("categories/"))
    problems.push("Choose a category from Google's list.");
  if (b.additionalCategories.length > 9)
    problems.push("Google allows at most 9 extra categories.");
  if (b.phone && !PHONE.test(b.phone.trim()))
    problems.push("Use a phone number like +91 98765 43210, with digits only.");
  if (b.website && !/^https:\/\//i.test(b.website))
    problems.push("The website must start with https://.");
  if (!b.address && !b.serviceArea)
    problems.push(
      "Add the address customers visit, or the areas you serve if you go to them.",
    );
  if (b.address) {
    const a = b.address;
    if (!a.lines.some((l) => l.trim()))
      problems.push("Add the street address.");
    if (!a.locality.trim()) problems.push("Add the city.");
    if (!/^[A-Z]{2}$/.test(a.country)) problems.push("Choose the country.");
    const postal = POSTAL[a.country];
    if (!a.postalCode.trim()) problems.push("Add the postal code.");
    else if (postal && !postal.test(a.postalCode.trim()))
      problems.push("The postal code doesn't look right.");
  }
  if (b.serviceArea) {
    if (!/^[A-Z]{2}$/.test(b.serviceArea.regionCode))
      problems.push("Choose the country you serve.");
    if (!b.serviceArea.places.some((p) => p.trim()))
      problems.push("Add at least one city or area you serve.");
    if (b.serviceArea.places.length > 20)
      problems.push("Google allows at most 20 service areas.");
  }
  if (!b.phone && !b.website)
    problems.push("Add a phone number or website so customers can reach you.");
  return problems;
}

export function addressText(a: BusinessAddress | null): string | null {
  if (!a) return null;
  return [...a.lines, a.locality, a.region, a.postalCode]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");
}

export function newBusinessSummary(b: NewBusiness): string[] {
  return [
    `Name: ${b.title}`,
    `Category: ${[b.primaryCategory, ...b.additionalCategories]
      .filter(Boolean)
      .map((c) => c!.displayName)
      .join(", ")}`,
    b.address
      ? `Address: ${addressText(b.address)}`
      : `Serves: ${(b.serviceArea?.places ?? []).join(", ")} (no address shown)`,
    ...(b.phone ? [`Phone: ${b.phone}`] : []),
    ...(b.website ? [`Website: ${b.website}`] : []),
    `Hours: ${b.hours.length ? hoursText(b.hours) : "not set"}`,
    ...(b.description ? [`Description: ${b.description}`] : []),
  ];
}
