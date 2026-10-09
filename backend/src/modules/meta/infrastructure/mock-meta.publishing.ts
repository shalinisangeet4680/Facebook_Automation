import { Injectable } from "@nestjs/common";

import { metaRejected } from "../domain/meta.errors";
import {
  LibraryPost,
  MetaPublishing,
  PublishedPost,
} from "../domain/ports/meta-publishing";

const posts: LibraryPost[] = [];
let sequence = 0;

export function resetMockPublishing(): void {
  posts.length = 0;
  sequence = 0;
}

function seed(): void {
  if (posts.length) return;
  const day = 86_400_000;
  posts.push(
    {
      id: "1301000000000001_900001",
      platform: "facebook",
      text: "Patients get WhatsApp reminders, you get fewer no-shows. Try the free demo clinic.",
      imageUrl: "https://arogyasystem.com/og.png",
      permalink: "https://www.facebook.com/1301000000000001/posts/900001",
      createdAt: new Date(Date.now() - 6 * day).toISOString(),
      likes: 42,
      comments: 5,
      mediaType: null,
    },
    {
      id: "17900000000000001",
      platform: "instagram",
      text: "Run your whole clinic from one app 🩺 #clinic #doctors #healthtech",
      imageUrl: "https://arogyasystem.com/og.png",
      permalink: "https://www.instagram.com/p/MOCK0001/",
      createdAt: new Date(Date.now() - 4 * day).toISOString(),
      likes: 88,
      comments: 9,
      mediaType: "IMAGE",
    },
  );
}

@Injectable()
export class MockMetaPublishing implements MetaPublishing {
  publishFacebookPhoto(
    _token: string,
    pageId: string,
    imageUrl: string,
    caption: string,
  ): Promise<PublishedPost> {
    if (caption.includes("#fail-facebook"))
      return Promise.reject(metaRejected("Facebook rejected this post."));
    seed();
    const id = `${pageId}_${910000 + ++sequence}`;
    posts.unshift({
      id,
      platform: "facebook",
      text: caption,
      imageUrl,
      permalink: `https://www.facebook.com/${id}`,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      mediaType: null,
    });
    return Promise.resolve({ id, permalink: `https://www.facebook.com/${id}` });
  }

  publishInstagramImage(
    _token: string,
    _instagramId: string,
    imageUrl: string,
    caption: string,
  ): Promise<PublishedPost> {
    if (caption.includes("#fail-instagram"))
      return Promise.reject(
        metaRejected("Instagram couldn't process the image."),
      );
    seed();
    const id = `1791000000000${String(++sequence).padStart(4, "0")}`;
    posts.unshift({
      id,
      platform: "instagram",
      text: caption,
      imageUrl,
      permalink: `https://www.instagram.com/p/MOCK${id.slice(-4)}/`,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      mediaType: "IMAGE",
    });
    return Promise.resolve({
      id,
      permalink: `https://www.instagram.com/p/MOCK${id.slice(-4)}/`,
    });
  }

  facebookPosts(
    _token: string,
    _pageId: string,
    limit: number,
  ): Promise<LibraryPost[]> {
    seed();
    return Promise.resolve(
      posts.filter((p) => p.platform === "facebook").slice(0, limit),
    );
  }

  instagramPosts(
    _token: string,
    _instagramId: string,
    limit: number,
  ): Promise<LibraryPost[]> {
    seed();
    return Promise.resolve(
      posts.filter((p) => p.platform === "instagram").slice(0, limit),
    );
  }
}
