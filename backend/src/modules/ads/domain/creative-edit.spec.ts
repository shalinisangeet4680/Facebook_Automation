import { AdCreativeSummary } from "@modules/meta/domain/ports/meta-ads";

import { editCreative } from "./creative-edit";
import { summarizeTargeting } from "./targeting-summary";

const current: AdCreativeSummary = {
  id: "cr1",
  kind: "link",
  title: "Old headline",
  body: "Old text",
  description: null,
  linkUrl: "https://example.com/",
  imageUrl: "https://example.com/a.png",
  imageHash: null,
  thumbnailUrl: "https://example.com/a.png",
  callToAction: "LEARN_MORE",
  pageId: "p1",
  instagramId: "ig1",
  postId: null,
};
const fallback = { pageId: "p-fallback", instagramId: null };

describe("editCreative", () => {
  describe("video ads", () => {
    const video: AdCreativeSummary = {
      ...current,
      kind: "video",
      videoId: "v1",
      imageUrl: "https://cdn.example.com/thumb.jpg",
      leadFormId: "f1",
      callToAction: "SIGN_UP",
    };

    it("keeps the video when only the text changes", () => {
      const result = editCreative(video, { primaryText: "Watch" }, fallback);
      expect(result).toMatchObject({
        ok: true,
        changed: ["primaryText"],
        creative: {
          videoId: "v1",
          message: "Watch",
          imageUrl: "https://cdn.example.com/thumb.jpg",
          leadFormId: "f1",
        },
      });
    });

    it("switches to a new video with its own thumbnail", () => {
      const result = editCreative(
        current,
        {
          video: {
            videoId: "v2",
            thumbnailUrl: "https://cdn.example.com/v2.jpg",
          },
        },
        fallback,
      );
      expect(result).toMatchObject({
        ok: true,
        changed: ["video"],
        creative: {
          videoId: "v2",
          imageUrl: "https://cdn.example.com/v2.jpg",
          imageHash: null,
        },
      });
    });

    it("needs the video id and a thumbnail", () => {
      expect(
        editCreative(
          { ...video, videoId: null },
          { primaryText: "x" },
          fallback,
        ).ok,
      ).toBe(false);
      const noThumb = editCreative(
        { ...current, imageUrl: null },
        { video: { videoId: "v2", thumbnailUrl: null } },
        fallback,
      );
      expect(!noThumb.ok && noThumb.message).toContain("thumbnail");
    });
  });

  it("keeps what wasn't edited and builds a full link creative", () => {
    const result = editCreative(
      current,
      { headline: "New headline", callToAction: "SIGN_UP" },
      fallback,
    );
    expect(result).toEqual({
      ok: true,
      changed: ["headline", "callToAction"],
      creative: {
        pageId: "p1",
        instagramId: "ig1",
        message: "Old text",
        headline: "New headline",
        description: null,
        link: "https://example.com/",
        imageUrl: "https://example.com/a.png",
        imageHash: null,
        callToAction: "SIGN_UP",
        existingPost: null,
      },
    });
  });

  it("keeps an uploaded image hash unless a new image is chosen", () => {
    const hashed = { ...current, imageHash: "abc123" };
    const kept = editCreative(hashed, { primaryText: "New text" }, fallback);
    expect(kept.ok && kept.creative).toMatchObject({
      imageHash: "abc123",
      imageUrl: null,
    });
    const swapped = editCreative(
      hashed,
      { imageUrl: "https://cdn.example.com/b.png" },
      fallback,
    );
    expect(swapped.ok && swapped.creative).toMatchObject({
      imageHash: null,
      imageUrl: "https://cdn.example.com/b.png",
    });
    expect(swapped.ok && swapped.changed).toEqual(["image"]);
  });

  it("clears the description with an empty value and falls back to the workspace Page", () => {
    const result = editCreative(
      { ...current, description: "Old", pageId: null },
      { description: "" },
      fallback,
    );
    expect(result.ok && result.creative).toMatchObject({
      description: null,
      pageId: "p-fallback",
    });
  });

  it("refuses post-based and unsupported ads", () => {
    const post = editCreative(
      { ...current, kind: "post", postId: "p1_9" },
      { headline: "x" },
      fallback,
    );
    expect(post.ok).toBe(false);
    expect(!post.ok && post.message).toContain(
      "existing Facebook or Instagram post",
    );
    expect(
      editCreative({ ...current, kind: "other" }, { headline: "x" }, fallback)
        .ok,
    ).toBe(false);
    expect(editCreative(null, { headline: "x" }, fallback).ok).toBe(false);
  });

  it("validates links, images, buttons and no-op edits", () => {
    expect(editCreative(current, { link: "ftp://x" }, fallback).ok).toBe(false);
    expect(
      editCreative(
        current,
        { imageUrl: "http://localhost/media/a.png" },
        fallback,
      ).ok,
    ).toBe(false);
    expect(
      editCreative(current, { callToAction: "BUY_A_BOAT" }, fallback).ok,
    ).toBe(false);
    expect(
      editCreative(current, { headline: "Old headline" }, fallback),
    ).toEqual({
      ok: false,
      message: "Nothing changed in this ad.",
    });
  });
});

describe("summarizeTargeting", () => {
  it("describes places, ages, gender and interests", () => {
    expect(
      summarizeTargeting({
        age_min: 30,
        age_max: 65,
        genders: [2],
        geo_locations: {
          cities: [{ key: "1", name: "Patna" }],
          regions: [{ key: "1730", name: "Bihar" }],
          countries: ["IN"],
        },
        flexible_spec: [
          { interests: [{ id: "1", name: "Physician" }] },
          { work_positions: [{ id: "2", name: "Dentist" }] },
        ],
      }),
    ).toEqual({
      locations: "Patna, Bihar, IN",
      age: "30–65+",
      gender: "Women",
      audience: "Physician, Dentist",
    });
    expect(summarizeTargeting({})).toEqual({
      locations: null,
      age: null,
      gender: null,
      audience: null,
    });
  });
});
