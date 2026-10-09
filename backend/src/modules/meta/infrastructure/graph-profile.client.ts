import { Injectable } from "@nestjs/common";

import { metaRejected } from "../domain/meta.errors";
import {
  FacebookProfile,
  FacebookProfileUpdate,
  InstagramProfile,
  MetaProfile,
} from "../domain/ports/meta-profile";
import { GraphApiClient, GraphParams } from "./graph-api.client";

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

@Injectable()
export class GraphProfileClient extends GraphApiClient implements MetaProfile {
  async facebook(token: string, pageId: string): Promise<FacebookProfile> {
    const pageToken = await this.pageAccess(token, pageId);
    const r = await this.get<Record<string, unknown>>(pageToken, `/${pageId}`, {
      fields:
        "id,name,username,link,about,description,website,phone,emails,category,followers_count,fan_count,picture.width(720).height(720){url,is_silhouette},cover{source}",
    });
    const picture = (
      r.picture as
        { data?: { url?: string; is_silhouette?: boolean } } | undefined
    )?.data;
    return {
      id: String(r.id),
      name: str(r.name) ?? "",
      username: str(r.username),
      link: str(r.link),
      about: str(r.about),
      description: str(r.description),
      website: str(r.website),
      phone: str(r.phone),
      email:
        Array.isArray(r.emails) && typeof r.emails[0] === "string"
          ? r.emails[0]
          : null,
      category: str(r.category),
      pictureUrl: picture?.url ?? null,
      pictureIsDefault: picture?.is_silhouette ?? !picture?.url,
      coverUrl: str((r.cover as { source?: string } | undefined)?.source),
      followers: num(r.followers_count) ?? num(r.fan_count),
    };
  }

  async instagram(
    token: string,
    instagramId: string,
  ): Promise<InstagramProfile> {
    const r = await this.get<Record<string, unknown>>(
      token,
      `/${instagramId}`,
      {
        fields:
          "id,username,name,biography,website,profile_picture_url,followers_count,media_count",
      },
    );
    return {
      id: String(r.id),
      username: str(r.username) ?? "",
      name: str(r.name),
      biography: str(r.biography),
      website: str(r.website),
      pictureUrl: str(r.profile_picture_url),
      followers: num(r.followers_count),
      posts: num(r.media_count),
    };
  }

  async updateFacebook(
    token: string,
    pageId: string,
    update: FacebookProfileUpdate,
  ): Promise<void> {
    const params: GraphParams = {};
    if (update.about !== undefined) params.about = update.about;
    if (update.description !== undefined)
      params.description = update.description;
    if (update.website !== undefined) params.website = update.website;
    if (update.phone !== undefined) params.phone = update.phone;
    if (update.email !== undefined) params.emails = [update.email];
    if (!Object.keys(params).length) return;
    await this.post(await this.pageAccess(token, pageId), `/${pageId}`, params);
  }

  async setFacebookCover(
    token: string,
    pageId: string,
    imageUrl: string,
  ): Promise<void> {
    const pageToken = await this.pageAccess(token, pageId);
    const photo = await this.post<{ id: string }>(
      pageToken,
      `/${pageId}/photos`,
      { url: imageUrl, published: false },
    );
    await this.post(pageToken, `/${pageId}`, {
      cover: photo.id,
      no_feed_story: true,
    });
  }

  async setFacebookPicture(
    token: string,
    pageId: string,
    imageUrl: string,
  ): Promise<void> {
    await this.post(
      await this.pageAccess(token, pageId),
      `/${pageId}/picture`,
      { picture: imageUrl },
    );
  }

  private async pageAccess(token: string, pageId: string): Promise<string> {
    const page = await this.get<{ access_token?: string }>(
      token,
      `/${pageId}`,
      { fields: "access_token" },
    );
    if (!page.access_token)
      throw metaRejected(
        "Autopilot can't manage this Page. Give the system user full control of the Page.",
      );
    return page.access_token;
  }
}
