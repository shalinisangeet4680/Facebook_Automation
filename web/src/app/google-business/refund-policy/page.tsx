import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/legal-page";
import { REFUND_SUMMARY, refundsFor } from "@/features/legal/refunds";
import { bySlug } from "@/features/products/catalog";
import { ProductFooter, ProductHeader } from "@/features/products/product-landing";

import "@/features/landing/landing.css";

const product = bySlug("google-business");

export const metadata: Metadata = {
  alternates: { canonical: `/${product.slug}/refund-policy` },
  title: { absolute: `Cancellation & Refund Policy · ${product.name}` },
  description: `Cancellation and refund policy for ${product.name} by TreeVook LLP.`,
};

export default function Page() {
  return (
    <LegalPage
      title={`${product.name} Cancellation & Refund Policy`}
      summary={REFUND_SUMMARY}
      sections={refundsFor(product)}
      header={<ProductHeader product={product} />}
      footer={<ProductFooter product={product} />}
    />
  );
}
