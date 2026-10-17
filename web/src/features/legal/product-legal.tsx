import type { ProductPage } from "@/features/products/catalog";

import { LEGAL, type LegalSection } from "./legal-page";
import { PRIVACY_SECTIONS } from "./privacy";
import { TERMS_SECTIONS } from "./terms";

const mail = <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;

const PLATFORM_NAME: Record<ProductPage["platform"], string> = {
  "google-business": "Google Business Profile",
  "google-play": "Google Play Console",
  meta: "Meta (Facebook and Instagram)",
};

const KEEP_PLATFORM: Record<ProductPage["platform"], string> = {
  "google-business": "google",
  "google-play": "google-play",
  meta: "meta",
};

const googlePlaySection: LegalSection = {
  id: "google-play",
  title: "Google Play data",
  body: (
    <>
      <p>
        You connect Google Play by uploading a key for a Google Cloud service account that you own
        and invite to Play Console. We encrypt the key with AES-256-GCM, and we use it only to read
        your apps, reviews and reports and to post the replies you approve or your rules allow.
      </p>
      <p>
        You can revoke access at any time by removing the service account from Play Console or
        deleting its key in Google Cloud. We follow the Google Play Developer API terms.
      </p>
    </>
  ),
};

export function privacyFor(product: ProductPage): LegalSection[] {
  const keep = KEEP_PLATFORM[product.platform];
  const sections = PRIVACY_SECTIONS.filter(
    (s) => !["google", "meta"].includes(s.id) || s.id === keep,
  ).map((s): LegalSection => {
    if (s.id === "who-we-are")
      return {
        ...s,
        body: (
          <>
            <p>
              {product.name} is a TreeVook AI product run by {LEGAL.company} (“TreeVook”, “we”,
              “us”), India. This policy covers {product.name} only, whether you use it on its own
              site or inside TreeVook AI.
            </p>
            <p>
              Questions or requests: {mail}. Registered office: {LEGAL.address}.
            </p>
          </>
        ),
      };
    if (s.id === "what-we-collect")
      return {
        ...s,
        body: (
          <>
            <h3>Your account</h3>
            <ul>
              <li>Your mobile number, used to sign you in with a one-time code.</li>
              <li>Your name, workspace name and role, and an email address if you give one.</li>
            </ul>
            <h3>From {PLATFORM_NAME[product.platform]}</h3>
            <ul>
              {product.collects.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <h3>Optional</h3>
            <ul>
              <li>A Slack webhook address, if you turn on alerts.</li>
              <li>Your own Anthropic API key, if you choose to use it.</li>
            </ul>
            <h3>What you create</h3>
            <p>Templates, rules, drafts, posts and images you make in {product.name}.</p>
            <h3>Technical data</h3>
            <p>
              IP address, browser or device type, sign-in sessions, error logs and an activity log
              of actions in your workspace.
            </p>
          </>
        ),
      };
    return s;
  });
  if (product.platform === "google-play") {
    const at = sections.findIndex((s) => s.id === "ai") + 1;
    sections.splice(at, 0, googlePlaySection);
  }
  return sections;
}

export function termsFor(product: ProductPage): LegalSection[] {
  return TERMS_SECTIONS.filter((s) => s.id !== "ads" || product.id === "meta").map(
    (s): LegalSection => {
      if (s.id === "agreement")
        return {
          ...s,
          body: (
            <p>
              These terms are an agreement between you and {LEGAL.company} for using {product.name},
              a TreeVook AI product. By signing up or using {product.name}, you accept them. If you
              use it for a business, you confirm that you’re allowed to accept these terms for that
              business.
            </p>
          ),
        };
      if (s.id === "service")
        return {
          ...s,
          body: (
            <p>
              {product.sub} Features are added and changed over time.
              {product.soon
                ? ` ${product.name} is in early access, so features may change or be withdrawn.`
                : " Early-access features may change or be withdrawn."}
            </p>
          ),
        };
      if (s.id === "connected")
        return {
          ...s,
          body: (
            <>
              <p>
                When you connect {PLATFORM_NAME[product.platform]}, you allow {product.name} to
                access that account and act in it as you set up. That includes posting automatically
                when you turn on Auto mode.
              </p>
              <p>
                You confirm you have the right to connect it. {PLATFORM_NAME[product.platform]}’s
                own terms also apply to you. We are not responsible for its outages, policy changes
                or actions it takes on your account.
              </p>
            </>
          ),
        };
      return s;
    },
  );
}
