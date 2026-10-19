import {
  AdCreativeSummary,
  CreativeInput,
} from "@modules/meta/domain/ports/meta-ads";

import { CALLS_TO_ACTION, LEAD_FORM_CALLS_TO_ACTION } from "./goals";

export interface CreativeEdit {
  primaryText?: string;
  headline?: string;
  description?: string | null;
  callToAction?: string;
  link?: string;
  imageUrl?: string;
  video?: { videoId: string; thumbnailUrl: string | null };
}

export type CreativeEditResult =
  | { ok: true; creative: CreativeInput; changed: string[] }
  | { ok: false; message: string };

const clean = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};

export function editCreative(
  current: AdCreativeSummary | null,
  edit: CreativeEdit,
  fallback: { pageId: string | null; instagramId: string | null },
): CreativeEditResult {
  if (!current) {
    return { ok: false, message: "This ad has no creative to edit." };
  }
  if (current.kind === "post") {
    return {
      ok: false,
      message:
        "This ad was created from an existing Facebook or Instagram post, so its text and image can't be changed here. Edit the post on Facebook or Instagram, or create a new ad.",
    };
  }
  if (current.kind !== "link" && current.kind !== "video") {
    return {
      ok: false,
      message:
        "Only single-image and video ads can be edited here. Edit this ad in Meta Ads Manager.",
    };
  }
  const pageId = current.pageId ?? fallback.pageId;
  if (!pageId) {
    return {
      ok: false,
      message: "Select a Facebook Page in Setup before editing ads.",
    };
  }
  const message = clean(edit.primaryText) ?? clean(current.body);
  const headline = clean(edit.headline) ?? clean(current.title);
  const link = clean(edit.link) ?? clean(current.linkUrl);
  const callToAction =
    clean(edit.callToAction) ?? clean(current.callToAction) ?? "LEARN_MORE";
  const description =
    edit.description !== undefined
      ? clean(edit.description)
      : clean(current.description);
  const newImage = clean(edit.imageUrl);
  if (!message) return { ok: false, message: "Add the primary text." };
  if (!headline) return { ok: false, message: "Add a headline." };
  if (!link || !/^https?:\/\//i.test(link)) {
    return {
      ok: false,
      message: "Add the web address people should visit (https://…).",
    };
  }
  if (!(CALLS_TO_ACTION as readonly string[]).includes(callToAction)) {
    return { ok: false, message: "Choose a supported button." };
  }
  if (
    current.leadFormId &&
    !(LEAD_FORM_CALLS_TO_ACTION as readonly string[]).includes(callToAction)
  ) {
    return {
      ok: false,
      message: `This ad opens an instant form, so its button must be one of: ${LEAD_FORM_CALLS_TO_ACTION.join(", ")}.`,
    };
  }
  if (newImage && !newImage.startsWith("https://")) {
    return {
      ok: false,
      message:
        "This image isn't on a public https address, so Meta can't use it.",
    };
  }
  const newVideo = edit.video ?? null;
  const videoId =
    newVideo?.videoId ??
    (current.kind === "video" ? (current.videoId ?? null) : null);
  if (current.kind === "video" && !videoId) {
    return {
      ok: false,
      message:
        "Meta didn't return this ad's video, so it can't be edited here. Edit it in Meta Ads Manager.",
    };
  }
  const freshImage = newImage ?? (newVideo ? newVideo.thumbnailUrl : null);
  const imageHash = freshImage || newVideo ? null : current.imageHash;
  const imageUrl = freshImage ?? (imageHash ? null : current.imageUrl);
  if (!imageHash && !imageUrl) {
    return {
      ok: false,
      message: videoId
        ? "Add a thumbnail image for this video."
        : "Add an image for this ad.",
    };
  }

  const changed = [
    message !== clean(current.body) && "primaryText",
    headline !== clean(current.title) && "headline",
    description !== clean(current.description) && "description",
    callToAction !== clean(current.callToAction) && "callToAction",
    link !== clean(current.linkUrl) && "link",
    newVideo && newVideo.videoId !== current.videoId && "video",
    newImage && newImage !== current.imageUrl && "image",
  ].filter((v): v is string => Boolean(v));
  if (!changed.length) {
    return { ok: false, message: "Nothing changed in this ad." };
  }
  return {
    ok: true,
    changed,
    creative: {
      pageId,
      instagramId: current.instagramId ?? fallback.instagramId,
      message,
      headline,
      description,
      link,
      imageUrl,
      imageHash,
      callToAction,
      existingPost: null,
      ...(current.leadFormId ? { leadFormId: current.leadFormId } : {}),
      ...(videoId ? { videoId } : {}),
    },
  };
}
