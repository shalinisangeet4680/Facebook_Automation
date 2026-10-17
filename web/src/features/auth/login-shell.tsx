"use client";

import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Mark } from "@/features/landing/scenes";
import { CATALOG, type ProductPage } from "@/features/products/catalog";
import { productForPath } from "@/lib/products";

function useProduct(): ProductPage | null {
  const params = useSearchParams();
  const byParam = params.get("product");
  const next = params.get("next");
  const id = byParam ?? (next?.startsWith("/") ? productForPath(next)?.id : null);
  return CATALOG.find((p) => p.id === id || p.slug === id) ?? null;
}

function Brand({ product }: { product: ProductPage | null }) {
  return (
    <span className="tv-brand">
      <span className="tv-mark" style={product ? { background: product.color } : undefined}>
        <Mark />
      </span>
      {product ? (
        <span className="tv-pbrand">
          {product.name}
          <span>by TreeVook AI</span>
        </span>
      ) : (
        <span>
          TreeVook <span>AI</span>
        </span>
      )}
    </span>
  );
}

function AllProducts() {
  return (
    <ul className="tv-loginProducts">
      {CATALOG.map((p) => {
        const Icon = p.features[0]!.icon;
        return (
          <li key={p.id}>
            <span className="tv-featureIcon" style={{ background: p.soft, color: p.color }}>
              <Icon size={17} />
            </span>
            <span className="tv-featureText">
              <strong>
                {p.name}
                {p.soon ? <span className="tv-soon">Soon</span> : null}
              </strong>
              <span>
                {p.features[0]!.title}, {p.features[1]!.title.toLowerCase()}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function LoginShell({ children }: { children: ReactNode }) {
  const product = useProduct();
  const back = product ? `/${product.slug}` : "/";
  return (
    <div className="tv-login">
      <aside className="tv-loginArt" style={product ? { background: product.soft } : undefined}>
        <Link href={back} aria-label="Back to the website">
          <Brand product={product} />
        </Link>
        <div className="tv-loginCopy">
          <h1 className="tv-h2">
            {product ? (
              <>
                Welcome to <em>{product.name}.</em>
              </>
            ) : (
              <>
                Every business automation, <em>one dashboard.</em>
              </>
            )}
          </h1>
          <p className="tv-sub">
            {product
              ? product.sub
              : "Reviews, posts and ads on Google and Meta, handled by AI. You approve what matters."}
          </p>
        </div>
        <div className="tv-loginVisual">{product ? product.scene : <AllProducts />}</div>
        <div className="tv-loginTrust">
          <span>
            <ShieldCheck size={14} /> You approve what goes live
          </span>
          <span>
            <Lock size={14} /> Sign-ins are encrypted
          </span>
        </div>
      </aside>
      <main className="tv-loginMain">
        <div className="tv-loginTop">
          <span className="tv-loginMobileBrand">
            <Brand product={product} />
          </span>
          <Link href={back} className="tv-btnGhost">
            <ArrowLeft size={15} /> Back to site
          </Link>
        </div>
        <div className="tv-loginCard tv-card">{children}</div>
        <p className="tv-loginLegal">
          By continuing you agree to the{" "}
          <Link href={product ? `/${product.slug}/terms` : "/terms"}>Terms of Service</Link> and{" "}
          <Link href={product ? `/${product.slug}/privacy` : "/privacy"}>Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}
