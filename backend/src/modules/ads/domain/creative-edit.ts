import {
  AdCreativeSummary,
  CreativeInput,
} from "@modules/meta/domain/ports/meta-ads";

import { CALLS_TO_ACTION } from "./goals";

export interface CreativeEdit {
  primaryText?: string;
  headline?: string;
  description?: string | null;
  callToAction?: string;
  link?: string;
  imageUrl?: string;
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
  if (current.kind !== "link") {
    return {
      ok: false,
      message:
        "Only single-image link ads can be edited here. Edit this ad in Meta Ads Manager.",
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
  if (newImage && !newImage.startsWith("https://")) {
    return {
      ok: false,
      message:
        "This image isn't on a public https address, so Meta can't use it.",
    };
  }
  const imageHash = newImage ? null : current.imageHash;
  const imageUrl = newImage ?? (imageHash ? null : current.imageUrl);
  if (!imageHash && !imageUrl) {
    return { ok: false, message: "Add an image for this ad." };
  }

  const changed = [
    message !== clean(current.body) && "primaryText",
    headline !== clean(current.title) && "headline",
    description !== clean(current.description) && "description",
    callToAction !== clean(current.callToAction) && "callToAction",
    link !== clean(current.linkUrl) && "link",
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
    },
  };
}
