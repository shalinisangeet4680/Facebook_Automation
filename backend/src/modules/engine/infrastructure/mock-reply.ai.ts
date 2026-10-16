import { keywordTopic } from "../domain/topics";
import { firstName, render } from "../domain/templates";
import { ReplyAi, ReplyAiInput, ReplyAiResult } from "../domain/ports/reply-ai";

export class MockReplyAi implements ReplyAi {
  readonly calls: ReplyAiInput[] = [];

  async draft(_apiKey: string, input: ReplyAiInput): Promise<ReplyAiResult> {
    this.calls.push(input);
    const name = firstName(input.review.author) || "there";
    const base = input.template
      ? render(input.template, {
          user_name: name,
          app_name: input.subjectName,
          business_name: input.subjectName,
          rating: String(input.review.stars),
          support_email: input.supportEmail ?? "",
          version: input.latestVersion ?? "",
          developer_name: input.developerName ?? "",
        }).text
      : input.review.stars >= 4
        ? `Thanks ${name}! We're glad you enjoyed ${input.subjectName}.`
        : `Sorry ${name}, that's not the experience we want. Please write to ${input.supportEmail ?? "us from the Help section"} so we can help.`;
    const text = input.avoid ? `${base} Thanks again for the feedback.` : base;
    return {
      text: text.slice(0, input.maxLength),
      language: input.review.language?.split(/[-_]/)[0] ?? "en",
      topic: keywordTopic(input.review.text, input.review.stars, input.channel),
    };
  }
}
