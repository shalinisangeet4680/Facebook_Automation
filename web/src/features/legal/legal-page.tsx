import type { ReactNode } from "react";

import { landingSerif } from "@/features/landing/font";
import { SiteFooter, SiteHeader } from "@/features/landing/site-chrome";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

export const LEGAL = {
  company: "TreeVook LLP",
  updated: "17 October 2026",
  email: "treevookllp@gmail.com",
  address: "[Registered office address of TreeVook LLP]",
  grievanceOfficer: "[Name of Grievance Officer]",
  courts: "[City], India",
};

export function LegalPage({
  title,
  summary,
  sections,
}: {
  title: string;
  summary: string[];
  sections: LegalSection[];
}) {
  return (
    <div className={`tv-page ${landingSerif.variable}`}>
      <SiteHeader />
      <main className="tv-wrap tv-legal">
        <header className="tv-legalHead">
          <span className="tv-eyebrow">Last updated {LEGAL.updated}</span>
          <h1 className="tv-h2">{title}</h1>
        </header>
        <aside className="tv-card tv-legalSummary" aria-label="In plain words">
          <strong>In plain words</strong>
          <ul>
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </aside>
        <div className="tv-legalGrid">
          <nav className="tv-legalToc" aria-label="Contents">
            <span className="tv-tiny">Contents</span>
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="tv-legalBody">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
                <h2 id={`${s.id}-h`}>
                  <span className="tv-mono">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                {s.body}
              </section>
            ))}
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
