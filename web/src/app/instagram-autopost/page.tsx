import type { Metadata } from "next";

import { bySlug } from "@/features/products/catalog";
import { ProductLanding } from "@/features/products/product-landing";

import "@/features/landing/landing.css";

const product = bySlug("instagram-autopost");

export const metadata: Metadata = {
  title: { absolute: `${product.name} · TreeVook AI` },
  description: product.sub,
};

export default function Page() {
  return <ProductLanding product={product} />;
}
