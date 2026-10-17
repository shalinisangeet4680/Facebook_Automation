export const POST_AI = Symbol("POST_AI");

export interface PostBrand {
  name: string;
  businessType: string;
  audience: string;
  voice: "friendly" | "professional" | "playful";
  topics: string[];
  offers: string[];
  hashtags: string[];
  bannedWords: string[];
  cta: string;
  link: string | null;
  city: string | null;
  language: string;
}

export interface PostAiInput {
  platform: "instagram" | "facebook";
  format: string;
  contentType: string;
  idea: string;
  brand: PostBrand;
  avoid: string | null;
  maxLength: number;
}

export interface PostAiResult {
  headline: string;
  caption: string;
  hashtags: string[];
  firstComment: string | null;
  altText: string | null;
}

export interface BrandAiInput {
  name: string;
  websiteUrl: string | null;
  websiteText: string;
  recentCaptions: string[];
}

export interface BrandAiResult {
  businessType: string;
  audience: string;
  voice: "friendly" | "professional" | "playful";
  topics: string[];
  offers: string[];
  hashtags: string[];
  cta: string;
  city: string | null;
}

export interface PostAi {
  write(apiKey: string, input: PostAiInput): Promise<PostAiResult>;
  brandKit(apiKey: string, input: BrandAiInput): Promise<BrandAiResult>;
}
