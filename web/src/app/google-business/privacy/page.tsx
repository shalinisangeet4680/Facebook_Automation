import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/legal-page";
import { privacyFor } from "@/features/legal/product-legal";
import { PRIVACY_SUMMARY } from "@/features/legal/privacy";
import { bySlug } from "@/features/products/catalog";
import { ProductFooter, ProductHeader } from "@/features/products/product-landing";

import "@/features/landing/landing.css";

const product = bySlug("google-business");

export const metadata: Metadata = {
  alternates: { canonical: `/${product.slug}/privacy` },
  title: { absolute: `Privacy Policy · ${product.name}` },
  description: `Privacy Policy for ${product.name} by TreeVook LLP.`,
};

export default function Page() {
  return (
    <LegalPage
      title={`${product.name} Privacy Policy`}
      summary={PRIVACY_SUMMARY}
      sections={privacyFor(product)}
      header={<ProductHeader product={product} />}
      footer={<ProductFooter product={product} />}
    />
  );
}
