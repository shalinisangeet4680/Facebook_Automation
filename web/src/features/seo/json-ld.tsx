import type { ProductPage } from "@/features/products/catalog";
import { BRAND, SITE_URL, SOCIAL } from "@/lib/config";

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const organization = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: BRAND.name,
  legalName: "TreeVook LLP",
  url: SITE_URL,
  logo: `${SITE_URL}/apple-icon.png`,
  email: "support@treevook.com",
  sameAs: SOCIAL.map((s) => s.url),
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@treevook.com",
    areaServed: "IN",
    availableLanguage: ["en", "hi"],
  },
};

export const SITE_LD = {
  "@context": "https://schema.org",
  "@graph": [
    organization,
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: BRAND.name,
      url: SITE_URL,
      description: BRAND.description,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-IN",
    },
  ],
};

export function productLd(product: ProductPage) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: product.name,
    url: `${SITE_URL}/${product.slug}`,
    description: product.sub,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function faqLd(product: ProductPage) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: product.faqs.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}
