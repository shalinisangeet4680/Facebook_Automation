import type { Metadata } from "next";

import { bySlug } from "@/features/products/catalog";
import { ProductLanding } from "@/features/products/product-landing";
import { JsonLd, faqLd, productLd } from "@/features/seo/json-ld";
import { pageMeta } from "@/features/seo/meta";

import "@/features/landing/landing.css";

const product = bySlug("facebook-autopost");

export const metadata: Metadata = pageMeta("facebook-autopost", `/${product.slug}`);

export default function Page() {
  return (
    <>
      <JsonLd data={[productLd(product), faqLd(product)]} />
      <ProductLanding product={product} />
    </>
  );
}
