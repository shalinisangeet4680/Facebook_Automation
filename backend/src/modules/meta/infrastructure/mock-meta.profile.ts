import { Injectable } from "@nestjs/common";

import { metaRejected } from "../domain/meta.errors";
import {
  FacebookProfile,
  FacebookProfileUpdate,
  InstagramProfile,
  MetaProfile,
} from "../domain/ports/meta-profile";

const initial = (): FacebookProfile => ({
  id: "1301000000000001",
  name: "Arogya System",
  username: null,
  link: "https://www.facebook.com/1301000000000001",
  about: null,
  description: null,
  website: null,
  phone: null,
  email: null,
  category: "Software",
  pictureUrl: null,
  pictureIsDefault: true,
  coverUrl: null,
  followers: 120,
});

let facebook = initial();

export function resetMockProfile(): void {
  facebook = initial();
}

@Injectable()
export class MockMetaProfile implements MetaProfile {
  facebook(): Promise<FacebookProfile> {
    return Promise.resolve({ ...facebook });
  }

  instagram(_token: string, instagramId: string): Promise<InstagramProfile> {
    return Promise.resolve({
      id: instagramId,
      username: "arogyasystem",
      name: "Arogya System",
      biography: "Clinic software",
      website: null,
      pictureUrl: null,
      followers: 340,
      posts: 12,
    });
  }

  updateFacebook(
    _token: string,
    _pageId: string,
    update: FacebookProfileUpdate,
  ): Promise<void> {
    if (update.website && !/^https?:\/\//.test(update.website))
      return Promise.reject(metaRejected("Website is not a valid URL."));
    facebook = {
      ...facebook,
      ...(update.about !== undefined ? { about: update.about } : {}),
      ...(update.description !== undefined
        ? { description: update.description }
        : {}),
      ...(update.website !== undefined ? { website: update.website } : {}),
      ...(update.phone !== undefined ? { phone: update.phone } : {}),
      ...(update.email !== undefined ? { email: update.email } : {}),
    };
    return Promise.resolve();
  }

  setFacebookCover(
    _token: string,
    _pageId: string,
    imageUrl: string,
  ): Promise<void> {
    facebook = { ...facebook, coverUrl: imageUrl };
    return Promise.resolve();
  }

  setFacebookPicture(
    _token: string,
    _pageId: string,
    imageUrl: string,
  ): Promise<void> {
    facebook = { ...facebook, pictureUrl: imageUrl, pictureIsDefault: false };
    return Promise.resolve();
  }
}
