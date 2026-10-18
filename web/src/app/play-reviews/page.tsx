import type { Metadata } from "next";

import { bySlug } from "@/features/products/catalog";
import { ProductLanding } from "@/features/products/product-landing";
import { JsonLd, productLd } from "@/features/seo/json-ld";

import "@/features/landing/landing.css";

const product = bySlug("play-reviews");

export const metadata: Metadata = {
  title: { absolute: `${product.name} · TreeVook AI` },
  description: product.sub,
  alternates: { canonical: `/${product.slug}` },
};

export default function Page() {
  return (
    <>
      <JsonLd data={productLd(product)} />
      <ProductLanding product={product} />
    </>
  );
}
