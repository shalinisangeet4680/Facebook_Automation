import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Clock3,
  Gauge,
  GalleryHorizontalEnd,
  Languages,
  Layers,
  type LucideIcon,
  Megaphone,
  MessageCircleReply,
  MessageSquareReply,
  PauseCircle,
  PlugZap,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  Target,
  ThumbsUp,
  Palette,
  BellRing,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  BusinessScene,
  FacebookScene,
  InstagramScene,
  MetaScene,
  PlayScene,
} from "@/features/landing/scenes";
import type { ProductId } from "@/lib/products";

export interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface ProductPage {
  id: ProductId;
  slug: string;
  name: string;
  color: string;
  soft: string;
  band?: string;
  title: ReactNode;
  sub: string;
  audience: string;
  worksWith: string;
  scene: ReactNode;
  appHref: string;
  soon?: boolean;
  features: Feature[];
  steps: [string, string, LucideIcon][];
  faqs: [string, string][];
  collects: string[];
  platform: "google-business" | "google-play" | "meta";
}

export const CATALOG: ProductPage[] = [
  {
    id: "business",
    slug: "google-business",
    name: "Google Business",
    color: "#0F6B4A",
    soft: "#EAF3EE",
    title: (
      <>
        Every Google review answered. <em>Your profile always fresh.</em>
      </>
    ),
    sub: "AI replies to reviews, posts offers and keeps your Google profile up to date. You approve what matters.",
    audience: "For clinics, salons, restaurants, shops and every business on Google Maps.",
    worksWith: "Works with Google Business Profile",
    scene: <BusinessScene />,
    appHref: "/business",
    features: [
      {
        icon: MessageSquareReply,
        title: "Review replies",
        text: "AI drafts in your voice for every review",
      },
      { icon: SlidersHorizontal, title: "Rules per star", text: "5★ auto-reply, 1★ waits for you" },
      {
        icon: CalendarClock,
        title: "Posts & offers",
        text: "Updates, offers and events, on schedule",
      },
      { icon: BarChart3, title: "Insights", text: "Calls, directions and profile views" },
      { icon: Store, title: "Business info", text: "Hours, phone and website in one place" },
      { icon: Layers, title: "Every location", text: "All your branches in one dashboard" },
    ],
    steps: [
      ["Sign in with Google", "Use the account that manages your business.", PlugZap],
      ["Set your rules", "Pick auto, approval or manual for each star rating.", SlidersHorizontal],
      ["Approve and relax", "Replies and posts go live on Google.", Clock3],
    ],
    faqs: [
      [
        "Will it reply without asking me?",
        "Only for ratings you set to Auto. Everything starts on Approval.",
      ],
      [
        "Do I need a verified profile?",
        "Yes. Google only shows replies and posts for verified profiles.",
      ],
      [
        "Can I manage several locations?",
        "Yes, every location your Google account manages shows up.",
      ],
      ["Does it reply in Hindi?", "Replies are written in the reviewer’s language."],
    ],
    collects: [
      "Your Google account email, business accounts and locations",
      "Business information: name, address, phone, website, hours, categories, description",
      "Reviews (including reviewers’ public names and photos), replies and posts",
      "Profile performance: views, calls, website clicks, direction requests, messages, bookings",
    ],
    platform: "google-business",
  },
  {
    id: "play-reviews",
    slug: "play-reviews",
    name: "Play Reviews",
    color: "#E8590C",
    soft: "#FDF1E9",
    band: "#B8460A",
    title: (
      <>
        Reply to app reviews <em>in every language.</em>
      </>
    ),
    sub: "AI answers your Google Play reviews in the reviewer’s language, with rules you control.",
    audience: "For Android developers and app studios on Google Play.",
    worksWith: "Works with Google Play Console",
    scene: <PlayScene />,
    appHref: "/reviews",
    features: [
      { icon: SlidersHorizontal, title: "Rules per star", text: "5★ auto, 1★ waits for you" },
      { icon: Languages, title: "Reviewer’s language", text: "Hindi review, Hindi reply" },
      { icon: Gauge, title: "Safety pause", text: "Stops auto-replies if ratings drop" },
      { icon: ThumbsUp, title: "Topics & trends", text: "Spot crash and login complaints early" },
      { icon: BellRing, title: "Slack alerts", text: "1★ reviews reach your team instantly" },
      { icon: ShieldCheck, title: "Safe rollouts", text: "Halts a release when crashes spike" },
    ],
    steps: [
      ["Connect Play Console", "Add a service account with reply permission.", PlugZap],
      ["Set your rules", "Choose templates and modes per star rating.", SlidersHorizontal],
      ["Approve and relax", "Replies go live on Google Play.", Clock3],
    ],
    faqs: [
      [
        "What access does it need?",
        "A Google Cloud service account invited to Play Console with “Reply to reviews”.",
      ],
      ["Can it import old reviews?", "Yes, from your Play Console reports bucket."],
      ["What if ratings suddenly drop?", "The safety pause holds auto-replies until you check."],
      [
        "Can it manage releases too?",
        "Yes. Staged rollouts, AI release notes in every language, crash clusters explained, and an automatic halt when crash or ANR rates spike.",
      ],
      [
        "Does it work with Claude?",
        "Yes. Connect TreeVook to Claude and ask it to reply to this week’s reviews.",
      ],
    ],
    collects: [
      "The service account key you upload",
      "Your apps and their store listing details",
      "Reviews and replies, and report files from your Play Console reports bucket",
      "Release tracks, release notes and Android vitals (crash and ANR rates, crash reports)",
    ],
    platform: "google-play",
  },
  {
    id: "instagram",
    slug: "instagram-autopost",
    name: "Instagram Autopost",
    color: "#C2185B",
    soft: "#FBEFF6",
    title: (
      <>
        A week of Instagram posts, <em>ready on Monday.</em>
      </>
    ),
    sub: "AI plans, writes and designs your posts, then publishes at the best time. You approve, or let it post.",
    audience: "For businesses that want a steady Instagram without a social media manager.",
    worksWith: "Works with Instagram professional accounts",
    scene: <InstagramScene />,
    appHref: "/login",
    soon: true,
    features: [
      {
        icon: CalendarDays,
        title: "AI content calendar",
        text: "Offers, tips and festivals planned",
      },
      {
        icon: GalleryHorizontalEnd,
        title: "Every format",
        text: "Posts, carousels, Reels and Stories",
      },
      { icon: Palette, title: "Your brand", text: "Your colours, logo and voice" },
      {
        icon: SlidersHorizontal,
        title: "Auto or approval",
        text: "You decide what posts on its own",
      },
      { icon: Clock3, title: "Best time", text: "Learned from your own audience" },
      {
        icon: MessageCircleReply,
        title: "Comment replies",
        text: "Questions answered, complaints held",
      },
    ],
    steps: [
      ["Connect Instagram", "Sign in with your professional account.", PlugZap],
      ["Set your brand", "Voice, colours, offers and topics.", Palette],
      ["Approve the week", "Posts go out at the best times.", Clock3],
    ],
    faqs: [
      [
        "Do I need a business account?",
        "Yes, an Instagram professional (business or creator) account.",
      ],
      ["Can I edit posts first?", "Yes. Every post can wait for your approval."],
      ["Where do images come from?", "AI designs them with your brand, or uses your photos."],
      ["When can I start?", "Instagram Autopost is in early access. Sign up to join."],
    ],
    collects: [
      "Your Instagram professional account and linked Facebook Page",
      "Posts, captions, media and comments on your posts",
      "Post and account insights: reach, impressions, engagement, followers",
    ],
    platform: "meta",
  },
  {
    id: "facebook",
    slug: "facebook-autopost",
    name: "Facebook Autopost",
    color: "#2D5BD7",
    soft: "#EEF2FD",
    title: (
      <>
        Your Page posts and replies, <em>on autopilot.</em>
      </>
    ),
    sub: "Regular posts in your voice, and quick answers to every comment on your Facebook Page.",
    audience: "For local businesses that want an active Facebook Page.",
    worksWith: "Works with Facebook Pages",
    scene: <FacebookScene />,
    appHref: "/login",
    soon: true,
    features: [
      {
        icon: Megaphone,
        title: "Posts on schedule",
        text: "Offers, events and updates, written for you",
      },
      {
        icon: MessageCircleReply,
        title: "Comment replies",
        text: "Questions answered; complaints wait for you",
      },
      { icon: Clock3, title: "Best time to post", text: "Learned from your own audience" },
      { icon: BarChart3, title: "Page insights", text: "Reach, reactions and shares" },
      { icon: Palette, title: "Your brand", text: "Your colours, logo and voice" },
      {
        icon: SlidersHorizontal,
        title: "Auto or approval",
        text: "You decide what posts on its own",
      },
    ],
    steps: [
      ["Connect Facebook", "Choose the Pages to manage.", PlugZap],
      ["Set your brand", "Voice, offers and topics.", Palette],
      ["Approve and relax", "Posts and replies go out for you.", Clock3],
    ],
    faqs: [
      ["Which Pages can I connect?", "Any Facebook Page you manage."],
      [
        "Will it reply to every comment?",
        "Only to comment types you allow; complaints wait for you.",
      ],
      [
        "Can I post links and videos?",
        "Yes: images, multiple photos, videos, text and link posts.",
      ],
      ["When can I start?", "Facebook Autopost is in early access. Sign up to join."],
    ],
    collects: [
      "The Facebook Pages you choose to connect",
      "Posts, media and comments on your Pages",
      "Page and post insights: reach, reactions, shares",
    ],
    platform: "meta",
  },
  {
    id: "meta",
    slug: "meta-ads",
    name: "Meta Ads",
    color: "#1C64B8",
    soft: "#ECF2FB",
    title: (
      <>
        Facebook & Instagram ads, <em>planned with reasons.</em>
      </>
    ),
    sub: "AI plans campaigns, explains every setting, and checks your ads every morning. Nothing spends until you approve.",
    audience: "For businesses that want leads without an agency.",
    worksWith: "Works with Meta Business and Ads Manager",
    scene: <MetaScene />,
    appHref: "/setup",
    features: [
      { icon: Target, title: "Campaign plans", text: "Audience, budget and why, explained" },
      { icon: ShieldCheck, title: "You launch it", text: "Nothing spends until you approve" },
      { icon: PauseCircle, title: "Daily check-up", text: "Pauses ads that waste money" },
      { icon: Sparkles, title: "Ad creatives", text: "Images designed for each format" },
      { icon: Megaphone, title: "Page & Instagram", text: "Bio, logo and cover set up for you" },
      {
        icon: BarChart3,
        title: "Plain-language reports",
        text: "What worked and what to try next",
      },
    ],
    steps: [
      ["Connect Meta", "Link your business and ad account.", PlugZap],
      ["Review the plan", "Every setting comes with a reason.", Target],
      ["Approve to launch", "Daily check-ups keep spend in line.", Clock3],
    ],
    faqs: [
      ["Who pays for the ads?", "Meta bills ad spend to your ad account’s payment method."],
      [
        "Can it spend without asking?",
        "No. Launches and budget changes always need your approval.",
      ],
      ["Does it follow ad policies?", "Plans avoid restricted claims, and you review everything."],
      ["Does it work with Claude?", "Yes. Plan and review campaigns from a chat."],
    ],
    collects: [
      "Your Meta business, ad account, Facebook Page, Instagram account and dataset",
      "Campaigns, ad sets, ads and their performance",
      "Images you upload or ask Claude to design",
    ],
    platform: "meta",
  },
];

export const bySlug = (slug: string) => CATALOG.find((p) => p.slug === slug)!;
