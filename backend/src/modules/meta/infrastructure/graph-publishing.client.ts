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
const VIDEO_POLL_INTERVAL_MS = 5_000;
const VIDEO_POLL_ATTEMPTS = 72;

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
    const photo = await this.uploadPhoto(pageToken, pageId, imageUrl, caption);
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

  async publishFacebookReel(
    token: string,
    pageId: string,
    videoUrl: string,
    description: string,
  ): Promise<PublishedPost> {
    const pageToken = await this.pageToken(token, pageId);
    const start = await this.post<{ video_id: string; upload_url?: string }>(
      pageToken,
      `/${pageId}/video_reels`,
      {
        upload_phase: "start",
      },
    );
    const uploadUrl =
      start.upload_url ??
      `https://rupload.facebook.com/video-upload/${this.base.split("/").pop()}/${start.video_id}`;
    const source = await fetch(videoUrl, {
      signal: AbortSignal.timeout(300_000),
    });
    if (!source.ok)
      throw metaRejected(
        `Couldn't read the video to upload (HTTP ${source.status}).`,
      );
    const bytes = Buffer.from(await source.arrayBuffer());
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${pageToken}`,
        offset: "0",
        file_size: String(bytes.length),
        "Content-Type": "application/octet-stream",
      },
      body: bytes,
      signal: AbortSignal.timeout(300_000),
    });
    const uploaded = (await upload.json().catch(() => ({}))) as {
      success?: boolean;
      debug_info?: { message?: string };
    };
    if (!upload.ok || uploaded.success === false) {
      throw metaRejected(
        `Facebook didn't accept the video upload: ${uploaded.debug_info?.message ?? `HTTP ${upload.status}`}`,
      );
    }
    await this.post(pageToken, `/${pageId}/video_reels`, {
      upload_phase: "finish",
      video_id: start.video_id,
      video_state: "PUBLISHED",
      description,
    });
    let permalink: string | null = null;
    for (let i = 0; i < 24; i++) {
      const status = await this.get<{
        status?: {
          video_status?: string;
          processing_phase?: { status?: string; error?: { message?: string } };
        };
        permalink_url?: string;
      }>(pageToken, `/${start.video_id}`, { fields: "status,permalink_url" });
      if (status.status?.processing_phase?.status === "error") {
        throw metaRejected(
          `Facebook couldn't process the video: ${status.status.processing_phase.error?.message ?? "unknown error"}`,
        );
      }
      permalink = status.permalink_url
        ? new URL(status.permalink_url, "https://www.facebook.com").toString()
        : null;
      if (
        status.status?.video_status === "ready" ||
        status.status?.video_status === "published"
      )
        break;
      await this.wait(VIDEO_POLL_INTERVAL_MS);
    }
    return { id: start.video_id, permalink };
  }

  async publishInstagramReel(
    token: string,
    instagramId: string,
    videoUrl: string,
    caption: string,
  ): Promise<PublishedPost> {
    const container = await this.post<{ id: string }>(
      token,
      `/${instagramId}/media`,
      {
        media_type: "REELS",
        video_url: videoUrl,
        caption,
        share_to_feed: true,
      },
    );
    for (let i = 0; i < VIDEO_POLL_ATTEMPTS; i++) {
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
          `Instagram couldn't process the video: ${status.status ?? status.status_code}`,
        );
      }
      if (i === VIDEO_POLL_ATTEMPTS - 1)
        throw metaRejected("Instagram took too long to process the video.");
      await this.wait(VIDEO_POLL_INTERVAL_MS);
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

  private async uploadPhoto(
    pageToken: string,
    pageId: string,
    imageUrl: string,
    caption: string,
  ): Promise<{ id: string; post_id?: string }> {
    const source = await fetch(imageUrl, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!source.ok)
      throw metaRejected(
        `Couldn't read the image to upload (HTTP ${source.status}).`,
      );
    const type = source.headers.get("content-type") ?? "image/png";
    const form = new FormData();
    form.append(
      "source",
      new Blob([await source.arrayBuffer()], { type }),
      "image",
    );
    form.append("caption", caption);
    form.append("published", "true");
    const res = await fetch(`${this.base}/${pageId}/photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${pageToken}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      post_id?: string;
      error?: { message?: string; error_user_msg?: string };
    };
    if (!res.ok || body.error || !body.id) {
      throw metaRejected(
        body.error?.error_user_msg ??
          body.error?.message ??
          `Facebook rejected the photo (HTTP ${res.status}).`,
      );
    }
    return { id: body.id, post_id: body.post_id };
  }

  private async pageToken(token: string, pageId: string): Promise<string> {
    const page = await this.get<{ access_token?: string }>(
      token,
      `/${pageId}`,
      { fields: "access_token" },
    );
    if (!page.access_token) {
      throw metaRejected(
        "TreeVook can't post to this Page. Give the system user full control of the Page and the pages_manage_posts permission.",
      );
    }
    return page.access_token;
  }
}
