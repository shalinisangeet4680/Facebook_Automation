import Link from "next/link";

import type { ProductPage } from "@/features/products/catalog";

import { LEGAL, type LegalSection } from "./legal-page";

const mail = <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;

export const REFUND_SUMMARY = [
  "TreeVook is free during early access, so there is nothing to pay or refund yet.",
  "On a paid plan you can cancel any time. You keep access until the end of the period you paid for, and you won’t be charged again.",
  "Changed your mind? Ask within 7 days of your first payment for a full refund. Billing mistakes are always refunded.",
];

function notRefundable(ads: boolean) {
  return (
    <ul>
      {ads ? (
        <li>
          Ad spend. Meta charges your ad account directly for ads, so TreeVook never receives that
          money and can’t refund it. Ask Meta about ad charges.
        </li>
      ) : null}
      <li>
        Fees charged by Google, Meta, your bank or card issuer, including currency conversion.
      </li>
      <li>Usage billed to your own Anthropic API key, if you chose to use one.</li>
      <li>Periods after the refund windows above, except where this policy says otherwise.</li>
    </ul>
  );
}

function sections(name: string, ads: boolean, termsHref: string): LegalSection[] {
  return [
    {
      id: "scope",
      title: "What this covers",
      body: (
        <p>
          This policy covers payments you make to {LEGAL.company} for {name}: subscriptions,
          upgrades and add-ons. It doesn’t cover anything you buy from Google, Meta or other
          platforms, even when you manage it through {name}.
        </p>
      ),
    },
    {
      id: "early-access",
      title: "Early access is free",
      body: (
        <p>
          {name} is free during early access and we don’t ask for payment details. Before paid plans
          start we’ll give you at least 30 days’ notice, and you can choose not to continue. Nothing
          is charged automatically when early access ends.
        </p>
      ),
    },
    {
      id: "billing",
      title: "How billing works",
      body: (
        <ul>
          <li>Paid plans are billed in advance, monthly or yearly, in Indian rupees.</li>
          <li>GST and other taxes are added where the law requires.</li>
          <li>
            Payments go through our payment provider. We don’t store your card or bank details.
          </li>
          <li>A tax invoice is emailed to the workspace owner after every payment.</li>
        </ul>
      ),
    },
    {
      id: "cancellation",
      title: "Cancelling",
      body: (
        <>
          <p>
            You can cancel any time in Settings → Billing, or by emailing {mail}. Cancelling stops
            the next renewal. You keep full access until the end of the period you already paid for,
            and we won’t charge you again.
          </p>
          <p>
            To also remove your data, follow the <Link href="/data-deletion">data deletion</Link>{" "}
            steps. Deleting your account doesn’t by itself trigger a refund.
          </p>
        </>
      ),
    },
    {
      id: "refunds",
      title: "Refunds",
      body: (
        <ul>
          <li>
            <strong>First payment:</strong> a full refund if you ask within 7 days of your first
            payment for a paid plan. This applies once per workspace.
          </li>
          <li>
            <strong>Yearly plans:</strong> a full refund if you ask within 14 days of buying or
            renewing. After that, the plan runs to the end of the year and won’t renew.
          </li>
          <li>
            <strong>Monthly renewals:</strong> not refunded once the month has started. Cancel
            before the next renewal date to avoid the charge.
          </li>
          <li>
            <strong>Billing mistakes:</strong> duplicate charges, charges after you cancelled, or
            the wrong amount are always refunded in full.
          </li>
          <li>
            <strong>If we stop the service:</strong> if we discontinue {name}, or close your account
            without you breaking our Terms, we refund the unused part of your paid period.
          </li>
          <li>
            <strong>Breaking the Terms:</strong> if we close an account because it broke our{" "}
            <Link href={termsHref}>Terms of Service</Link>, the current period isn’t refunded.
          </li>
        </ul>
      ),
    },
    {
      id: "not-refundable",
      title: "What we can’t refund",
      body: notRefundable(ads),
    },
    {
      id: "plan-changes",
      title: "Upgrades and downgrades",
      body: (
        <p>
          An upgrade starts straight away, and you pay only the difference for the rest of the
          current period. A downgrade starts from your next billing date, so there’s no refund for
          the current period.
        </p>
      ),
    },
    {
      id: "how",
      title: "How to ask for a refund",
      body: (
        <>
          <p>
            Email {mail} from the workspace owner’s email address with the workspace name and the
            payment date, amount or payment ID.
          </p>
          <ul>
            <li>We reply within 2 business days.</li>
            <li>
              Approved refunds go back to the original payment method within 7 business days, with a
              credit note for any tax.
            </li>
            <li>Your bank may take another 5–10 business days to show it.</li>
          </ul>
        </>
      ),
    },
    {
      id: "disputes",
      title: "Payment disputes",
      body: (
        <p>
          Please contact us before raising a chargeback with your bank. We can usually fix a billing
          problem faster. While a chargeback is open, we may pause paid features on the workspace.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <p>
          We may update this policy. If a change reduces your rights, we’ll email the workspace
          owner at least 30 days before it applies. Changes never affect payments already made.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <p>
          {LEGAL.company}, {LEGAL.address}. Email {mail}. For complaints you can also write to our
          Grievance Officer, {LEGAL.grievanceOfficer}, at the same address.
        </p>
      ),
    },
  ];
}

export const REFUND_SECTIONS = sections("TreeVook AI", true, "/terms");

export function refundsFor(product: ProductPage): LegalSection[] {
  return sections(product.name, product.id === "meta", `/${product.slug}/terms`);
}
