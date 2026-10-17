import { computeBestTimes, defaultBestTimes } from "./best-time";
import { brandSlideSvg, slideHeadlines, wrap } from "./brand-template";
import { festivalsBetween, planWeek } from "./calendar";
import { CLASS_STARS, classifyComment, commentReplySettings } from "./comments";
import { decidePost, engagementDrop } from "./safeguards";
import {
  DEFAULT_BRAND_KIT,
  MediaItem,
  PostContent,
  checkPost,
  defaultSettings,
  fullCaption,
  normalizeAutopostSettings,
} from "./social.types";
import { addDays, localParts, weekStartOf, zonedTime } from "./time";

const image = (url = "https://cdn.example.com/a.jpg"): MediaItem => ({
  url,
  kind: "image",
  creativeId: null,
  width: 1080,
  height: 1080,
  durationSeconds: null,
});

const video = (seconds: number): MediaItem => ({
  url: "https://cdn.example.com/v.mp4",
  kind: "video",
  creativeId: null,
  width: 1080,
  height: 1920,
  durationSeconds: seconds,
});

const content = (patch: Partial<PostContent> = {}): PostContent => ({
  caption: "Hello",
  hashtags: [],
  firstComment: null,
  altText: null,
  media: [image()],
  link: null,
  location: null,
  collaborators: [],
  ...patch,
});

