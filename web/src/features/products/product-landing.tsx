import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { SOCIAL } from "@/lib/config";

import { landingSerif } from "@/features/landing/font";
import { ApproveArt, GuardArt, LockArt, Mark } from "@/features/landing/scenes";
import { CONTACT_EMAIL } from "@/features/landing/site-chrome";

import type { ProductPage } from "./catalog";

const rootHref = () => process.env.ROOT_URL ?? "/";

export function ProductHeader({ product }: { product: ProductPage }) {
  const start = product.soon
    ? `/login?product=${product.id}`
    : `/login?next=${encodeURIComponent(product.appHref)}`;
  return (
    <header className="tv-nav">
      <div className="tv-wrap tv-navIn">
        <Link
          href={`/${product.slug}`}
          className="tv-brand"
          aria-label={`${product.name} by TreeVook AI`}
        >
          <span className="tv-mark" style={{ background: product.color }}>
            <Mark />
          </span>
          <span className="tv-pbrand">
            {product.name}
            <span>by TreeVook AI</span>
          </span>
        </Link>
        <nav className="tv-links" aria-label={product.name}>
          <a href={`/${product.slug}#features`}>Features</a>
          <a href={`/${product.slug}#how`}>How it works</a>
          <a href={`/${product.slug}#faq`}>FAQ</a>
        </nav>
        <div className="tv-navCta">
          <Link href={start} className="tv-btnGhost">
            Sign in
          </Link>
          <Link href={start} className="tv-btn">
            {product.soon ? "Join early access" : "Get started"}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function ProductFooter({ product }: { product: ProductPage }) {
  return (
    <footer className="tv-wrap tv-footer">
      <span className="tv-brand" style={{ fontSize: 14 }}>
        <span
          className="tv-mark"
          style={{ width: 24, height: 24, borderRadius: 7, background: product.color }}
        >
          <Mark size={14} />
        </span>
        <span className="tv-footNote">
          © 2026 TreeVook LLP · {product.name} is part of <a href={rootHref()}>TreeVook AI</a>
        </span>
      </span>
      <nav aria-label="Footer">
        <Link href={`/${product.slug}/privacy`}>Privacy</Link>
        <Link href={`/${product.slug}/terms`}>Terms</Link>
        <Link href={`/${product.slug}/refund-policy`}>Refunds</Link>
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

export function ProductLanding({ product }: { product: ProductPage }) {
  const start = product.soon
    ? `/login?product=${product.id}`
    : `/login?next=${encodeURIComponent(product.appHref)}`;
  const cta = product.soon ? "Join early access" : "Get started free";
  return (
    <div className={`tv-page ${landingSerif.variable}`}>
      <ProductHeader product={product} />
      <main>
        <section className="tv-wrap tv-phero">
          <div>
            <span className="tv-eyebrow">
              <span className="tv-eyebrowDot" style={{ background: product.color }} />
              {product.name}
              {product.soon ? <span className="tv-soon">Coming soon</span> : null}
            </span>
            <h1 className="tv-h1 tv-pTitle">{product.title}</h1>
            <p className="tv-lead tv-pLead">{product.sub}</p>
            <div className="tv-heroCta" style={{ justifyContent: "flex-start" }}>
              <Link href={start} className="tv-btn tv-btnLg">
                {cta} <ArrowRight size={16} />
              </Link>
              <a href="#features" className="tv-btnGhost tv-btnLg">
                See features
              </a>
            </div>
            <p className="tv-works" style={{ textAlign: "left" }}>
              {product.worksWith} · {product.soon ? "Early access" : "Free during early access"}
            </p>
          </div>
          {product.scene}
        </section>

        <section id="features" className="tv-section" aria-labelledby="features-title">
          <div className="tv-wrap">
            <h2 id="features-title" className="tv-h2" style={{ textAlign: "center" }}>
              Everything it <em>does for you.</em>
            </h2>
            <p className="tv-sub" style={{ margin: "14px auto 0", textAlign: "center" }}>
              {product.audience}
            </p>
            <div className="tv-fgrid">
              {product.features.map((f) => (
                <div key={f.title} className="tv-card tv-fcard">
                  <span
                    className="tv-featureIcon"
                    style={{ background: product.soft, color: product.color }}
                  >
                    <f.icon size={18} />
                  </span>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="tv-section tv-center" aria-labelledby="how-title">
          <div className="tv-wrap">
            <h2 id="how-title" className="tv-h2">
              Live in <em>three steps.</em>
            </h2>
            <div className="tv-steps">
              {product.steps.map(([title, text, Icon], i) => (
                <div key={title} className="tv-card tv-stepCard">
                  <span className="tv-row">
                    <span className="tv-stepNum">0{i + 1}</span>
                    <Icon size={18} color="#6C6962" aria-hidden />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="tv-section tv-center" aria-labelledby="control-title">
          <div className="tv-wrap">
            <h2 id="control-title" className="tv-h2">
              You stay <em>in control.</em>
            </h2>
            <div className="tv-trio">
              {[
                {
                  art: <ApproveArt />,
                  title: "Approve first",
                  text: "Everything starts on approval. Turn on auto when you trust it.",
                },
                {
                  art: <GuardArt />,
                  title: "Safeguards",
                  text: "Quiet hours, daily limits and blocked words.",
                },
                {
                  art: <LockArt />,
                  title: "Private by default",
                  text: "Sign-ins are encrypted. Disconnect any time.",
                },
              ].map((t) => (
                <div key={t.title} className="tv-card tv-tile">
                  <div className="tv-tileArt" aria-hidden>
                    {t.art}
                  </div>
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="tv-section" aria-labelledby="faq-title">
          <div className="tv-wrap tv-faqWrap">
            <h2 id="faq-title" className="tv-h2">
              Questions, <em>answered.</em>
            </h2>
            <div className="tv-faq">
              {product.faqs.map(([q, a]) => (
                <details key={q} className="tv-card">
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="tv-sectionTight">
          <div className="tv-wrap">
            <div className="tv-final" style={{ background: product.band ?? product.color }}>
              <h2 className="tv-h2">Spend minutes, not hours.</h2>
              <p className="tv-sub">
                {product.soon ? "Join early access today." : "Free while in early access."}
              </p>
              <div className="tv-heroCta">
                <Link href={start} className="tv-btnLight tv-btnLg">
                  {cta} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <ProductFooter product={product} />
    </div>
  );
}
