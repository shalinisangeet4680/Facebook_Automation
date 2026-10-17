import { lookup } from "dns/promises";
import { isIP } from "net";

import { ConfigService } from "@nestjs/config";

import { metaRejected } from "@modules/meta/domain/meta.errors";
import {
  GraphApiClient,
  GraphParams,
} from "@modules/meta/infrastructure/graph-api.client";
import { Env } from "@shared/config/env.validation";

import {
  DiscoveredAccount,
  FACEBOOK_LOGIN_SCOPES,
  INSTAGRAM_LOGIN_SCOPES,
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

const POLL_MS = 3_000;
const POLL_ATTEMPTS = 60;

class SocialGraph extends GraphApiClient {
  protected override readonly base: string;

  constructor(config: ConfigService<Env, true>, host: string) {
    super(config);
    this.base = `${host}/${config.get("META_GRAPH_VERSION", { infer: true })}`;
  }

  read<T>(token: string, path: string, params: GraphParams = {}) {
    return this.get<T>(token, path, params);
  }

  write<T>(token: string, path: string, params: GraphParams) {
    return this.post<T>(token, path, params);
  }

  all<T>(token: string, path: string, params: Record<string, string>) {
    return this.list<T>(token, path, params);
  }

  pause(ms: number) {
    return this.wait(ms);
  }
}

const num = (v: unknown) => (typeof v === "number" ? v : 0);

interface InsightRow {
  name: string;
  values?: { value: unknown; end_time?: string }[];
  total_value?: { value: number };
}

const metric = (rows: InsightRow[], name: string) => {
  const row = rows.find((r) => r.name === name);
  return num(row?.total_value?.value ?? row?.values?.[0]?.value);
};

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

async function safeHost(hostname: string) {
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });
  return addresses.every(
    ({ address }) =>
      !PRIVATE_V4.some((re) => re.test(address)) &&
      !/^(::1|fc|fd|fe80)/i.test(address),
  );
}

