import type { Metadata } from "next";

import { BRAND } from "@/lib/config";

export const SEO = {
  home: {
    title: "AI for Google Reviews, Social Posts & Meta Ads | TreeVook",
    description:
      "Reply to every Google and Play Store review, auto-post to Instagram and Facebook, and run Meta ads with AI. You approve what goes live. Free in early access.",
  },
  "google-business": {
    title: "Google Review Reply Software with AI | TreeVook",
    description:
      "Reply to every Google review in your voice, post offers and keep your Google Business Profile up to date with AI. Rules per star rating. Free in early access.",
  },
  "play-reviews": {
    title: "Google Play Review Reply Tool with AI | TreeVook",
    description:
      "Auto-reply to Google Play reviews in the reviewer's language, with rules per star rating, a safety pause and crash alerts for releases. Free in early access.",
  },
  "instagram-autopost": {
    title: "Instagram Auto Post & Content Calendar with AI | TreeVook",
    description:
      "AI plans a week of Instagram posts, Reels and Stories, writes captions, designs on-brand images and posts at the best time. Approve each post or let it run.",
  },
  "facebook-autopost": {
    title: "Facebook Page Auto Post & Comment Replies with AI | TreeVook",
    description:
      "Schedule Facebook Page posts written in your voice and auto-reply to comments with AI. Questions get answered, complaints wait for you. Free in early access.",
  },
  "meta-ads": {
    title: "Facebook & Instagram Ads Manager with AI | TreeVook",
    description:
      "AI plans Facebook and Instagram ad campaigns, explains every setting and checks results every morning. Nothing spends until you approve.",
  },
} as const;

export function pageMeta(key: keyof typeof SEO, path: string): Metadata {
  const { title, description } = SEO[key];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      locale: "en_IN",
      url: path,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
