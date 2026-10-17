"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import {
  type AutopostContentType,
  type AutopostFormat,
  type AutopostPost,
  type SocialPlatform,
  useAutopostAction,
  useBrandKit,
  useCreateAutopost,
  useDeleteAutopost,
  useRegenerateAutopost,
  useUpdateAutopost,
  useWriteAutopost,
} from "@/lib/api/autopost";
import { errorMessage } from "@/lib/api/errors";
import { useCreatives, useUploadCreative } from "@/lib/api/queries";
import { DateTimePicker } from "@/features/business/date-time-picker";
import { Select } from "@/features/replyly/select";
import { Seg, Spinner, Toggle, useToast } from "@/features/replyly/ui";

import { AccountSelect, Field, MUTED, StatusPill, fmtWhen } from "./common";
import { CONTENT_LABEL, CONTENT_TYPES, FORMAT_HINT, FORMAT_LABEL, PLATFORMS } from "./platform";
import { PostPreview } from "./preview";
import { useSocialAccounts } from "./shell";

type When = "draft" | "approval" | "schedule" | "now";

interface Item {
  creativeId: string | null;
  url: string;
  kind: "image" | "video";
}

interface Draft {
  accountId: string;
  format: AutopostFormat;
  contentType: AutopostContentType;
  idea: string;
  caption: string;
  hashtags: string;
  firstComment: string;
  altText: string;
  media: Item[];
  link: string;
  when: When;
  scheduledAt: string | null;
  generateImage: boolean;
}

const splitTags = (s: string) =>
  s
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, "").trim())
    .filter(Boolean);

const MEDIA_FORMATS: AutopostFormat[] = [
  "image",
  "carousel",
  "multi_image",
  "reel",
  "story",
  "video",
];
const IMAGE_FORMATS: AutopostFormat[] = ["image", "carousel", "multi_image", "story"];

function fromPost(p: AutopostPost): Draft {
  return {
    accountId: p.accountId,
    format: p.format,
    contentType: p.contentType,
    idea: p.idea ?? "",
    caption: p.caption,
    hashtags: p.hashtags.map((t) => `#${t}`).join(" "),
    firstComment: p.firstComment ?? "",
    altText: p.altText ?? "",
    media: p.media.map((m) => ({ creativeId: m.creativeId, url: m.url, kind: m.kind })),
    link: p.link ?? "",
    when: p.status === "scheduled" ? "schedule" : "approval",
    scheduledAt: p.scheduledAt,
    generateImage: false,
  };
}

