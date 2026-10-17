import {
  AccountMetricValues,
  LoginKind,
  MediaItem,
  PostFormat,
  PostMetricValues,
  SocialPlatform,
} from "../social.types";

export const SOCIAL_API = Symbol("SOCIAL_API");

export const FACEBOOK_LOGIN_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "read_insights",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_insights",
  "business_management",
];

export const INSTAGRAM_LOGIN_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
];

export interface SocialGrant {
  token: string;
  expiresAt: Date | null;
  userId: string;
  userName: string;
}

export interface DiscoveredAccount {
  platform: SocialPlatform;
  externalId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  category: string | null;
  pageId: string | null;
  token: string;
  tokenExpiresAt: Date | null;
  followers: number;
}

export interface SocialCredentials {
  login: LoginKind;
  platform: SocialPlatform;
  externalId: string;
  pageId: string | null;
  token: string;
}

export interface PublishInput {
  format: PostFormat;
  caption: string;
  media: MediaItem[];
  link: string | null;
  location: string | null;
  collaborators: string[];
  altText: string | null;
}

export interface PublishResult {
  id: string;
  permalink: string | null;
}

export interface RemoteComment {
  id: string;
  postId: string;
  parentId: string | null;
  author: string;
  authorId: string | null;
  text: string;
  createdAt: Date;
  hidden: boolean;
  fromAccount: boolean;
}

export interface RemotePostInsights extends PostMetricValues {
  reported: boolean;
}

export interface RemoteAccountDay extends AccountMetricValues {
  day: string;
}

export interface RemotePost {
  id: string;
  caption: string;
  format: PostFormat;
  mediaUrl: string | null;
  permalink: string | null;
  createdAt: Date;
}

export interface SocialApi {
  authUrl(login: LoginKind, redirectUri: string, state: string): string;
  exchangeCode(
    login: LoginKind,
    code: string,
    redirectUri: string,
  ): Promise<SocialGrant>;
  accounts(login: LoginKind, grant: SocialGrant): Promise<DiscoveredAccount[]>;
  refresh(
    login: LoginKind,
    token: string,
  ): Promise<{ token: string; expiresAt: Date | null }>;
  publish(
    creds: SocialCredentials,
    input: PublishInput,
  ): Promise<PublishResult>;
  comment(
    creds: SocialCredentials,
    postId: string,
    text: string,
  ): Promise<{ id: string }>;
  comments(
    creds: SocialCredentials,
    postIds: string[],
  ): Promise<RemoteComment[]>;
  reply(
    creds: SocialCredentials,
    commentId: string,
    text: string,
  ): Promise<{ id: string }>;
  hide(
    creds: SocialCredentials,
    commentId: string,
    hidden: boolean,
  ): Promise<void>;
  postInsights(
    creds: SocialCredentials,
    postId: string,
    format: PostFormat,
  ): Promise<RemotePostInsights>;
  accountInsights(
    creds: SocialCredentials,
    from: string,
    to: string,
  ): Promise<RemoteAccountDay[]>;
  recentPosts(creds: SocialCredentials, limit: number): Promise<RemotePost[]>;
  readWebsite(url: string): Promise<string>;
}
