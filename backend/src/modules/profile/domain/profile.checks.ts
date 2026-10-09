import {
  FacebookProfile,
  InstagramProfile,
} from "@modules/meta/domain/ports/meta-profile";

export type CheckStatus = "done" | "missing" | "weak";

export interface ProfileCheck {
  key: string;
  label: string;
  status: CheckStatus;
  hint: string;
}

export function facebookChecks(p: FacebookProfile): ProfileCheck[] {
  const about = p.about?.trim() ?? "";
  return [
    {
      key: "picture",
      label: "Profile picture (logo)",
      status: p.pictureIsDefault ? "missing" : "done",
      hint: "A clear square logo, at least 720 × 720.",
    },
    {
      key: "cover",
      label: "Cover photo",
      status: p.coverUrl ? "done" : "missing",
      hint: "1640 × 624 banner showing what you offer.",
    },
    {
      key: "about",
      label: "Short description",
      status: !about ? "missing" : about.length < 40 ? "weak" : "done",
      hint: "One or two lines on who you help and how.",
    },
    {
      key: "website",
      label: "Website",
      status: p.website ? "done" : "missing",
      hint: "Where people sign up or book a demo.",
    },
    {
      key: "contact",
      label: "Phone or email",
      status: p.phone || p.email ? "done" : "missing",
      hint: "So customers can reach you directly.",
    },
  ];
}

export function instagramChecks(p: InstagramProfile): ProfileCheck[] {
  const bio = p.biography?.trim() ?? "";
  return [
    {
      key: "picture",
      label: "Profile picture (logo)",
      status: p.pictureUrl ? "done" : "missing",
      hint: "Same logo as Facebook, readable in a small circle.",
    },
    {
      key: "name",
      label: "Display name",
      status: p.name ? "done" : "missing",
      hint: "Brand name plus a keyword, e.g. “Arogya System | Clinic App”.",
    },
    {
      key: "bio",
      label: "Bio",
      status: !bio ? "missing" : bio.length < 60 ? "weak" : "done",
      hint: "Up to 150 characters: what you do, who for, and a call to action.",
    },
    {
      key: "website",
      label: "Link in bio",
      status: p.website ? "done" : "missing",
      hint: "Your website or demo page.",
    },
  ];
}

export function score(checks: ProfileCheck[]): number {
  if (!checks.length) return 0;
  const points = checks.reduce(
    (sum, c) => sum + (c.status === "done" ? 1 : c.status === "weak" ? 0.5 : 0),
    0,
  );
  return Math.round((points / checks.length) * 100);
}