function Library({
  selected,
  onPick,
  video,
}: {
  selected: Item[];
  onPick: (item: Item) => void;
  video: boolean;
}) {
  const toast = useToast();
  const creatives = useCreatives();
  const upload = useUploadCreative();
  const input = useRef<HTMLInputElement>(null);
  const list = (creatives.data?.data ?? []).filter((c) => (video ? true : c.kind === "image"));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(64px,1fr))",
          gap: 6,
          maxHeight: 156,
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          className="rp-btn-light"
          style={{ aspectRatio: "1 / 1", padding: 4, fontSize: 12, justifyContent: "center" }}
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? <Spinner size={11} dark /> : "+ Upload"}
        </button>
        {list.map((c) => {
          const on = selected.some((s) => s.creativeId === c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              aria-label={c.name}
              onClick={() => onPick({ creativeId: c.id, url: c.url, kind: c.kind })}
              style={{
                padding: 0,
                border: on ? "2px solid #191917" : "1px solid #E6E4DF",
                borderRadius: 8,
                overflow: "hidden",
                aspectRatio: "1 / 1",
                cursor: "pointer",
                background: "#EFEDE8",
                position: "relative",
              }}
            >
              {c.kind === "video" ? (
                <span style={{ fontSize: 11, color: MUTED }}>▶ Video</span>
              ) : (
                <Image
                  unoptimized
                  src={c.url}
                  alt=""
                  width={80}
                  height={80}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              )}
              {on ? (
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    right: 3,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#191917",
                    color: "#fff",
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={
          video
            ? "image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
            : "image/png,image/jpeg,image/webp"
        }
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          upload.mutate(
            { file },
            {
              onSuccess: (c) => onPick({ creativeId: c.id, url: c.url, kind: c.kind }),
              onError: (err) => toast(errorMessage(err)),
            },
          );
        }}
      />
    </div>
  );
}

export function Composer({
  platform,
  post,
  accountId,
  date,
  onDone,
}: {
  platform: SocialPlatform;
  post?: AutopostPost;
  accountId?: string;
  date?: string | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const info = PLATFORMS[platform];
  const { accounts, label } = useSocialAccounts(platform);
  const [d, setD] = useState<Draft>(() =>
    post
      ? fromPost(post)
      : {
          accountId: accountId ?? accounts[0]?.id ?? "",
          format: info.formats[0]!,
          contentType: "tip",
          idea: "",
          caption: "",
          hashtags: "",
          firstComment: "",
          altText: "",
          media: [],
          link: "",
          when: date ? "schedule" : "approval",
          scheduledAt: date ?? null,
          generateImage: false,
        },
  );
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const brand = useBrandKit(d.accountId || undefined);
  const write = useWriteAutopost();
  const create = useCreateAutopost();
  const update = useUpdateAutopost();
  const action = useAutopostAction();
  const regenerate = useRegenerateAutopost();
  const remove = useDeleteAutopost();
  const busy =
    create.isPending ||
    update.isPending ||
    action.isPending ||
    regenerate.isPending ||
    remove.isPending;
  const editable =
    !post || ["draft", "pending_approval", "scheduled", "failed"].includes(post.status);
  const hashtags = splitTags(d.hashtags);
  const length = [d.caption.trim(), hashtags.map((t) => `#${t}`).join(" ")]
    .filter(Boolean)
    .join("\n\n").length;
  const usesMedia = MEDIA_FORMATS.includes(d.format);
  const multi = d.format === "carousel" || d.format === "multi_image";
  const videoOk = d.format !== "image" && d.format !== "multi_image";
  const account = accounts.find((a) => a.id === d.accountId);

  function pick(item: Item) {
    setD((x) => {
      const exists = x.media.some((m) => m.url === item.url);
      if (exists) return { ...x, media: x.media.filter((m) => m.url !== item.url) };
      if (!multi) return { ...x, media: [item], generateImage: false };
      return { ...x, media: [...x.media, item].slice(0, 10), generateImage: false };
    });
  }

  function aiWrite() {
    if (!d.idea.trim()) {
      toast("Describe the idea first");
      return;
    }
    write.mutate(
      {
        accountId: d.accountId,
        format: d.format,
        contentType: d.contentType,
        idea: d.idea,
        avoid: d.caption || undefined,
      },
      {
        onSuccess: (w) =>
          setD((x) => ({
            ...x,
            caption: w.caption,
            hashtags: w.hashtags.map((t) => `#${t}`).join(" "),
            firstComment: d.format === "story" ? "" : (w.firstComment ?? ""),
            altText: w.altText ?? "",
          })),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  }

  const fields = {
    contentType: d.contentType,
    idea: d.idea || null,
    caption: d.caption,
    hashtags,
    firstComment: d.format === "story" ? null : d.firstComment.trim() || null,
    altText: d.altText.trim() || null,
    media: d.media.map((m) =>
      m.creativeId ? { creativeId: m.creativeId } : { url: m.url, kind: m.kind },
    ),
    link: d.format === "link" ? d.link.trim() || null : null,
  };

  function done(message: string) {
    toast(message);
    onDone();
  }

  function submit(when: When) {
    if (post) {
      update.mutate(
        {
          id: post.id,
          format: d.format,
          ...fields,
          scheduledAt: d.scheduledAt,
        },
        {
          onSuccess: () => done("Saved"),
          onError: (err) => toast(errorMessage(err)),
        },
      );
      return;
    }
    create.mutate(
      {
        accountId: d.accountId,
        format: d.format,
        ...fields,
        when,
        scheduledAt: when === "schedule" || when === "approval" ? d.scheduledAt : null,
        generateImage: d.generateImage && !d.media.length,
      },
      {
        onSuccess: (p) =>
          done(
            p.status === "published"
              ? `Posted on ${info.name}`
              : p.status === "scheduled"
                ? `Scheduled for ${fmtWhen(p.scheduledAt!)}`
                : p.status === "pending_approval"
                  ? "Added to the calendar for approval"
                  : "Draft saved",
          ),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  }

  function run(kind: "approve" | "publish" | "cancel" | "retry") {
    if (!post) return;
    action.mutate(
      { id: post.id, action: kind },
      {
        onSuccess: (p) =>
          done(
            kind === "publish"
              ? `Posted on ${info.name}`
              : kind === "approve"
                ? `Approved · goes out ${fmtWhen(p.scheduledAt!)}`
                : kind === "retry"
                  ? "Retrying now"
                  : "Cancelled",
          ),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  }

  const tagSets = brand.data?.kit.hashtagSets ?? [];

  return (
    <div
      className="rp-card"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,400px),1fr))",
      }}
    >
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong>{post ? "Edit post" : "New post"}</strong>
            {post ? <StatusPill status={post.status} /> : null}
          </span>
          {!post && accounts.length > 1 ? (
            <AccountSelect
              platform={platform}
              value={d.accountId}
              onChange={(v) => set("accountId", v)}
            />
          ) : (
            <span style={{ fontSize: 12.5, color: MUTED }}>{label(d.accountId)}</span>
          )}
        </div>
        {post?.heldReason ? (
          <span
            style={{
              fontSize: 12.5,
              color: "#8A5A00",
              background: "#FBF3E2",
              padding: "8px 10px",
              borderRadius: 8,
            }}
          >
            {post.heldReason}
          </span>
        ) : null}
        {post?.error ? (
          <span
            style={{
              fontSize: 12.5,
              color: "#B42318",
              background: "#FDF0EE",
              padding: "8px 10px",
              borderRadius: 8,
            }}
          >
            {post.error}
          </span>
        ) : null}
        <Field label="Format" hint={FORMAT_HINT[d.format]}>
          <Seg
            label="Format"
            value={d.format}
            small
            onChange={(v) =>
              setD((x) => ({
                ...x,
                format: v,
                media:
                  v === x.format
                    ? x.media
                    : x.media.slice(0, v === "carousel" || v === "multi_image" ? 10 : 1),
              }))
            }
            options={info.formats.map((f) => ({ id: f, label: FORMAT_LABEL[f] }))}
          />
        </Field>
        <div
          style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr)", gap: 10 }}
        >
          <Field label="Type">
            <Select
              label="Content type"
              value={d.contentType}
              onChange={(v) => set("contentType", v as AutopostContentType)}
              block
              align="start"
              options={CONTENT_TYPES.map((c) => ({ value: c, label: CONTENT_LABEL[c] }))}
            />
          </Field>
          <Field label="Idea">
            <span style={{ display: "flex", gap: 6 }}>
              <input
                className="rp-input"
                value={d.idea}
                onChange={(e) => set("idea", e.target.value)}
                placeholder="Free check-up camp this Sunday"
              />
              <button
                type="button"
                className="rp-btn-light"
                style={{ padding: "6px 10px", whiteSpace: "nowrap" }}
                disabled={write.isPending || !editable || !d.accountId}
                onClick={aiWrite}
              >
                {write.isPending ? <Spinner size={11} dark /> : "✦"} Write
              </button>
            </span>
          </Field>
        </div>
        <Field
          label="Caption"
          hint={`${length}/${info.captionMax}${platform === "instagram" ? ` · ${hashtags.length}/30 hashtags` : ""}`}
        >
          <textarea
            className="rp-textarea"
            rows={6}
            value={d.caption}
            disabled={!editable}
            onChange={(e) => set("caption", e.target.value)}
            placeholder={
              d.format === "story"
                ? "Stories don’t show a caption."
                : "Write the caption, or describe the idea and press Write."
            }
            style={{ resize: "vertical" }}
          />
        </Field>
        <Field label="Hashtags">
          <input
            className="rp-input"
            value={d.hashtags}
            disabled={!editable}
            onChange={(e) => set("hashtags", e.target.value)}
            placeholder="#dentist #patna"
          />
          {tagSets.length ? (
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {tagSets.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className="rp-chip"
                  onClick={() =>
                    set(
                      "hashtags",
                      [...new Set([...hashtags, ...s.tags])].map((t) => `#${t}`).join(" "),
                    )
                  }
                >
                  + {s.name}
                </button>
              ))}
            </span>
          ) : null}
        </Field>
        {usesMedia ? (
          <Field
            label={multi ? `Media · ${d.media.length}/10` : "Media"}
            hint={
              IMAGE_FORMATS.includes(d.format) ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Toggle
                    label="Design a brand image"
                    on={d.generateImage && !d.media.length}
                    disabled={Boolean(d.media.length) || Boolean(post)}
                    onChange={() => set("generateImage", !d.generateImage)}
                  />
                  {post
                    ? "Use Regenerate image to redesign the brand image."
                    : "Or let TreeVook design a brand image from your colours and the idea."}
                </span>
              ) : (
                "Upload your own video. Reels work best at 9:16."
              )
            }
          >
            <Library selected={d.media} onPick={pick} video={videoOk} />
          </Field>
        ) : null}
        {d.format === "link" ? (
          <Field label="Link">
            <input
              className="rp-input"
              value={d.link}
              onChange={(e) => set("link", e.target.value)}
              placeholder="https://"
            />
          </Field>
        ) : null}
        {d.format !== "story" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="First comment">
              <input
                className="rp-input"
                value={d.firstComment}
                onChange={(e) => set("firstComment", e.target.value)}
                placeholder="Questions? Ask below 👇"
              />
            </Field>
            <Field label="Alt text">
              <input
                className="rp-input"
                value={d.altText}
                onChange={(e) => set("altText", e.target.value)}
                placeholder="Describe the image"
              />
            </Field>
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            paddingTop: 10,
            borderTop: "1px solid #EFEDE8",
          }}
        >
          {!post ? (
            <Seg
              label="When"
              value={d.when}
              small
              onChange={(v) => set("when", v)}
              options={[
                { id: "approval", label: "Add for approval" },
                { id: "schedule", label: "Schedule" },
                { id: "now", label: "Post now" },
                { id: "draft", label: "Draft" },
              ]}
            />
          ) : null}
          {d.when === "schedule" || d.when === "approval" || post ? (
            <Field
              label={post ? "Goes out" : d.when === "approval" ? "Suggested time" : "Publish at"}
              hint={
                !post && d.when === "approval" && !d.scheduledAt
                  ? "Leave empty to use the next best time."
                  : undefined
              }
            >
              <DateTimePicker
                label="Publish at"
                value={d.scheduledAt}
                onChange={(v) => set("scheduledAt", v)}
              />
            </Field>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" className="rp-btn-text" onClick={onDone}>
              Close
            </button>
            {post ? (
              <>
                {editable && post.status !== "published" ? (
                  <button
                    type="button"
                    className="rp-btn-text"
                    style={{ color: "#B42318" }}
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Delete this post?"))
                        remove.mutate(post.id, {
                          onSuccess: () => done("Deleted"),
                          onError: (err) => toast(errorMessage(err)),
                        });
                    }}
                  >
                    Delete
                  </button>
                ) : null}
                {editable ? (
                  <>
                    <button
                      type="button"
                      className="rp-btn-text"
                      disabled={busy}
                      onClick={() =>
                        regenerate.mutate(
                          { id: post.id, part: "caption" },
                          {
                            onSuccess: (p) => setD(fromPost(p)),
                            onError: (err) => toast(errorMessage(err)),
                          },
                        )
                      }
                    >
                      New caption
                    </button>
                    {IMAGE_FORMATS.includes(post.format) ? (
                      <button
                        type="button"
                        className="rp-btn-text"
                        disabled={busy}
                        onClick={() =>
                          regenerate.mutate(
                            { id: post.id, part: "image" },
                            {
                              onSuccess: (p) => setD(fromPost(p)),
                              onError: (err) => toast(errorMessage(err)),
                            },
                          )
                        }
                      >
                        New image
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rp-btn-light"
                      style={{ padding: "8px 14px" }}
                      disabled={busy}
                      onClick={() => submit("approval")}
                    >
                      Save
                    </button>
                  </>
                ) : null}
                {post.status === "scheduled" ? (
                  <button
                    type="button"
                    className="rp-btn-light"
                    style={{ padding: "8px 14px" }}
                    disabled={busy}
                    onClick={() => run("cancel")}
                  >
                    Unschedule
                  </button>
                ) : null}
                {post.status === "failed" ? (
                  <button
                    type="button"
                    className="rp-btn"
                    style={{ padding: "8px 14px" }}
                    disabled={busy}
                    onClick={() => run("retry")}
                  >
                    Retry
                  </button>
                ) : null}
                {post.status === "pending_approval" || post.status === "draft" ? (
                  <button
                    type="button"
                    className="rp-btn"
                    style={{ padding: "8px 14px" }}
                    disabled={busy}
                    onClick={() => run("approve")}
                  >
                    {action.isPending ? <Spinner size={11} /> : null}
                    Approve
                  </button>
                ) : null}
                {editable && post.status !== "failed" ? (
                  <button
                    type="button"
                    className="rp-btn"
                    style={{ padding: "8px 14px" }}
                    disabled={busy}
                    onClick={() => run("publish")}
                  >
                    Post now
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                className="rp-btn"
                style={{ padding: "8px 16px" }}
                disabled={busy || !d.accountId || (d.when === "schedule" && !d.scheduledAt)}
                onClick={() => submit(d.when)}
              >
                {busy ? <Spinner size={11} /> : null}
                {d.when === "now"
                  ? `Post to ${info.name}`
                  : d.when === "schedule"
                    ? "Schedule"
                    : d.when === "draft"
                      ? "Save draft"
                      : "Add to calendar"}
              </button>
            )}
          </div>
          {post?.problems.length ? (
            <span style={{ fontSize: 12, color: "#B42318" }}>{post.problems.join(" ")}</span>
          ) : null}
        </div>
      </div>
      <div
        style={{
          padding: 18,
          background: "#F7F6F3",
          borderLeft: "1px solid #EFEDE8",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minWidth: 0,
        }}
      >
        <span className="rp-label">
          {info.name} preview · {FORMAT_LABEL[d.format]}
        </span>
        <div style={{ maxWidth: 380, width: "100%" }}>
          <PostPreview
            platform={platform}
            format={d.format}
            account={account?.username ?? account?.name ?? brand.data?.kit.name ?? info.name}
            caption={d.format === "story" ? "" : d.caption}
            hashtags={d.format === "story" ? [] : hashtags}
            media={d.media.map((m) => ({ url: m.url, kind: m.kind }))}
            link={d.link || null}
            firstComment={d.format === "story" ? null : d.firstComment || null}
          />
        </div>
        {d.generateImage && !d.media.length ? (
          <span style={{ fontSize: 12, color: MUTED }}>
            A brand image is designed when you save.
          </span>
        ) : null}
      </div>
    </div>
  );
}
