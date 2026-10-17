import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  GalleryHorizontalEnd,
  MessageCircleReply,
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
import Link from "next/link";
import type { ReactNode } from "react";

import { landingSerif } from "./font";
import { SiteFooter, SiteHeader } from "./site-chrome";
import {
  ApproveArt,
  BusinessScene,
  ClaudeScene,
  FacebookScene,
  InstagramScene,
  GuardArt,
  HeroStage,
  LockArt,
  MetaScene,
  PlayScene,
  ReleasesScene,
} from "./scenes";

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
  soon,
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
  soon?: boolean;
}) {
  return (
    <section id={id} className={"tv-section"} aria-labelledby={`${id}-title`}>
      <div className={`tv-wrap tv-product ${flip ? "tv-flip" : ""}`}>
        <div>
          <span className={"tv-eyebrow"}>
            <span className={"tv-eyebrowDot"} style={{ background: color }} />
            {name}
            {soon ? <span className="tv-soon">Coming soon</span> : null}
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
            Explore {name} <ArrowRight size={14} />
          </Link>
        </div>
        {scene}
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className={`tv-page ${landingSerif.variable}`}>
      <SiteHeader />

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
          href="/google-business"
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
          id="instagram"
          flip
          soon
          color="#C2185B"
          soft="#FBEFF6"
          name="Instagram Autopost"
          href="/instagram-autopost"
          title={
            <>
              A week of Instagram posts, <em>ready on Monday.</em>
            </>
          }
          sub="AI plans, writes and designs your posts. You approve, or let it post."
          features={[
            {
              icon: CalendarDays,
              title: "AI content calendar",
              text: "Offers, tips and festivals planned",
            },
            {
              icon: GalleryHorizontalEnd,
              title: "Posts, carousels, Reels, Stories",
              text: "Captions, hashtags and visuals",
            },
            {
              icon: SlidersHorizontal,
              title: "Auto or approval",
              text: "The same rules you trust for reviews",
            },
            {
              icon: Clock3,
              title: "Best time & insights",
              text: "Reach, saves and follower growth",
            },
          ]}
          scene={<InstagramScene />}
        />

        <Product
          id="facebook"
          soon
          color="#2D5BD7"
          soft="#EEF2FD"
          name="Facebook Autopost"
          href="/facebook-autopost"
          title={
            <>
              Your Page posts and replies, <em>on autopilot.</em>
            </>
          }
          sub="Regular posts in your voice, and quick answers to every comment."
          features={[
            {
              icon: Megaphone,
              title: "Posts on schedule",
              text: "Offers, events and updates, written for you",
            },
            {
              icon: MessageCircleReply,
              title: "Comment replies",
              text: "AI answers questions; complaints wait for you",
            },
            { icon: Clock3, title: "Best time to post", text: "Learned from your own audience" },
            { icon: BarChart3, title: "Page insights", text: "Reach, reactions and shares" },
          ]}
          scene={<FacebookScene />}
        />

        <Product
          id="play-reviews"
          flip
          color="#E8590C"
          soft="#FDF1E9"
          name="Play Reviews"
          href="/play-reviews"
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
          href="/meta-ads"
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

      <SiteFooter />
    </div>
  );
}
