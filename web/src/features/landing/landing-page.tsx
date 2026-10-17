import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarClock,
  Clock3,
  Gauge,
  Languages,
  type LucideIcon,
  Megaphone,
  MessageSquareReply,
  PauseCircle,
  PlugZap,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  Target,
  ThumbsUp,
} from "lucide-react";
import { Instrument_Serif } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  ApproveArt,
  BusinessScene,
  ClaudeScene,
  GuardArt,
  HeroStage,
  LockArt,
  Mark,
  MetaScene,
  PlayScene,
  ReleasesScene,
} from "./scenes";

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
});

interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

function Product({
  id,
  color,
  soft,
  name,
  title,
  sub,
  features,
  scene,
  flip,
  href,
}: {
  id: string;
  color: string;
  soft: string;
  name: string;
  title: ReactNode;
  sub: string;
  features: Feature[];
  scene: ReactNode;
  flip?: boolean;
  href: string;
}) {
  return (
    <section id={id} className={"tv-section"} aria-labelledby={`${id}-title`}>
      <div className={`tv-wrap tv-product ${flip ? "tv-flip" : ""}`}>
        <div>
          <span className={"tv-eyebrow"}>
            <span className={"tv-eyebrowDot"} style={{ background: color }} />
            {name}
          </span>
          <h2 id={`${id}-title`} className={"tv-h2"}>
            {title}
          </h2>
          <p className={"tv-sub"}>{sub}</p>
          <ul className={"tv-features"}>
            {features.map((f) => (
              <li key={f.title} className={"tv-feature"}>
                <span className={"tv-featureIcon"} style={{ background: soft, color }}>
                  <f.icon size={18} />
                </span>
                <span className={"tv-featureText"}>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link href={href} className={"tv-more"}>
            Try {name} <ArrowRight size={14} />
          </Link>
        </div>
        {scene}
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className={`tv-page ${serif.variable}`}>
      <header className={"tv-nav"}>
        <div className={`tv-wrap tv-navIn`}>
          <Link href="/" className={"tv-brand"} aria-label="TreeVook AI home">
            <span className={"tv-mark"}>
              <Mark />
            </span>
            <span>
              TreeVook <span>AI</span>
            </span>
          </Link>
          <nav className={"tv-links"} aria-label="Products">
            <a href="#google-business">Google Business</a>
            <a href="#play-reviews">Play Reviews</a>
            <a href="#meta-ads">Meta Ads</a>
            <a href="#claude">Claude</a>
          </nav>
          <div className={"tv-navCta"}>
            <Link href="/login" className={"tv-btnGhost"}>
              Sign in
            </Link>
            <Link href="/login" className={"tv-btn"}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={`tv-hero tv-wrap`}>
          <span className={"tv-pill"}>
            <span className={"tv-pillDot"}>
              <Sparkles size={11} />
            </span>
            Free during early access
          </span>
          <h1 className={"tv-h1"}>
            Reviews, posts and ads, <em>handled.</em>
          </h1>
          <p className={"tv-lead"}>
            AI does the daily work for your business on Google and Meta. You approve what matters.
          </p>
          <div className={"tv-heroCta"}>
            <Link href="/login" className={`tv-btn tv-btnLg`}>
              Get started free <ArrowRight size={16} />
            </Link>
            <a href="#how" className={`tv-btnGhost tv-btnLg`}>
              How it works
            </a>
          </div>
          <p className={"tv-works"}>
            Works with Google Business Profile · Google Play · Facebook & Instagram
          </p>
          <HeroStage />
        </section>

        <Product
          id="google-business"
          color="#0F6B4A"
          soft="#EAF3EE"
          name="Google Business"
          href="/business"
          title={
            <>
              Every Google review answered. <em>Your profile always fresh.</em>
            </>
          }
          sub="For clinics, shops, salons and restaurants on Google Maps."
          features={[
            {
              icon: MessageSquareReply,
              title: "Review replies",
              text: "AI drafts in your voice; you approve",
            },
            {
              icon: CalendarClock,
              title: "Posts & offers",
              text: "Schedule updates, offers and events",
            },
            { icon: BarChart3, title: "Insights", text: "Calls, directions and profile views" },
            {
              icon: Store,
              title: "Business info",
              text: "Hours, phone and website for every location",
            },
          ]}
          scene={<BusinessScene />}
        />

        <Product
          id="play-reviews"
          flip
          color="#E8590C"
          soft="#FDF1E9"
          name="Play Reviews"
          href="/reviews"
          title={
            <>
              Reply to app reviews <em>in every language.</em>
            </>
          }
          sub="For Android developers on Google Play."
          features={[
            { icon: SlidersHorizontal, title: "Rules per star", text: "5★ auto, 1★ waits for you" },
            { icon: Languages, title: "Reviewer’s language", text: "Hindi review, Hindi reply" },
            { icon: Gauge, title: "Safety pause", text: "Stops auto-replies if ratings drop" },
            {
              icon: ThumbsUp,
              title: "Topics & trends",
              text: "See crashes and login complaints early",
            },
          ]}
          scene={<PlayScene />}
        />

        <Product
          id="meta-ads"
          color="#1C64B8"
          soft="#ECF2FB"
          name="Meta Ads"
          href="/setup"
          title={
            <>
              Facebook & Instagram ads, <em>planned with reasons.</em>
            </>
          }
          sub="For businesses that want leads without an agency."
          features={[
            { icon: Target, title: "Campaign plans", text: "Audience, budget and why, explained" },
            { icon: ShieldCheck, title: "You launch it", text: "Nothing spends until you approve" },
            { icon: PauseCircle, title: "Daily check-up", text: "Pauses ads that waste money" },
            {
              icon: Megaphone,
              title: "Page & Instagram",
              text: "Bio, logo and cover set up for you",
            },
          ]}
          scene={<MetaScene />}
        />

        <section id="claude" className={"tv-sectionTight"}>
          <div className={"tv-wrap"}>
            <div className={`tv-dark tv-product`}>
              <div>
                <span className={"tv-eyebrow"}>
                  <Bot size={14} /> Works with Claude
                </span>
                <h2 className={"tv-h2"}>
                  Run your business <em>from a chat.</em>
                </h2>
                <p className={"tv-sub"}>
                  Connect TreeVook to Claude. Anything public asks you first.
                </p>
              </div>
              <ClaudeScene />
            </div>
          </div>
        </section>

        <section className={"tv-section"}>
          <div className={`tv-wrap tv-product tv-flip`}>
            <div>
              <span className={"tv-eyebrow"}>
                <span className={"tv-eyebrowDot"} style={{ background: "#6D4AD8" }} />
                Coming soon · Play Releases
              </span>
              <h2 className={"tv-h2"}>
                Rollouts that <em>stop themselves.</em>
              </h2>
              <p className={"tv-sub"}>
                A bad update pauses at 20% instead of reaching everyone, and AI points to the line
                that broke.
              </p>
            </div>
            <ReleasesScene />
          </div>
        </section>

        <section className={`tv-section tv-center`} aria-labelledby="control-title">
          <div className={"tv-wrap"}>
            <h2 id="control-title" className={"tv-h2"}>
              You stay <em>in control.</em>
            </h2>
            <div className={"tv-trio"}>
              {[
                {
                  art: <ApproveArt />,
                  title: "Approve first",
                  text: "Every rating starts on approval. Turn on auto when you trust it.",
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
                <div key={t.title} className={`tv-card tv-tile`}>
                  <div className={"tv-tileArt"} aria-hidden>
                    {t.art}
                  </div>
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className={`tv-section tv-center`} aria-labelledby="how-title">
          <div className={"tv-wrap"}>
            <h2 id="how-title" className={"tv-h2"}>
              Live in <em>three steps.</em>
            </h2>
            <div className={"tv-steps"}>
              {[
                {
                  n: "01",
                  icon: PlugZap,
                  title: "Connect",
                  text: "Sign in with Google, Play or Meta.",
                },
                {
                  n: "02",
                  icon: SlidersHorizontal,
                  title: "Set rules",
                  text: "Choose what’s automatic and what waits.",
                },
                {
                  n: "03",
                  icon: Clock3,
                  title: "Relax",
                  text: "Approve drafts in seconds, when you want.",
                },
              ].map((step) => (
                <div key={step.n} className={`tv-card tv-stepCard`}>
                  <span className={"tv-row"}>
                    <span className={"tv-stepNum"}>{step.n}</span>
                    <step.icon size={18} color="#6C6962" aria-hidden />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              ))}
            </div>
            <div className={"tv-for"}>
              {[
                "Clinics",
                "Dental",
                "Salons",
                "Restaurants",
                "Coaching",
                "Retail",
                "Agencies",
                "App developers",
              ].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </div>
        </section>

        <section className={"tv-sectionTight"}>
          <div className={"tv-wrap"}>
            <div className={"tv-final"}>
              <h2 className={"tv-h2"}>Spend minutes, not hours, on your online presence.</h2>
              <p className={"tv-sub"}>Free while in early access.</p>
              <div className={"tv-heroCta"}>
                <Link href="/login" className={`tv-btnLight tv-btnLg`}>
                  Get started free <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={`tv-wrap tv-footer`}>
        <span className={"tv-brand"} style={{ fontSize: 14 }}>
          <span className={"tv-mark"} style={{ width: 24, height: 24, borderRadius: 7 }}>
            <Mark size={14} />
          </span>
          © 2026 TreeVook LLP · Made in India
        </span>
        <nav aria-label="Footer">
          <a href="#google-business">Google Business</a>
          <a href="#play-reviews">Play Reviews</a>
          <a href="#meta-ads">Meta Ads</a>
          <a href="mailto:treevookllp@gmail.com">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
