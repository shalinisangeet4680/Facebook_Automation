"use client";

import Image from "next/image";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpReview,
  useBusinessAiDraft,
  useBusinessApprove,
  useBusinessDeleteReply,
  useBusinessReply,
  useBusinessSaveDraft,
  useBusinessSkip,
  useBusinessTemplates,
} from "@/lib/api/business";
import { ago, stars, TOPIC_STYLE, until } from "@/features/replyly/tokens";
import { Spinner, useToast } from "@/features/replyly/ui";

const PENDING = new Set(["waiting", "claude", "scheduled", "unreplied"]);
const MAX = 4096;

function byLine(r: GbpReview) {
  if (r.state === "skipped") return `by you · ${ago(r.skippedAt)}`;
  const via = r.sentVia;
  if (!via) return `on Google · ${ago(r.reply?.repliedAt)}`;
  const who = via.auto ? "Auto" : via.source === "claude" ? "Claude" : "You";
  return `${who} · ${ago(via.sentAt ?? r.reply?.repliedAt)}`;
}

export function BusinessReviewCard({
  review: r,
  color,
  locationName,
}: {
  review: GbpReview;
  color: string;
  locationName: string;
}) {
  const toast = useToast();
  const templates = useBusinessTemplates();
  const skip = useBusinessSkip();
  const draft = useBusinessAiDraft();
  const approve = useBusinessApprove();
  const save = useBusinessSaveDraft();
  const replyNow = useBusinessReply();
  const remove = useBusinessDeleteReply();
  const [text, setText] = useState(r.draft?.text ?? "");
  const [synced, setSynced] = useState(r.draft?.text ?? "");
  const [editing, setEditing] = useState(false);

  if ((r.draft?.text ?? "") !== synced) {
    setSynced(r.draft?.text ?? "");
    setText(r.draft?.text ?? "");
  }

  const pending = PENDING.has(r.state) || editing;
  const failed = r.state === "failed";
  const replied = (r.state === "replied" || r.state === "skipped") && !editing;
  const topic = r.topic && r.topic !== "Other" ? r.topic : null;
  const [tagBg, tagFg] = (topic && TOPIC_STYLE[topic]) || ["#EFEDE8", "#55534E"];
  const tplName = templates.data?.data.find((t) => t.id === r.draft?.templateId)?.name;
  const label = editing
    ? "Edit your public reply"
    : !r.draft || !r.draft.text.trim()
      ? r.draft?.status === "needs_claude"
        ? "Waiting for a draft"
        : "No draft yet"
      : r.draft.source === "ai"
        ? `AI draft · ${tplName ?? "AI-written"}`
        : r.draft.source === "claude"
          ? "Drafted by Claude"
          : r.draft.source === "template"
            ? `Template · ${tplName ?? "template"}`
            : "Your draft";
  const len = [...text].length;
  const busy =
    draft.isPending ||
    approve.isPending ||
    replyNow.isPending ||
    skip.isPending ||
    remove.isPending;
  const fail = (err: unknown) => toast(errorMessage(err));

  function post() {
    if (!text.trim()) return toast("Write a reply first");
    const done = () => {
      setEditing(false);
      toast("Reply posted on Google");
    };
    if (r.draft && r.draft.status !== "needs_claude" && !editing)
      approve.mutate(
        { replyId: r.draft.id, text: text !== r.draft.text ? text : undefined },
        { onSuccess: done, onError: fail },
      );
    else replyNow.mutate({ reviewId: r.id, text }, { onSuccess: done, onError: fail });
  }

  return (
    <article
      className="rp-card"
      style={{
        padding: 18,
        borderColor: failed ? "#F0C8C2" : "#E6E4DF",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          {r.authorPhoto ? (
            <Image
              unoptimized
              src={r.authorPhoto}
              alt=""
              width={34}
              height={34}
              style={{ borderRadius: "50%", flexShrink: 0 }}
            />
          ) : (
            <span
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: "50%",
                background: "#F4F2EE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {(r.authorName.trim()[0] ?? "G").toUpperCase()}
            </span>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 500 }}>{r.authorName || "A Google user"}</span>
              <span
                style={{ color: "#C9A227", fontSize: 12, letterSpacing: 1 }}
                aria-label={`${r.stars} stars`}
              >
                {stars(r.stars)}
              </span>
            </span>
            <span
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                fontSize: 12,
                color: "#6C6962",
                flexWrap: "wrap",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 3, background: color }} />
              {locationName} · {ago(r.reviewedAt)}
            </span>
          </div>
        </div>
        {topic ? (
          <span
            style={{
              padding: "3px 9px",
              borderRadius: 999,
              background: tagBg,
              color: tagFg,
              fontSize: 11.5,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {topic}
          </span>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ lineHeight: 1.55, textWrap: "pretty", overflowWrap: "anywhere" }}>
          {r.text || <span style={{ color: "#6C6962" }}>Rating only, no text.</span>}
        </p>
        {r.editedAfterReply && r.reply ? (
          <span style={{ fontSize: 12.5, color: "#8A5A00" }}>
            Edited after your reply{r.starsBeforeEdit ? ` (was ${r.starsBeforeEdit}★)` : ""}.
            Previous reply: “{r.reply.text}”
          </span>
        ) : null}
      </div>

      {pending ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 14,
            borderRadius: 10,
            background: "#F7F6F3",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 12,
              color: "#55534E",
            }}
          >
            <span style={{ fontWeight: 500, color: "#0F6B4A" }}>{label}</span>
            <span className="rp-mono" style={{ color: len > MAX ? "#B42318" : "#6C6962" }}>
              {len}
            </span>
          </div>
          {draft.isPending ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0 10px" }}
            >
              <div className="rp-shimmer" />
              <div className="rp-shimmer" style={{ width: "86%" }} />
              <div className="rp-shimmer" style={{ width: "58%" }} />
            </div>
          ) : (
            <textarea
              aria-label={`Reply to ${r.authorName || "this reviewer"}`}
              value={text}
              rows={3}
              placeholder="Write a reply, or let AI draft one…"
              onChange={(e) => setText(e.target.value)}
              onBlur={() => {
                if (
                  !editing &&
                  r.draft &&
                  text.trim() &&
                  text !== r.draft.text &&
                  r.draft.status !== "needs_claude"
                )
                  save.mutate({ reviewId: r.id, text }, { onError: fail });
              }}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                resize: "vertical",
                fontSize: 14,
                lineHeight: 1.55,
                color: "#191917",
                outline: "none",
                padding: 0,
              }}
            />
          )}
          {!editing && (r.draft?.note || r.state === "scheduled") ? (
            <span style={{ fontSize: 12, color: r.state === "scheduled" ? "#0F6B4A" : "#8A5A00" }}>
              {r.state === "scheduled" && r.draft?.sendAt
                ? `Posts automatically ${until(r.draft.sendAt)}. Approve to post now.`
                : r.draft?.note}
            </span>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {editing ? (
              <button type="button" className="rp-btn-text" onClick={() => setEditing(false)}>
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="rp-btn-text"
                disabled={busy}
                onClick={() =>
                  skip.mutate(
                    { reviewId: r.id },
                    { onSuccess: () => toast("Skipped"), onError: fail },
                  )
                }
              >
                Skip
              </button>
            )}
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "7px 12px" }}
              disabled={busy}
              onClick={() =>
                draft.mutate({ reviewId: r.id, rewrite: Boolean(text.trim()) }, { onError: fail })
              }
            >
              {text.trim() ? "Rewrite" : "Draft"}
            </button>
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "7px 14px" }}
              disabled={busy || len > MAX}
              onClick={post}
            >
              {approve.isPending || replyNow.isPending ? <Spinner size={11} /> : null}
              {editing ? "Update reply" : "Approve & post"}
            </button>
          </div>
        </div>
      ) : null}

      {failed ? (
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            padding: "12px 14px",
            borderRadius: 10,
            background: "#FDF0EE",
            border: "1px dashed #E4A69E",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontWeight: 500, color: "#7A1A12", fontSize: 13.5 }}>
              Reply wasn’t posted
            </span>
            <span
              className="rp-mono"
              style={{ fontSize: 11.5, color: "#9A3B30", overflowWrap: "anywhere" }}
            >
              {r.draft?.error ?? "Google didn’t accept the reply."}
            </span>
          </div>
          <button
            type="button"
            className="rp-btn"
            style={{ padding: "7px 14px" }}
            disabled={approve.isPending || !r.draft}
            onClick={() =>
              r.draft &&
              approve.mutate(
                { replyId: r.draft.id, text },
                { onSuccess: () => toast("Posted on retry"), onError: fail },
              )
            }
          >
            {approve.isPending ? <Spinner size={11} /> : null}
            Retry
          </button>
        </div>
      ) : null}

      {replied ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "12px 14px",
            borderLeft: `2px solid ${r.state === "skipped" ? "#C9C5BC" : "#0F6B4A"}`,
            background: r.state === "skipped" ? "#F7F6F3" : "#F4F8F5",
            borderRadius: "0 10px 10px 0",
          }}
        >
          <span
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 12,
              color: r.state === "skipped" ? "#55534E" : "#0F6B4A",
              fontWeight: 500,
              flexWrap: "wrap",
            }}
          >
            <span>
              {r.state === "skipped" ? "Skipped" : "Replied"} · {byLine(r)}
            </span>
            <span style={{ display: "flex", gap: 10 }}>
              {r.state === "skipped" ? (
                <button
                  type="button"
                  className="rp-btn-text"
                  disabled={skip.isPending}
                  onClick={() => skip.mutate({ reviewId: r.id, undo: true }, { onError: fail })}
                >
                  Undo
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="rp-btn-text"
                    onClick={() => {
                      setText(r.reply?.text ?? "");
                      setEditing(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rp-btn-text"
                    style={{ color: "#B42318" }}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm("Delete this reply from Google? The review stays."))
                        remove.mutate(r.id, {
                          onSuccess: () => toast("Reply deleted"),
                          onError: fail,
                        });
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </span>
          </span>
          {r.reply ? (
            <span style={{ lineHeight: 1.55, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
              {r.reply.text}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
