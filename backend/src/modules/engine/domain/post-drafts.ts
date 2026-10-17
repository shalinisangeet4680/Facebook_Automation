import { PostAiInput, PostAiResult } from "./ports/post-ai";

const OPENERS: Record<PostAiInput["brand"]["voice"], string> = {
  friendly: "Here's something for you",
  professional: "A note from our team",
  playful: "Guess what",
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);

export function draftPost(input: PostAiInput): PostAiResult {
  const b = input.brand;
  const name = b.name || "us";
  const headline = input.idea.replace(/^[^:]+:\s*/, "").slice(0, 60);
  const body = [
    `${OPENERS[b.voice]}! ${input.idea.replace(/[.!?]*$/, "")}.`,
    b.audience ? `Made for ${b.audience}.` : "",
    b.cta ? `${b.cta}${b.link ? ` ${b.link}` : ""}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const tags = [
    ...b.hashtags,
    slug(name),
    b.city ? slug(b.city) : "",
    slug(b.businessType),
  ]
    .map((t) => t.replace(/^#/, ""))
    .filter(Boolean);
  const words = new Set(b.bannedWords.map((w) => w.toLowerCase()));
  const caption = body
    .split(" ")
    .filter((w) => !words.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")))
    .join(" ");
  const avoidSuffix = input.avoid ? " Tell us what you think below!" : "";
  return {
    headline: headline || name,
    caption: `${caption}${avoidSuffix}`.slice(0, input.maxLength),
    hashtags: [...new Set(tags)].slice(
      0,
      input.platform === "instagram" ? 8 : 3,
    ),
    firstComment:
      input.platform === "instagram" && input.format !== "story"
        ? "Questions? Ask us in the comments 👇"
        : null,
    altText: `${headline || name} – ${name}`,
  };
}
