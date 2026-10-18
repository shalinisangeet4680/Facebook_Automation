import Link from "next/link";

import { SOCIAL } from "@/lib/config";

import { Mark } from "./scenes";

const PRODUCTS = [
  ["google-business", "Google Business"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["play-reviews", "Play Reviews"],
  ["meta-ads", "Meta Ads"],
] as const;

export const CONTACT_EMAIL = "support@treevook.com";

export function SiteHeader() {
  return (
    <header className="tv-nav">
      <div className="tv-wrap tv-navIn">
        <Link href="/" className="tv-brand" aria-label="TreeVook AI home">
          <span className="tv-mark">
            <Mark />
          </span>
          <span>
            TreeVook <span>AI</span>
          </span>
        </Link>
        <nav className="tv-links" aria-label="Products">
          {PRODUCTS.map(([id, label]) => (
            <Link key={id} href={`/#${id}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="tv-navCta">
          <Link href="/login" className="tv-btnGhost">
            Sign in
          </Link>
          <Link href="/login" className="tv-btn">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="tv-wrap tv-footer">
      <span className="tv-brand" style={{ fontSize: 14 }}>
        <span className="tv-mark" style={{ width: 24, height: 24, borderRadius: 7 }}>
          <Mark size={14} />
        </span>
        <span className="tv-footNote">© 2026 TreeVook LLP · Made in India</span>
      </span>
      <nav aria-label="Footer">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/refund-policy">Refunds</Link>
        <Link href="/data-deletion">Data deletion</Link>
        <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
        {SOCIAL.map((s) => (
          <a key={s.name} href={s.url} target="_blank" rel="me noopener noreferrer">
            {s.name}
          </a>
        ))}
      </nav>
    </footer>
  );
}
