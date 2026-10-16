import { Tone, Topic } from "../play.types";

export const REPLY_AI = Symbol("REPLY_AI");

export interface ReplyAiInput {
  appName: string;
  developerName: string | null;
  supportEmail: string | null;
  latestVersion: string | null;
  review: {
    author: string;
    stars: number;
    text: string;
    language: string | null;
  };
  template: string | null;
  tone: Tone;
  translate: boolean;
  personalize: boolean;
  avoid: string | null;
  maxLength: number;
}

export interface ReplyAiResult {
  text: string;
  language: string | null;
  topic: Topic;
}

export type ReplyAiErrorKind = "auth" | "quota" | "refused" | "unavailable";

export class ReplyAiError extends Error {
  constructor(
    readonly kind: ReplyAiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ReplyAiError";
  }
}

export interface ReplyAi {
  draft(apiKey: string, input: ReplyAiInput): Promise<ReplyAiResult>;
}