export class GraphSocialClient implements SocialApi {
  private readonly fb: SocialGraph;
  private readonly ig: SocialGraph;
  private readonly version: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.fb = new SocialGraph(config, "https://graph.facebook.com");
    this.ig = new SocialGraph(config, "https://graph.instagram.com");
    this.version = config.get("META_GRAPH_VERSION", { infer: true });
  }

  private app(login: LoginKind) {
    const id =
      login === "facebook"
        ? this.config.get("META_APP_ID", { infer: true })
        : this.config.get("INSTAGRAM_APP_ID", { infer: true });
    const secret =
      login === "facebook"
        ? this.config.get("META_APP_SECRET", { infer: true })
        : this.config.get("INSTAGRAM_APP_SECRET", { infer: true });
    return { id: id ?? "", secret: secret ?? "" };
  }

  private graph(creds: { login: LoginKind }) {
    return creds.login === "instagram" ? this.ig : this.fb;
  }

  authUrl(login: LoginKind, redirectUri: string, state: string): string {
    const { id } = this.app(login);
    const url =
      login === "facebook"
        ? new URL(`https://www.facebook.com/${this.version}/dialog/oauth`)
        : new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "scope",
      (login === "facebook"
        ? FACEBOOK_LOGIN_SCOPES
        : INSTAGRAM_LOGIN_SCOPES
      ).join(","),
    );
    return url.toString();
  }

  private async json<T>(res: Response): Promise<T> {
    const body = (await res.json().catch(() => ({}))) as T & {
      error?: { message?: string } | string;
      error_message?: string;
    };
    if (!res.ok || body.error) {
      const message =
        typeof body.error === "string"
          ? body.error
          : (body.error?.message ?? body.error_message);
      throw metaRejected(message ?? `Meta sign-in failed (${res.status}).`);
    }
    return body;
  }

  async exchangeCode(
    login: LoginKind,
    code: string,
    redirectUri: string,
  ): Promise<SocialGrant> {
    const { id, secret } = this.app(login);
    if (login === "facebook") {
      const short = new URL(
        `https://graph.facebook.com/${this.version}/oauth/access_token`,
      );
      short.search = new URLSearchParams({
        client_id: id,
        client_secret: secret,
        redirect_uri: redirectUri,
        code,
      }).toString();
      const first = await this.json<{ access_token: string }>(
        await fetch(short, { signal: AbortSignal.timeout(15_000) }),
      );
      const long = new URL(short);
      long.search = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: id,
        client_secret: secret,
        fb_exchange_token: first.access_token,
      }).toString();
      const second = await this.json<{
        access_token: string;
        expires_in?: number;
      }>(await fetch(long, { signal: AbortSignal.timeout(15_000) }));
      const me = await this.fb.read<{ id: string; name: string }>(
        second.access_token,
        "/me",
        { fields: "id,name" },
      );
      return {
        token: second.access_token,
        expiresAt: second.expires_in
          ? new Date(Date.now() + second.expires_in * 1000)
          : null,
        userId: me.id,
        userName: me.name,
      };
    }
    const first = await this.json<{ access_token: string; user_id: number }>(
      await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: id,
          client_secret: secret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }),
        signal: AbortSignal.timeout(15_000),
      }),
    );
    const long = new URL("https://graph.instagram.com/access_token");
    long.search = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: secret,
      access_token: first.access_token,
    }).toString();
    const second = await this.json<{
      access_token: string;
      expires_in: number;
    }>(await fetch(long, { signal: AbortSignal.timeout(15_000) }));
    const me = await this.ig.read<{ user_id?: string; username: string }>(
      second.access_token,
      "/me",
      { fields: "user_id,username" },
    );
    return {
      token: second.access_token,
      expiresAt: new Date(Date.now() + second.expires_in * 1000),
      userId: me.user_id ?? String(first.user_id),
      userName: me.username,
    };
  }

  async accounts(
    login: LoginKind,
    grant: SocialGrant,
  ): Promise<DiscoveredAccount[]> {
    if (login === "instagram") {
      const me = await this.ig.read<{
        user_id: string;
        username: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
      }>(grant.token, "/me", {
        fields: "user_id,username,name,profile_picture_url,followers_count",
      });
      return [
        {
          platform: "instagram",
          externalId: me.user_id,
          name: me.name || me.username,
          username: me.username,
          avatarUrl: me.profile_picture_url ?? null,
          category: null,
          pageId: null,
          token: grant.token,
          tokenExpiresAt: grant.expiresAt,
          followers: me.followers_count ?? 0,
        },
      ];
    }
    const pages = await this.fb.all<{
      id: string;
      name: string;
      category?: string;
      access_token: string;
      followers_count?: number;
      picture?: { data?: { url?: string } };
      instagram_business_account?: {
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
        followers_count?: number;
      };
    }>(grant.token, "/me/accounts", {
      fields:
        "id,name,category,access_token,followers_count,picture{url},instagram_business_account{id,username,name,profile_picture_url,followers_count}",
    });
    const out: DiscoveredAccount[] = [];
    for (const p of pages) {
      out.push({
        platform: "facebook",
        externalId: p.id,
        name: p.name,
        username: null,
        avatarUrl: p.picture?.data?.url ?? null,
        category: p.category ?? null,
        pageId: p.id,
        token: p.access_token,
        tokenExpiresAt: null,
        followers: p.followers_count ?? 0,
      });
      const ig = p.instagram_business_account;
      if (ig)
        out.push({
          platform: "instagram",
          externalId: ig.id,
          name: ig.name || ig.username || p.name,
          username: ig.username ?? null,
          avatarUrl: ig.profile_picture_url ?? null,
          category: p.category ?? null,
          pageId: p.id,
          token: p.access_token,
          tokenExpiresAt: null,
          followers: ig.followers_count ?? 0,
        });
    }
    return out;
  }

  async refresh(login: LoginKind, token: string) {
    if (login === "instagram") {
      const res = await this.ig.read<{
        access_token: string;
        expires_in: number;
      }>(token, "/refresh_access_token", { grant_type: "ig_refresh_token" });
      return {
        token: res.access_token,
        expiresAt: new Date(Date.now() + res.expires_in * 1000),
      };
    }
    const { id, secret } = this.app("facebook");
    const res = await this.fb.read<{
      access_token: string;
      expires_in?: number;
    }>(token, "/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: id,
      client_secret: secret,
      fb_exchange_token: token,
    });
    return {
      token: res.access_token,
      expiresAt: res.expires_in
        ? new Date(Date.now() + res.expires_in * 1000)
        : null,
    };
  }

  private async igContainer(
    creds: SocialCredentials,
    params: GraphParams,
  ): Promise<string> {
    const g = this.graph(creds);
    const container = await g.write<{ id: string }>(
      creds.token,
      `/${creds.externalId}/media`,
      params,
    );
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      const status = await g.read<{ status_code?: string; status?: string }>(
        creds.token,
        `/${container.id}`,
        { fields: "status_code,status" },
      );
      if (status.status_code === "FINISHED") return container.id;
      if (status.status_code === "ERROR" || status.status_code === "EXPIRED")
        throw metaRejected(
          `Instagram couldn't process the media: ${status.status ?? status.status_code}`,
        );
      await g.pause(POLL_MS);
    }
    throw metaRejected("Instagram took too long to process the media.");
  }

  private async publishInstagram(
    creds: SocialCredentials,
    input: PublishInput,
  ): Promise<PublishResult> {
    const g = this.graph(creds);
    const extras: GraphParams = {
      ...(input.altText ? { alt_text: input.altText } : {}),
      ...(input.location ? { location_id: input.location } : {}),
      ...(input.collaborators.length
        ? { collaborators: input.collaborators }
        : {}),
    };
    const one = (m: PublishInput["media"][number]): GraphParams =>
      m.kind === "video" ? { video_url: m.url } : { image_url: m.url };
    let creation: string;
    if (input.format === "carousel") {
      const children: string[] = [];
      for (const m of input.media)
        children.push(
          await this.igContainer(creds, {
            ...one(m),
            ...(m.kind === "video" ? { media_type: "VIDEO" } : {}),
            is_carousel_item: true,
          }),
        );
      creation = await this.igContainer(creds, {
        media_type: "CAROUSEL",
        children: children.join(","),
        caption: input.caption,
        ...extras,
      });
    } else if (input.format === "reel")
      creation = await this.igContainer(creds, {
        media_type: "REELS",
        video_url: input.media[0]!.url,
        caption: input.caption,
        ...extras,
      });
    else if (input.format === "story")
      creation = await this.igContainer(creds, {
        media_type: "STORIES",
        ...one(input.media[0]!),
      });
    else
      creation = await this.igContainer(creds, {
        image_url: input.media[0]!.url,
        caption: input.caption,
        ...extras,
      });
    const media = await g.write<{ id: string }>(
      creds.token,
      `/${creds.externalId}/media_publish`,
      { creation_id: creation },
    );
    const details = await g
      .read<{ permalink?: string }>(creds.token, `/${media.id}`, {
        fields: "permalink",
      })
      .catch(() => ({ permalink: undefined }));
    return { id: media.id, permalink: details.permalink ?? null };
  }

  private async publishFacebook(
    creds: SocialCredentials,
    input: PublishInput,
  ): Promise<PublishResult> {
    const page = creds.externalId;
    let id: string;
    if (input.format === "image") {
      const photo = await this.fb.write<{ id: string; post_id?: string }>(
        creds.token,
        `/${page}/photos`,
        { url: input.media[0]!.url, caption: input.caption },
      );
      id = photo.post_id ?? `${page}_${photo.id}`;
    } else if (input.format === "multi_image") {
      const attached: { media_fbid: string }[] = [];
      for (const m of input.media) {
        const photo = await this.fb.write<{ id: string }>(
          creds.token,
          `/${page}/photos`,
          { url: m.url, published: false },
        );
        attached.push({ media_fbid: photo.id });
      }
      id = (
        await this.fb.write<{ id: string }>(creds.token, `/${page}/feed`, {
          message: input.caption,
          attached_media: attached,
        })
      ).id;
    } else if (input.format === "video") {
      const video = await this.fb.write<{ id: string }>(
        creds.token,
        `/${page}/videos`,
        { file_url: input.media[0]!.url, description: input.caption },
      );
      id = `${page}_${video.id}`;
    } else
      id = (
        await this.fb.write<{ id: string }>(creds.token, `/${page}/feed`, {
          message: input.caption,
          ...(input.format === "link" && input.link
            ? { link: input.link }
            : {}),
        })
      ).id;
    const details = await this.fb
      .read<{ permalink_url?: string }>(creds.token, `/${id}`, {
        fields: "permalink_url",
      })
      .catch(() => ({ permalink_url: undefined }));
    return { id, permalink: details.permalink_url ?? null };
  }

  publish(creds: SocialCredentials, input: PublishInput) {
    return creds.platform === "instagram"
      ? this.publishInstagram(creds, input)
      : this.publishFacebook(creds, input);
  }

  comment(creds: SocialCredentials, postId: string, text: string) {
    return this.graph(creds).write<{ id: string }>(
      creds.token,
      `/${postId}/comments`,
      { message: text },
    );
  }

  async comments(
    creds: SocialCredentials,
    postIds: string[],
  ): Promise<RemoteComment[]> {
    const g = this.graph(creds);
    const out: RemoteComment[] = [];
    for (const postId of postIds) {
      if (creds.platform === "instagram") {
        const rows = await g.all<{
          id: string;
          text?: string;
          username?: string;
          timestamp: string;
          hidden?: boolean;
          from?: { id: string; username?: string };
        }>(creds.token, `/${postId}/comments`, {
          fields: "id,text,username,timestamp,hidden,from{id,username}",
        });
        for (const r of rows)
          out.push({
            id: r.id,
            postId,
            parentId: null,
            author: r.username ?? r.from?.username ?? "",
            authorId: r.from?.id ?? null,
            text: r.text ?? "",
            createdAt: new Date(r.timestamp),
            hidden: r.hidden ?? false,
            fromAccount: r.from?.id === creds.externalId,
          });
      } else {
        const rows = await g.all<{
          id: string;
          message?: string;
          created_time: string;
          is_hidden?: boolean;
          from?: { id: string; name?: string };
        }>(creds.token, `/${postId}/comments`, {
          fields: "id,message,created_time,is_hidden,from{id,name}",
          filter: "toplevel",
        });
        for (const r of rows)
          out.push({
            id: r.id,
            postId,
            parentId: null,
            author: r.from?.name ?? "",
            authorId: r.from?.id ?? null,
            text: r.message ?? "",
            createdAt: new Date(r.created_time),
            hidden: r.is_hidden ?? false,
            fromAccount: r.from?.id === creds.externalId,
          });
      }
    }
    return out;
  }

  reply(creds: SocialCredentials, commentId: string, text: string) {
    return this.graph(creds).write<{ id: string }>(
      creds.token,
      creds.platform === "instagram"
        ? `/${commentId}/replies`
        : `/${commentId}/comments`,
      { message: text },
    );
  }

  async hide(creds: SocialCredentials, commentId: string, hidden: boolean) {
    await this.graph(creds).write(
      creds.token,
      `/${commentId}`,
      creds.platform === "instagram" ? { hide: hidden } : { is_hidden: hidden },
    );
  }

  async postInsights(
    creds: SocialCredentials,
    postId: string,
    format: PostFormat,
  ): Promise<RemotePostInsights> {
    const g = this.graph(creds);
    if (creds.platform === "instagram") {
      const metrics =
        format === "story"
          ? "reach,views,replies"
          : "reach,views,likes,comments,shares,saved";
      const res = await g.read<{ data: InsightRow[] }>(
        creds.token,
        `/${postId}/insights`,
        { metric: metrics },
      );
      const views = metric(res.data, "views");
      return {
        reach: metric(res.data, "reach"),
        impressions: views,
        likes: metric(res.data, "likes"),
        comments: metric(res.data, "comments") || metric(res.data, "replies"),
        shares: metric(res.data, "shares"),
        saves: metric(res.data, "saved"),
        videoPlays: format === "reel" ? views : 0,
        reported: false,
      };
    }
    const [insights, totals] = await Promise.all([
      g
        .read<{ data: InsightRow[] }>(creds.token, `/${postId}/insights`, {
          metric: "post_impressions,post_impressions_unique,post_video_views",
        })
        .catch(() => ({ data: [] as InsightRow[] })),
      g.read<{
        shares?: { count?: number };
        comments?: { summary?: { total_count?: number } };
        reactions?: { summary?: { total_count?: number } };
      }>(creds.token, `/${postId}`, {
        fields:
          "shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)",
      }),
    ]);
    return {
      reach: metric(insights.data, "post_impressions_unique"),
      impressions: metric(insights.data, "post_impressions"),
      likes: totals.reactions?.summary?.total_count ?? 0,
      comments: totals.comments?.summary?.total_count ?? 0,
      shares: totals.shares?.count ?? 0,
      saves: 0,
      videoPlays: metric(insights.data, "post_video_views"),
      reported: false,
    };
  }

  async accountInsights(
    creds: SocialCredentials,
    from: string,
    to: string,
  ): Promise<RemoteAccountDay[]> {
    const g = this.graph(creds);
    const since = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
    const until = Math.floor(Date.parse(`${to}T23:59:59Z`) / 1000);
    const days = new Map<string, RemoteAccountDay>();
    const at = (end?: string) => {
      const day = (end ? new Date(Date.parse(end) - 1000) : new Date())
        .toISOString()
        .slice(0, 10);
      if (!days.has(day))
        days.set(day, {
          day,
          followers: 0,
          profileVisits: 0,
          reach: 0,
          impressions: 0,
        });
      return days.get(day)!;
    };
    const names =
      creds.platform === "instagram"
        ? { reach: "reach", visits: "profile_views", impressions: "views" }
        : {
            reach: "page_impressions_unique",
            visits: "page_views_total",
            impressions: "page_impressions",
          };
    const res = await g
      .read<{ data: InsightRow[] }>(
        creds.token,
        `/${creds.externalId}/insights`,
        {
          metric: Object.values(names).join(","),
          period: "day",
          since,
          until,
        },
      )
      .catch(() => ({ data: [] as InsightRow[] }));
    for (const row of res.data)
      for (const v of row.values ?? []) {
        const d = at(v.end_time);
        if (row.name === names.reach) d.reach = num(v.value);
        if (row.name === names.visits) d.profileVisits = num(v.value);
        if (row.name === names.impressions) d.impressions = num(v.value);
      }
    const profile = await g.read<{
      followers_count?: number;
      fan_count?: number;
    }>(creds.token, `/${creds.externalId}`, {
      fields:
        creds.platform === "instagram"
          ? "followers_count"
          : "followers_count,fan_count",
    });
    at().followers = profile.followers_count ?? profile.fan_count ?? 0;
    return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  }

  async recentPosts(
    creds: SocialCredentials,
    limit: number,
  ): Promise<RemotePost[]> {
    const g = this.graph(creds);
    if (creds.platform === "instagram") {
      const res = await g.read<{
        data: {
          id: string;
          caption?: string;
          media_type?: string;
          media_product_type?: string;
          media_url?: string;
          permalink?: string;
          timestamp: string;
        }[];
      }>(creds.token, `/${creds.externalId}/media`, {
        fields:
          "id,caption,media_type,media_product_type,media_url,permalink,timestamp",
        limit,
      });
      return res.data.map((m) => ({
        id: m.id,
        caption: m.caption ?? "",
        format:
          m.media_product_type === "REELS"
            ? "reel"
            : m.media_type === "CAROUSEL_ALBUM"
              ? "carousel"
              : "image",
        mediaUrl: m.media_url ?? null,
        permalink: m.permalink ?? null,
        createdAt: new Date(m.timestamp),
      }));
    }
    const res = await g.read<{
      data: {
        id: string;
        message?: string;
        created_time: string;
        permalink_url?: string;
        full_picture?: string;
      }[];
    }>(creds.token, `/${creds.externalId}/posts`, {
      fields: "id,message,created_time,permalink_url,full_picture",
      limit,
    });
    return res.data.map((p) => ({
      id: p.id,
      caption: p.message ?? "",
      format: p.full_picture ? "image" : "text",
      mediaUrl: p.full_picture ?? null,
      permalink: p.permalink_url ?? null,
      createdAt: new Date(p.created_time),
    }));
  }

  async readWebsite(raw: string): Promise<string> {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw metaRejected(
        "Enter a full website address like https://example.com.",
      );
    }
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw metaRejected("Enter a website address that starts with https://.");
    if (!(await safeHost(url.hostname).catch(() => false)))
      throw metaRejected("This website address can't be read.");
    const res = await fetch(url, {
      redirect: "error",
      headers: { "user-agent": "TreeVookBot/1.0 (+https://treevook.com)" },
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);
    if (!res?.ok) throw metaRejected("The website couldn't be opened.");
    const html = (await res.text()).slice(0, 400_000);
    return html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&amp;|&#\d+;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6_000);
  }
}
