"use client";

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
import { ago, until } from "@/features/replyly/tokens";
import { useToast } from "@/features/replyly/ui";

import { Spin } from "./location-ui";
import { Avatar, Skel, Stars } from "./ui";

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
    <article className="gb-card gb-lp-review" data-failed={failed}>
      <div className="gb-lp-review-head">
        <div className="gb-lp-review-who">
          <Avatar name={r.authorName || "G"} photo={r.authorPhoto} size={34} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span className="gb-lp-review-name">
              <span>{r.authorName || "A Google user"}</span>
              <Stars n={r.stars} size={12} />
            </span>
            <span className="gb-lp-review-sub">
              <span className="gb-lp-review-dot" style={{ background: color }} />
              {locationName} · {ago(r.reviewedAt)}
            </span>
          </div>
        </div>
        {topic ? <span className="gb-pill gb-pill-grey">{topic}</span> : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <p className="gb-lp-review-text">
          {r.text || <span style={{ color: "var(--gb-faint)" }}>Rating only, no text.</span>}
        </p>
        {r.editedAfterReply && r.reply ? (
          <span style={{ fontSize: 12, color: "var(--gb-amber)" }}>
            Edited after your reply{r.starsBeforeEdit ? ` (was ${r.starsBeforeEdit}★)` : ""}.
            Previous reply: “{r.reply.text}”
          </span>
        ) : null}
      </div>

      {pending ? (
        <div className="gb-lp-draft">
          <div className="gb-lp-draft-head">
            <span className="gb-lp-draft-label">{label}</span>
            <span style={{ color: len > MAX ? "var(--gb-red)" : "var(--gb-faint)" }}>{len}</span>
          </div>
          {draft.isPending ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0 10px" }}
            >
              <Skel h={14} />
              <Skel h={14} w="86%" />
              <Skel h={14} w="58%" />
            </div>
          ) : (
            <textarea
              className="gb-textarea"
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
            />
          )}
          {!editing && (r.draft?.note || r.state === "scheduled") ? (
            <span
              style={{
                fontSize: 12,
                color: r.state === "scheduled" ? "var(--gb-green)" : "var(--gb-amber)",
              }}
            >
              {r.state === "scheduled" && r.draft?.sendAt
                ? `Posts automatically ${until(r.draft.sendAt)}. Approve to post now.`
                : r.draft?.note}
            </span>
          ) : null}
          <div className="gb-lp-actions">
            {editing ? (
              <button
                type="button"
                className="gb-btn gb-btn-ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="gb-btn"
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
              className="gb-btn"
              disabled={busy}
              onClick={() =>
                draft.mutate({ reviewId: r.id, rewrite: Boolean(text.trim()) }, { onError: fail })
              }
            >
              {text.trim() ? "Rewrite" : "Draft"}
            </button>
            <button
              type="button"
              className="gb-btn gb-btn-green"
              disabled={busy || len > MAX}
              onClick={post}
            >
              {approve.isPending || replyNow.isPending ? <Spin /> : null}
              {editing ? "Update reply" : "Approve & post"}
            </button>
          </div>
        </div>
      ) : null}

      {failed ? (
        <div className="gb-lp-failed">
          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontWeight: 600, color: "#7a2a08", fontSize: 13 }}>
              Reply wasn’t posted
            </span>
            <span
              className="gb-lp-mono"
              style={{ fontSize: 11, color: "var(--gb-red)", overflowWrap: "anywhere" }}
            >
              {r.draft?.error ?? "Google didn’t accept the reply."}
            </span>
          </div>
          <button
            type="button"
            className="gb-btn gb-btn-dark"
            disabled={approve.isPending || !r.draft}
            onClick={() =>
              r.draft &&
              approve.mutate(
                { replyId: r.draft.id, text },
                { onSuccess: () => toast("Posted on retry"), onError: fail },
              )
            }
          >
            {approve.isPending ? <Spin /> : null}
            Retry
          </button>
        </div>
      ) : null}

      {replied ? (
        <div className="gb-lp-replied" data-skipped={r.state === "skipped"}>
          <span className="gb-lp-replied-head">
            <span>
              {r.state === "skipped" ? "Skipped" : "Replied"} · {byLine(r)}
            </span>
            <span style={{ display: "flex", gap: 12 }}>
              {r.state === "skipped" ? (
                <button
                  type="button"
                  className="gb-link gb-lp-mini"
                  disabled={skip.isPending}
                  onClick={() => skip.mutate({ reviewId: r.id, undo: true }, { onError: fail })}
                >
                  Undo
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="gb-link gb-lp-mini"
                    onClick={() => {
                      setText(r.reply?.text ?? "");
                      setEditing(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="gb-link gb-lp-mini"
                    style={{ color: "var(--gb-red)" }}
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
          {r.reply ? <span className="gb-lp-replied-text">{r.reply.text}</span> : null}
        </div>
      ) : null}
    </article>
  );
}
