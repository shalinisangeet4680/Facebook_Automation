import { createHash } from "crypto";

import {
  metaRejected,
  metaTokenInvalid,
} from "@modules/meta/domain/meta.errors";

import {
  DiscoveredAccount,
  PublishInput,
  PublishResult,
  RemoteAccountDay,
  RemoteComment,
  RemotePost,
  RemotePostInsights,
  SocialApi,
  SocialCredentials,
  SocialGrant,
} from "../domain/ports/social-api";
import { LoginKind, PostFormat } from "../domain/social.types";
import { addDays, isoDay } from "../domain/time";

const DAY = 86_400_000;
const LONG_LIVED_MS = 60 * DAY;

const hash = (s: string) =>
  createHash("sha256").update(s).digest().readUInt32BE(0);

const FB_PAGES = [
  {
    id: "1301000000000001",
    name: "Sharma Dental Clinic",
    category: "Dental clinic",
    followers: 1840,
    instagram: {
      id: "17841400000000001",
      username: "sharmadental",
      name: "Sharma Dental Clinic",
      followers: 2310,
    },
  },
  {
    id: "1301000000000002",
    name: "Sharma Dental Kids",
    category: "Pediatric dentist",
    followers: 620,
    instagram: null,
  },
];

const IG_LOGIN_ACCOUNT = {
  id: "17841400000000009",
  username: "sharma.smiles",
  name: "Sharma Smiles Studio",
  followers: 980,
};

const HISTORY = [
  "Did you know? Brushing for two full minutes removes up to 26% more plaque. Set a timer tonight!",
  "Meet Dr. Anjali, our braces specialist. 12 years of straight smiles in Patna.",
  "Free dental check-up camp this Sunday at Fraser Road. Walk in between 10 and 2.",
  "Behind the scenes: how we sterilise every instrument before your visit.",
  "“The root canal was painless!” – thank you Priya for the lovely words.",
  "Kids' dental day: fun check-ups and a free toothbrush for every child.",
  "Sensitive teeth? Try a soft brush and lukewarm water, and see us if it lasts.",
  "Our Boring Road clinic now opens till 9 pm on weekdays.",
  "Happy Diwali from all of us at Sharma Dental! Go easy on the sweets.",
  "Invisible aligners are here. Book a free consultation this month.",
  "Floss first, then brush. Here is why the order matters.",
  "Saturday smiles from the team.",
];

const HISTORY_HOURS = [19, 11, 19, 14, 20, 10, 19, 13, 19, 9, 18, 16];

const COMMENTS: { author: string; text: string }[] = [
  { author: "Neha Gupta", text: "What are your timings on Sunday?" },
  { author: "Rahul Verma", text: "Amazing work, best clinic in Patna! 😍" },
  {
    author: "Amit Raj",
    text: "I waited 2 hours last time even with an appointment. Very bad service.",
  },
  {
    author: "growth.guru.99",
    text: "Get 10k free followers today!! Check my profile 🔥 bit.ly/grow-now",
  },
];

const WEBSITE = `Sharma Dental Clinic, Patna. Family dental care since 2009.
Painless root canals, braces and invisible aligners, implants, teeth whitening and kids' dentistry.
Two clinics: Fraser Road and Boring Road. Open Monday to Saturday, 9 am to 7 pm.
Book an appointment online or call +91 612 220 4455.
Offers: free check-up for children under 12, 10% off whitening this month.`;

const parsePostId = (id: string) => {
  const m = /^mock_(\d+)_(\d+)_(\d+)$/.exec(id);
  return m ? { account: m[1]!, at: Number(m[2]), seq: Number(m[3]) } : null;
};

export class MockSocialApi implements SocialApi {
  readonly published: {
    id: string;
    account: string;
    input: PublishInput;
  }[] = [];
  readonly comments_: { postId: string; text: string }[] = [];
  readonly replies: { commentId: string; text: string }[] = [];
  readonly hidden = new Map<string, boolean>();
  readonly reported = new Set<string>();
  private seq = 0;

