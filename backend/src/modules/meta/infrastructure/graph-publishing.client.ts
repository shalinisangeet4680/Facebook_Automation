import { Injectable } from "@nestjs/common";

import { metaRejected } from "../domain/meta.errors";
import {
  LibraryPost,
  MetaPublishing,
  PublishedPost,
} from "../domain/ports/meta-publishing";
import { GraphApiClient } from "./graph-api.client";

const POLL_INTERVAL_MS = 2_000;
const POLL_ATTEMPTS = 30;

const count = (v: unknown): number | null => (typeof v === "number" ? v : null);

@Injectable()
export class GraphPublishingClient
  extends GraphApiClient
  implements MetaPublishing
{
  async publishFacebookPhoto(
    token: string,
    pageId: string,
    imageUrl: string,
    caption: string,
  ): Promise<PublishedPost> {
    const pageToken = await this.pageToken(token, pageId);
    const photo = await this.post<{ id: string; post_id?: string }>(
      pageToken,
      `/${pageId}/photos`,
      {
        url: imageUrl,
        caption,
        published: true,
      },
    );
    const postId = photo.post_id ?? `${pageId}_${photo.id}`;
    const details = await this.get<{ permalink_url?: string }>(
      pageToken,
      `/${postId}`,
      { fields: "permalink_url" },
    ).catch(() => ({ permalink_url: undefined }));
    return { id: postId, permalink: details.permalink_url ?? null };
  }

  async publishInstagramImage(
    token: string,
    instagramId: string,
    imageUrl: string,
    caption: string,
  ): Promise<PublishedPost> {
    const container = await this.post<{ id: string }>(
      token,
      `/${instagramId}/media`,
      { image_url: imageUrl, caption },
    );
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      const status = await this.get<{ status_code?: string; status?: string }>(
        token,
        `/${container.id}`,
        {
          fields: "status_code,status",
        },
      );
      if (status.status_code === "FINISHED") break;
      if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
        throw metaRejected(
          `Instagram couldn't process the image: ${status.status ?? status.status_code}`,
        );
      }
      if (i === POLL_ATTEMPTS - 1)
        throw metaRejected("Instagram took too long to process the image.");
      await this.wait(POLL_INTERVAL_MS);
    }
    const media = await this.post<{ id: string }>(
      token,
      `/${instagramId}/media_publish`,
      { creation_id: container.id },
    );
    const details = await this.get<{ permalink?: string }>(
      token,
      `/${media.id}`,
      { fields: "permalink" },
    ).catch(() => ({
      permalink: undefined,
    }));
    return { id: media.id, permalink: details.permalink ?? null };
  }

  async facebookPosts(
    token: string,
    pageId: string,
    limit: number,
  ): Promise<LibraryPost[]> {
    const pageToken = await this.pageToken(token, pageId);
    const res = await this.get<{ data?: Record<string, unknown>[] }>(
      pageToken,
      `/${pageId}/published_posts`,
      {
        fields:
          "id,message,created_time,full_picture,permalink_url,likes.summary(true).limit(0),comments.summary(true).limit(0)",
        limit,
      },
    );
    return (res.data ?? []).map((r) => ({
      id: String(r.id),
      platform: "facebook" as const,
      text: typeof r.message === "string" ? r.message : null,
      imageUrl: typeof r.full_picture === "string" ? r.full_picture : null,
      permalink: typeof r.permalink_url === "string" ? r.permalink_url : null,
      createdAt: String(r.created_time),
      likes: count(
        (r.likes as { summary?: { total_count?: number } } | undefined)?.summary
          ?.total_count,
      ),
      comments: count(
        (r.comments as { summary?: { total_count?: number } } | undefined)
          ?.summary?.total_count,
      ),
      mediaType: null,
    }));
  }

  async instagramPosts(
    token: string,
    instagramId: string,
    limit: number,
  ): Promise<LibraryPost[]> {
    const res = await this.get<{ data?: Record<string, unknown>[] }>(
      token,
      `/${instagramId}/media`,
      {
        fields:
          "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
        limit,
      },
    );
    return (res.data ?? []).map((r) => ({
      id: String(r.id),
      platform: "instagram" as const,
      text: typeof r.caption === "string" ? r.caption : null,
      imageUrl:
        typeof r.thumbnail_url === "string"
          ? r.thumbnail_url
          : typeof r.media_url === "string"
            ? r.media_url
            : null,
      permalink: typeof r.permalink === "string" ? r.permalink : null,
      createdAt: String(r.timestamp),
      likes: count(r.like_count),
      comments: count(r.comments_count),
      mediaType: typeof r.media_type === "string" ? r.media_type : null,
    }));
  }

  private async pageToken(token: string, pageId: string): Promise<string> {
    const page = await this.get<{ access_token?: string }>(
      token,
      `/${pageId}`,
      { fields: "access_token" },
    );
    if (!page.access_token) {
      throw metaRejected(
        "Autopilot can't post to this Page. Give the system user full control of the Page and the pages_manage_posts permission.",
      );
    }
    return page.access_token;
  }
}
