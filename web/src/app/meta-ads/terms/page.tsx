import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/legal-page";
import { termsFor } from "@/features/legal/product-legal";
import { TERMS_SUMMARY } from "@/features/legal/terms";
import { bySlug } from "@/features/products/catalog";
import { ProductFooter, ProductHeader } from "@/features/products/product-landing";

import "@/features/landing/landing.css";

const product = bySlug("meta-ads");

export const metadata: Metadata = {
  title: { absolute: `Terms of Service · ${product.name}` },
  description: `Terms of Service for ${product.name} by TreeVook LLP.`,
};

export default function Page() {
  return (
    <LegalPage
      title={`${product.name} Terms of Service`}
      summary={TERMS_SUMMARY}
      sections={termsFor(product)}
      header={<ProductHeader product={product} />}
      footer={<ProductFooter product={product} />}
    />
  );
}