  private check(token: string) {
    if (token.includes("revoked")) throw metaTokenInvalid("mock revoked");
  }

  authUrl(login: LoginKind, redirectUri: string, state: string): string {
    const url = new URL(redirectUri);
    url.searchParams.set("code", `mock-${login}`);
    url.searchParams.set("state", state);
    return url.toString();
  }

  exchangeCode(login: LoginKind, code: string): Promise<SocialGrant> {
    if (!code.startsWith("mock"))
      return Promise.reject(metaRejected("The sign-in code was rejected."));
    return Promise.resolve({
      token: `mock-${login}-user-${code.slice(5) || "token"}`,
      expiresAt: new Date(Date.now() + LONG_LIVED_MS),
      userId: login === "facebook" ? "1001000000000001" : IG_LOGIN_ACCOUNT.id,
      userName: login === "facebook" ? "Ravi Sharma" : IG_LOGIN_ACCOUNT.name,
    });
  }

  accounts(login: LoginKind, grant: SocialGrant): Promise<DiscoveredAccount[]> {
    this.check(grant.token);
    if (login === "instagram")
      return Promise.resolve([
        {
          platform: "instagram",
          externalId: IG_LOGIN_ACCOUNT.id,
          name: IG_LOGIN_ACCOUNT.name,
          username: IG_LOGIN_ACCOUNT.username,
          avatarUrl: null,
          category: "Dentist",
          pageId: null,
          token: grant.token,
          tokenExpiresAt: grant.expiresAt,
          followers: IG_LOGIN_ACCOUNT.followers,
        },
      ]);
    const out: DiscoveredAccount[] = [];
    for (const page of FB_PAGES) {
      const token = `mock-page-${page.id}`;
      out.push({
        platform: "facebook",
        externalId: page.id,
        name: page.name,
        username: null,
        avatarUrl: null,
        category: page.category,
        pageId: page.id,
        token,
        tokenExpiresAt: null,
        followers: page.followers,
      });
      if (page.instagram)
        out.push({
          platform: "instagram",
          externalId: page.instagram.id,
          name: page.instagram.name,
          username: page.instagram.username,
          avatarUrl: null,
          category: page.category,
          pageId: page.id,
          token,
          tokenExpiresAt: null,
          followers: page.instagram.followers,
        });
    }
    return Promise.resolve(out);
  }

  refresh(_login: LoginKind, token: string) {
    this.check(token);
    return Promise.resolve({
      token: token.replace(/-r\d+$/, "") + `-r${++this.seq}`,
      expiresAt: new Date(Date.now() + LONG_LIVED_MS),
    });
  }

  publish(
    creds: SocialCredentials,
    input: PublishInput,
  ): Promise<PublishResult> {
    this.check(creds.token);
    if (input.caption.includes("#fail"))
      return Promise.reject(
        metaRejected(
          `${creds.platform === "instagram" ? "Instagram" : "Facebook"} rejected this post.`,
        ),
      );
    const id = `mock_${creds.externalId}_${Date.now()}_${++this.seq}`;
    this.published.push({ id, account: creds.externalId, input });
    if (input.caption.includes("#reported")) this.reported.add(id);
    return Promise.resolve({
      id,
      permalink:
        creds.platform === "instagram"
          ? `https://www.instagram.com/p/${id.slice(-10)}/`
          : `https://www.facebook.com/${creds.externalId}/posts/${id}`,
    });
  }

  comment(creds: SocialCredentials, postId: string, text: string) {
    this.check(creds.token);
    this.comments_.push({ postId, text });
    return Promise.resolve({ id: `${postId}_own${this.comments_.length}` });
  }