describe("time", () => {
  it("converts local wall time in a zone to UTC", () => {
    expect(zonedTime("2026-10-19", 19, 0, "Asia/Kolkata").toISOString()).toBe(
      "2026-10-19T13:30:00.000Z",
    );
    expect(
      zonedTime("2026-07-01", 9, 0, "America/New_York").toISOString(),
    ).toBe("2026-07-01T13:00:00.000Z");
  });

  it("finds the Monday of a week in the account's zone", () => {
    const sunday = new Date("2026-10-18T20:00:00Z");
    expect(localParts(sunday, "Asia/Kolkata").weekday).toBe(0);
    expect(weekStartOf(sunday, "Asia/Kolkata")).toBe("2026-10-19");
    expect(weekStartOf(sunday, "UTC")).toBe("2026-10-12");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("post rules", () => {
  it("checks formats per platform", () => {
    expect(checkPost("instagram", "image", content())).toEqual([]);
    expect(checkPost("instagram", "text", content())).toEqual([
      "Instagram doesn't support Text posts.",
    ]);
    expect(checkPost("facebook", "carousel", content())[0]).toContain(
      "Facebook doesn't support",
    );
    expect(checkPost("instagram", "carousel", content())).toContain(
      "Add between 2 and 10 images or videos.",
    );
    expect(
      checkPost(
        "instagram",
        "carousel",
        content({ media: [image(), video(20)] }),
      ),
    ).toEqual([]);
    expect(
      checkPost(
        "facebook",
        "multi_image",
        content({ media: [image(), video(20)] }),
      ),
    ).toContain("Facebook multi-image posts take images only.");
    expect(checkPost("instagram", "reel", content())).toContain(
      "Add one vertical video for the Reel.",
    );
    expect(
      checkPost(
        "instagram",
        "story",
        content({ media: [video(90)], caption: "" }),
      ),
    ).toContain("Story videos can be at most 60 seconds.");
    expect(
      checkPost(
        "instagram",
        "story",
        content({ caption: "", firstComment: "Hi" }),
      ),
    ).toContain("Stories can't have a first comment.");
    expect(checkPost("facebook", "text", content({ media: [] }))).toEqual([]);
    expect(
      checkPost(
        "facebook",
        "link",
        content({ media: [], link: "http://x.com" }),
      ),
    ).toContain("Add an https link.");
    expect(
      checkPost(
        "facebook",
        "link",
        content({ media: [], link: "https://example.com" }),
      ),
    ).toEqual([]);
  });

  it("limits Instagram hashtags and joins them into the caption", () => {
    const tags = Array.from({ length: 31 }, (_, i) => `tag${i}`);
    expect(
      checkPost("instagram", "image", content({ hashtags: tags })),
    ).toContain("Instagram allows at most 30 hashtags.");
    expect(fullCaption({ caption: "Hi", hashtags: ["#one", "two", ""] })).toBe(
      "Hi\n\n#one #two",
    );
  });

  it("keeps defaults for missing settings and drops formats a platform can't post", () => {
    const s = normalizeAutopostSettings("facebook", {
      formats: ["carousel", "text"],
      modes: { tip: "auto" } as never,
    });
    expect(s.formats).toEqual(["text"]);
    expect(s.modes.tip).toBe("auto");
    expect(s.modes.offer).toBe("approval");
    expect(s.comments.modes.spam).toBe("manual");
  });
});

describe("comments", () => {
  it("classifies comments", () => {
    expect(classifyComment("What are your timings on Sunday?")).toBe(
      "question",
    );
    expect(classifyComment("kitna charge hai braces ka")).toBe("question");
    expect(classifyComment("Amazing work 😍")).toBe("praise");
    expect(classifyComment("Worst service, waited 2 hours")).toBe("complaint");
    expect(classifyComment("Get free followers bit.ly/x")).toBe("spam");
    expect(classifyComment("ok")).toBe("other");
  });

  it("maps comment classes onto the engine's rating rules", () => {
    const settings = defaultSettings("instagram");
    settings.comments.modes.praise = "auto";
    settings.comments.modes.spam = "auto";
    const reply = commentReplySettings(settings);
    expect(
      reply.ratingRules.find((r) => r.rating === CLASS_STARS.praise)?.mode,
    ).toBe("auto");
    expect(
      reply.ratingRules.find((r) => r.rating === CLASS_STARS.spam)?.mode,
    ).toBe("manual");
  });
});

describe("safeguards", () => {
  const settings = { ...defaultSettings("instagram"), dailyLimit: 1 };
  const base = {
    text: "A tip",
    scheduledAt: new Date("2026-10-19T13:30:00Z"),
    settings,
    sameDay: 0,
    sameWeek: 0,
    pausedBecause: null,
    problems: [],
  };

  it("schedules auto posts and holds them when a safeguard trips", () => {
    expect(decidePost({ ...base, mode: "auto" })).toMatchObject({
      status: "scheduled",
      held: null,
    });
    expect(decidePost({ ...base, mode: "approval" }).status).toBe(
      "pending_approval",
    );
    expect(decidePost({ ...base, mode: "manual" }).status).toBe("draft");
    expect(decidePost({ ...base, mode: "auto", sameDay: 1 }).held).toContain(
      "daily limit",
    );
    expect(
      decidePost({ ...base, mode: "auto", text: "Call the police" }).held,
    ).toContain("police");
    expect(
      decidePost({ ...base, mode: "auto", pausedBecause: "Paused" }).held,
    ).toBe("Paused");
  });

  it("moves posts out of quiet hours", () => {
    const night = new Date("2026-10-19T17:30:00Z");
    const out = decidePost({ ...base, mode: "auto", scheduledAt: night });
    expect(localParts(out.scheduledAt, "Asia/Kolkata").hour).toBe(8);
  });

  it("detects a sharp engagement drop", () => {
    const metrics = (likes: number) => ({
      reach: 1000,
      impressions: 1200,
      likes,
      comments: 0,
      shares: 0,
      saves: 0,
      videoPlays: 0,
    });
    const posts = Array.from({ length: 10 }, (_, i) => ({
      publishedAt: new Date(Date.UTC(2026, 9, 1 + i)),
      metrics: metrics(i >= 7 ? 10 : 100),
    }));
    expect(engagementDrop(posts)).toEqual({ recent: 1, baseline: 10 });
    expect(engagementDrop(posts.slice(0, 7))).toBeNull();
  });
});

describe("best time and calendar", () => {
  it("learns the best hour from engagement and falls back to category defaults", () => {
    expect(defaultBestTimes("instagram", "Dental clinic").slots[0]!.hour).toBe(
      10,
    );
    const posts = Array.from({ length: 8 }, (_, i) => ({
      publishedAt: zonedTime(
        `2026-10-0${i + 1}`,
        i % 2 ? 19 : 9,
        0,
        "Asia/Kolkata",
      ),
      metrics: {
        reach: 1000,
        impressions: 1000,
        likes: i % 2 ? 200 : 20,
        comments: 0,
        shares: 0,
        saves: 0,
        videoPlays: 0,
      },
    }));
    const times = computeBestTimes(posts, "Asia/Kolkata", "instagram", "");
    expect(times.source).toBe("own");
    expect(times.slots[0]!.hour).toBe(19);
    expect(times.heatmap).toHaveLength(7);
  });

  it("plans a week with festivals at the best times", () => {
    const brand = {
      ...DEFAULT_BRAND_KIT,
      name: "Sharma Dental",
      topics: ["braces"],
      offers: ["Free check-up"],
    };
    expect(
      festivalsBetween("2026-10-19", "2026-10-25").map((f) => f.name),
    ).toEqual(["Dussehra"]);
    const slots = planWeek({
      weekStart: "2026-10-19",
      timezone: "Asia/Kolkata",
      platform: "instagram",
      postsPerWeek: 4,
      formats: ["image", "carousel", "reel"],
      bestTimes: defaultBestTimes("instagram", "Dental clinic"),
      brand,
      now: new Date("2026-10-17T00:00:00Z"),
    });
    expect(slots).toHaveLength(4);
    expect(slots.find((s) => s.contentType === "festival")).toMatchObject({
      day: "2026-10-20",
      festival: "Dussehra",
      format: "image",
    });
    expect(new Set(slots.map((s) => s.day)).size).toBe(4);
    for (const s of slots)
      expect(localParts(s.at, "Asia/Kolkata").hour).toBe(10);
    const late = planWeek({
      weekStart: "2026-10-19",
      timezone: "Asia/Kolkata",
      platform: "facebook",
      postsPerWeek: 4,
      formats: ["image", "text"],
      bestTimes: defaultBestTimes("facebook", ""),
      brand,
      now: new Date("2026-10-23T00:00:00Z"),
    });
    expect(late.every((s) => s.day >= "2026-10-23")).toBe(true);
  });
});

describe("brand template", () => {
  it("wraps headlines and renders an escaped SVG", () => {
    expect(wrap("one two three four five six", 9, 2)).toEqual([
      "one two",
      "three…",
    ]);
    const svg = brandSlideSvg({
      headline: "Smiles & <braces>",
      kicker: "Tip",
      footer: "Sharma Dental",
      kit: {
        ...DEFAULT_BRAND_KIT,
        colors: { primary: "bad", secondary: "#FFFFFF", accent: "#E4572E" },
      },
      format: "square",
      slide: 0,
      slides: 3,
    });
    expect(svg).toContain('viewBox="0 0 1080 1080"');
    expect(svg).toContain("Smiles &amp; &lt;braces&gt;");
    expect(svg).toContain(DEFAULT_BRAND_KIT.colors.primary);
    expect(svg).not.toContain("<script");
    expect(
      slideHeadlines(
        "Brush well",
        "Two minutes. Twice a day. #tips",
        "Book now",
        3,
      ),
    ).toEqual(["Brush well", "Two minutes.", "Book now"]);
  });
});
