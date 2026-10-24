import { ReplyAiInput } from "../domain/ports/reply-ai";
import { replySystem } from "./anthropic-reply.ai";
import { MockReplyAi } from "./mock-reply.ai";

const input = (over: Partial<ReplyAiInput> = {}): ReplyAiInput => ({
  channel: "google_business",
  subjectName: "Sharma Dental Clinic",
  developerName: null,
  supportEmail: null,
  latestVersion: null,
  review: { author: "Meera Sharma", stars: 5, text: "Great", language: "en" },
  template: "Thank you, {user_name}! See you again at {business_name}.",
  tone: "friendly",
  translate: false,
  personalize: true,
  avoid: null,
  maxLength: 1000,
  ...over,
});

describe("reply styles", () => {
  it("adds a style instruction to the Claude prompt only when asked", () => {
    expect(replySystem(input())).not.toContain("For this reply");
    expect(replySystem(input({ style: "warmer" }))).toContain("warmer");
    expect(replySystem(input({ style: "shorter" }))).toContain("brief");
    expect(replySystem(input({ style: "formal" }))).toContain("formal");
  });

  it("writes visibly different mock drafts per style", async () => {
    const ai = new MockReplyAi();
    const text = async (style?: ReplyAiInput["style"]) =>
      (await ai.draft("key", input({ style }))).text;
    const base = await text();
    expect(base).toBe(
      "Thank you, Meera! See you again at Sharma Dental Clinic.",
    );
    const warmer = await text("warmer");
    expect(warmer).toBe(
      "Meera, thank you so much for taking the time to write this. See you again at Sharma Dental Clinic.",
    );
    expect(await text("shorter")).toBe("Thank you, Meera! See you soon.");
    expect(await text("formal")).toBe(
      "Dear Meera, thank you for your review. See you again at Sharma Dental Clinic.",
    );
    expect(ai.calls.at(-1)?.style).toBe("formal");
  });
});