  comments(
    creds: SocialCredentials,
    postIds: string[],
  ): Promise<RemoteComment[]> {
    this.check(creds.token);
    const now = Date.now();
    const out: RemoteComment[] = [];
    for (const postId of postIds) {
      const parsed = parsePostId(postId);
      const history = /^hist_\d+_(\d+)$/.exec(postId);
      const at =
        parsed?.at ??
        (history ? now - (Number(history[1]) * 2 + 2) * DAY : now - 3 * DAY);
      COMMENTS.forEach((c, i) => {
        const id = `${postId}_c${i + 1}`;
        out.push({
          id,
          postId,
          parentId: null,
          author: c.author,
          authorId: String(hash(c.author)),
          text: c.text,
          createdAt: new Date(Math.min(now, at + (i + 1) * 60_000)),
          hidden: this.hidden.get(id) ?? false,
          fromAccount: false,
        });
      });
    }
    return Promise.resolve(out);
  }

  reply(creds: SocialCredentials, commentId: string, text: string) {
    this.check(creds.token);
    if (text.includes("FAIL_ON_META"))
      return Promise.reject(metaRejected("Meta rejected this reply."));
    this.replies.push({ commentId, text });
    return Promise.resolve({ id: `${commentId}_r${this.replies.length}` });
  }

  hide(creds: SocialCredentials, commentId: string, hidden: boolean) {
    this.check(creds.token);
    this.hidden.set(commentId, hidden);
    return Promise.resolve();
  }

  postInsights(
    creds: SocialCredentials,
    postId: string,
    format: PostFormat,
  ): Promise<RemotePostInsights> {
    this.check(creds.token);
    const h = hash(postId);
    const history = /^hist_\d+_(\d+)$/.exec(postId);
    const hour = history
      ? HISTORY_HOURS[Number(history[1]) % HISTORY_HOURS.length]!
      : 12;
    const boost = hour >= 18 ? 2.2 : hour <= 10 ? 0.7 : 1;
    const reach = 300 + (h % 700);
    const likes = Math.round(reach * 0.05 * boost) + (h % 7);
    const video = format === "reel" || format === "video";
    return Promise.resolve({
      reach,
      impressions: Math.round(reach * 1.4),
      likes,
      comments: 4,
      shares: Math.round((h % 13) * boost),
      saves: Math.round((h % 21) * boost),
      videoPlays: video ? Math.round(reach * 1.3) : 0,
      reported: this.reported.has(postId),
    });
  }

  accountInsights(
    creds: SocialCredentials,
    from: string,
    to: string,
  ): Promise<RemoteAccountDay[]> {
    this.check(creds.token);
    const base = 900 + (hash(creds.externalId) % 1500);
    const out: RemoteAccountDay[] = [];
    const start = Date.parse(`${from}T00:00:00Z`);
    for (let day = from, i = 0; day <= to; day = addDays(day, 1), i++) {
      const n = Math.round((Date.parse(`${day}T00:00:00Z`) - start) / DAY);
      const h = hash(`${creds.externalId}:${day}`);
      out.push({
        day,
        followers: base + n * 4 + (h % 3),
        profileVisits: 25 + (h % 40),
        reach: 400 + (h % 600),
        impressions: 650 + (h % 900),
      });
      if (i > 400) break;
    }
    return Promise.resolve(out);
  }

  recentPosts(creds: SocialCredentials, limit: number): Promise<RemotePost[]> {
    this.check(creds.token);
    const today = isoDay(Date.now());
    return Promise.resolve(
      HISTORY.slice(0, limit).map((caption, i) => {
        const day = addDays(today, -(i * 2 + 2));
        const at = new Date(
          `${day}T${String(HISTORY_HOURS[i]! - 6).padStart(2, "0")}:30:00Z`,
        );
        return {
          id: `hist_${creds.externalId}_${i}`,
          caption,
          format: (i % 4 === 1 ? "carousel" : "image") as PostFormat,
          mediaUrl: null,
          permalink:
            creds.platform === "instagram"
              ? `https://www.instagram.com/p/HIST${i}/`
              : `https://www.facebook.com/${creds.externalId}/posts/hist${i}`,
          createdAt: at,
        };
      }),
    );
  }

  readWebsite(): Promise<string> {
    return Promise.resolve(WEBSITE);
  }
}
