import Link from "next/link";

import { LEGAL, type LegalSection } from "./legal-page";

export const TERMS_SUMMARY = [
  "You decide what TreeVook does in your accounts, and you’re responsible for what’s posted in your name.",
  "Follow Google’s and Meta’s rules: no fake reviews, spam or misleading ads.",
  "TreeVook is free during early access. We’ll give at least 30 days’ notice before paid plans start.",
];

const mail = <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: (
      <p>
        These terms are an agreement between you and {LEGAL.company} for using TreeVook AI. By
        signing up or using TreeVook, you accept them. If you use TreeVook for a business, you
        confirm that you’re allowed to accept these terms for that business.
      </p>
    ),
  },
  {
    id: "service",
    title: "The service",
    body: (
      <p>
        TreeVook helps businesses manage Google Business Profiles, Google Play reviews, and Facebook
        and Instagram pages and ads with AI. Features are added and changed over time. Early-access
        and “coming soon” features may change or be withdrawn.
      </p>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <ul>
        <li>You must be at least 18 and give accurate information.</li>
        <li>Keep access to your phone number and devices secure.</li>
        <li>You are responsible for everything people in your workspace do.</li>
      </ul>
    ),
  },
  {
    id: "connected",
    title: "Connected accounts",
    body: (
      <>
        <p>
          When you connect Google, Google Play, Meta or Slack, you allow TreeVook to access those
          accounts and act in them as you set up. That includes posting automatically when you turn
          on Auto mode for a rating, post type or rule.
        </p>
        <p>
          You confirm you have the right to connect each account. Those platforms’ own terms also
          apply to you. We are not responsible for their outages, policy changes, or actions they
          take on your accounts, such as suspensions or rejected posts.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI-written content",
    body: (
      <ul>
        <li>AI drafts can be wrong. Check drafts before you approve them.</li>
        <li>
          You are responsible for replies, posts and ads published in your name. This includes ones
          that were published automatically because you turned on Auto mode.
        </li>
        <li>
          We do not promise any particular result, such as higher ratings, more leads or sales.
        </li>
      </ul>
    ),
  },
  {
    id: "ads",
    title: "Ads and ad spend",
    body: (
      <p>
        Meta bills ad spend directly to the payment method on your ad account. TreeVook launches
        campaigns and changes budgets only after you approve them in the app or confirm them in
        Claude. You are responsible for your ad spend and for following Meta’s advertising policies.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Do not use TreeVook to:</p>
        <ul>
          <li>
            post fake, paid-for or incentivised reviews, or only ask happy customers for reviews;
          </li>
          <li>pretend to be someone else, or post spam;</li>
          <li>make misleading claims, including health claims that promise cures or outcomes;</li>
          <li>post anything illegal, hateful or harmful;</li>
          <li>
            copy, scrape, reverse engineer, overload or resell the service without our permission.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content and data",
    body: (
      <p>
        You own your content and data. You allow us to store and process them only to run TreeVook
        for you, as described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
  {
    id: "ours",
    title: "Our software and brand",
    body: (
      <p>
        TreeVook’s software, design and brand belong to {LEGAL.company}. These terms do not give you
        any rights to them beyond using the service.
      </p>
    ),
  },
  {
    id: "fees",
    title: "Fees",
    body: (
      <p>
        TreeVook is free during early access. Before paid plans start, we will give you at least 30
        days’ notice, and you can choose not to continue. Prices will exclude applicable taxes.
        Cancellations and refunds follow our{" "}
        <Link href="/refund-policy">Cancellation &amp; Refund Policy</Link>.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Ending the service",
    body: (
      <p>
        You can stop using TreeVook and ask us to delete your data at any time. We may suspend or
        close an account that breaks these terms, puts others at risk, or where the law requires it.
        Where we reasonably can, we will tell you first. We then delete your data as described in
        the Privacy Policy.
      </p>
    ),
  },
  {
    id: "disclaimer",
    title: "Disclaimer",
    body: (
      <p>
        TreeVook is provided “as is”. We work to keep it available and accurate, but we do not
        guarantee that it will be uninterrupted or error-free.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        As far as the law allows, we are not liable for indirect or consequential losses, such as
        lost profits or reputation. We are also not liable for actions taken by Google, Meta or
        other platforms. Our total liability is limited to the greater of the fees you paid us in
        the last 12 months or ₹5,000.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: (
      <p>
        If a claim against us arises from your content, your connected accounts or your breach of
        these terms, you agree to cover our reasonable costs.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of India. The courts at {LEGAL.courts} have exclusive
        jurisdiction.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We will tell you about important changes by email or in the app before they take effect. If
        you keep using TreeVook after that, the new terms apply.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        {LEGAL.company}, {LEGAL.address}. Email {mail}.
      </p>
    ),
  },
];
