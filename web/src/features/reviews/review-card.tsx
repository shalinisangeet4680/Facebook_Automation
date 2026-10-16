"use client";

import { AlertTriangle, Bot, Clock, Pencil, Send, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea, inputClass } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import {
  useApproveReply,
  useDiscardReply,
  usePlayTemplates,
  usePreviewReply,
  useReplyNow,
  useSaveReplyDraft,
} from "@/lib/api/queries";
import type { PlayAppDetail, PlayReview } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { REPLY_MAX, ago, languageLabel } from "./labels";
import { Stars } from "./stars";

const time = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

function StatusLine({ review }: { review: PlayReview }) {
  const d = review.draft;
  if (!d) return null;
  const line =
    review.state === "scheduled" ? (
      <>
        <Clock className="size-3.5" /> Sends automatically{" "}
        {d.sendAt ? time.format(new Date(d.sendAt)) : "soon"}
      </>
    ) : review.state === "claude" ? (
      <>
        <Bot className="size-3.5" /> Waiting for Claude. Ask Claude to “draft replies for my waiting
        Play reviews”.
      </>
    ) : review.state === "failed" ? (
      <>
        <AlertTriangle className="size-3.5" /> Not sent: {d.error}
      </>
    ) : (
      <>
        {d.source === "claude"
          ? "Drafted by Claude"
          : d.source === "template"
            ? "Drafted from a template"
            : "Draft"}{" "}
        · waiting for your approval
      </>
    );
  return (
    <p
      className={cn(
        "text-small flex flex-wrap items-center gap-1.5",
        review.state === "failed" ? "text-danger" : "text-muted",
      )}
    >
      {line}
    </p>
  );
}

export function ReviewCard({
  app,
  review,
  selected,
  onSelect,
}: {
  app: PlayAppDetail;
  review: PlayReview;
  selected: boolean;
  onSelect: () => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [editing, setEditing] = useState(Boolean(review.draft) && review.state !== "scheduled");
  return (
    <li>
      <Card
        className={cn(
          "relative flex flex-col gap-3 overflow-hidden p-4 sm:p-5",
          selected && "border-accent ring-accent ring-1",
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{
            background: `var(--chart-star-${review.stars <= 2 ? 1 : review.stars === 3 ? 3 : 5})`,
          }}
        />
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            aria-label={`Select review by ${review.authorName || "a Google user"}`}
            className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Stars value={review.stars} />
              <span className="text-[14px] font-semibold">
                {review.authorName || "A Google user"}
              </span>
              <span className="text-caption text-muted">{ago(review.reviewedAt)}</span>
              {review.language && !review.language.startsWith("en") ? (
                <Badge tone="outline">{languageLabel(review.language)}</Badge>
              ) : null}
              {review.editedAfterReply ? (
                <Badge tone="warning">
                  Updated after your reply
                  {review.starsBeforeEdit ? ` · ${review.starsBeforeEdit}★ → ${review.stars}★` : ""}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-[15px] leading-6 whitespace-pre-line">
              {showOriginal && review.originalText
                ? review.originalText
                : review.text || <em className="text-muted">No text</em>}
            </p>
            <div className="text-caption text-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {review.appVersionName ? <span>Version {review.appVersionName}</span> : null}
              {review.device ? <span>{review.device}</span> : null}
              {review.androidVersion ? <span>Android API {review.androidVersion}</span> : null}
              {review.thumbsUp ? (
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="size-3" /> {review.thumbsUp}
                </span>
              ) : null}
              {review.originalText ? (
                <button
                  type="button"
                  className="text-accent font-medium underline underline-offset-4"
                  onClick={() => setShowOriginal(!showOriginal)}
                >
                  {showOriginal
                    ? "Show translation"
                    : `Show original (${languageLabel(review.language)})`}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {review.reply ? (
          <div className="bg-surface-muted ml-7 rounded-[var(--radius-control)] px-4 py-3">
            <p className="text-caption text-muted">
              Your reply{review.reply.repliedAt ? ` · ${ago(review.reply.repliedAt)}` : ""}
            </p>
            <p className="mt-1 text-[14px] leading-6">{review.reply.text}</p>
          </div>
        ) : null}

        <div className="ml-7 grid gap-2">
          <StatusLine review={review} />
          {editing ? (
            <Composer app={app} review={review} onClose={() => setEditing(false)} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {review.state === "scheduled" && review.draft ? (
                <ScheduledActions app={app} review={review} onEdit={() => setEditing(true)} />
              ) : (
                <Button
                  size="sm"
                  variant={review.reply ? "ghost" : "secondary"}
                  onClick={() => setEditing(true)}
                >
                  <Pencil /> {review.reply ? "Edit reply" : "Reply"}
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </li>
  );
}

function ScheduledActions({
  app,
  review,
  onEdit,
}: {
  app: PlayAppDetail;
  review: PlayReview;
  onEdit: () => void;
}) {
  const approve = useApproveReply(app.id);
  const discard = useDiscardReply(app.id);
  const draft = review.draft!;
  return (
    <>
      <blockquote className="border-border w-full border-l-2 pl-3 text-[14px] leading-6">
        {draft.text}
      </blockquote>
      <Button
        size="sm"
        loading={approve.isPending}
        onClick={() =>
          approve.mutate(
            { replyId: draft.id },
            {
              onSuccess: () => toast.success("Reply sent"),
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      >
        <Send /> Send now
      </Button>
      <Button size="sm" variant="secondary" onClick={onEdit}>
        <Pencil /> Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        loading={discard.isPending}
        onClick={() =>
          discard.mutate(draft.id, { onSuccess: () => toast.success("Scheduled reply cancelled") })
        }
      >
        Cancel
      </Button>
    </>
  );
}

function Composer({
  app,
  review,
  onClose,
}: {
  app: PlayAppDetail;
  review: PlayReview;
  onClose: () => void;
}) {
  const draft = review.draft;
  const templates = usePlayTemplates(app.id);
  const preview = usePreviewReply(app.id);
  const replyNow = useReplyNow(app.id);
  const save = useSaveReplyDraft(app.id);
  const approve = useApproveReply(app.id);
  const discard = useDiscardReply(app.id);
  const [text, setText] = useState(
    draft?.text || (review.state === "replied" ? (review.reply?.text ?? "") : ""),
  );
  const [templateId, setTemplateId] = useState<string | undefined>(draft?.templateId ?? undefined);
  const [note, setNote] = useState<string | null>(draft?.note ?? null);
  const length = text.length;
  const tooLong = length > REPLY_MAX;
  const busy = replyNow.isPending || save.isPending || approve.isPending;
  const fail = (e: unknown) => toast.error(errorMessage(e));

  const send = () => {
    const done = () => {
      toast.success("Reply posted on Google Play");
      onClose();
    };
    if (draft && draft.status !== "failed")
      approve.mutate({ replyId: draft.id, text }, { onSuccess: done, onError: fail });
    else
      replyNow.mutate(
        { reviewId: review.id, text, templateId },
        { onSuccess: done, onError: fail },
      );
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Fill from a template"
          className={cn(inputClass, "h-9 w-auto min-w-52 text-[14px]")}
          value=""
          onChange={(e) => {
            const id = e.target.value;
            if (!id) return;
            preview.mutate(
              { reviewId: review.id, templateId: id },
              {
                onSuccess: (p) => {
                  setText(p.text);
                  setTemplateId(id);
                  setNote(p.note);
                },
                onError: fail,
              },
            );
          }}
        >
          <option value="">{preview.isPending ? "Filling in…" : "Fill from a template…"}</option>
          {(templates.data?.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <Textarea
        aria-label={`Reply to ${review.authorName || "a Google user"}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setNote(null);
        }}
        placeholder={
          review.state === "claude"
            ? "Claude hasn't drafted this yet. Write your own or pick a template."
            : "Write a reply"
        }
        className="min-h-24 text-[14px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn("text-caption", note ? "text-warning" : "text-muted")}
          role={note ? "status" : undefined}
        >
          {note ?? "Replies are public and the reviewer is notified the first time you reply."}
        </p>
        <span
          className={cn(
            "text-caption tabular-nums",
            tooLong ? "text-danger font-semibold" : "text-muted",
          )}
        >
          {length}/{REPLY_MAX}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!text.trim() || tooLong}
          loading={replyNow.isPending || approve.isPending}
          onClick={send}
        >
          <Send /> {draft && draft.status === "pending_approval" ? "Approve and send" : "Send"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!text.trim() || tooLong || busy}
          loading={save.isPending}
          onClick={() =>
            save.mutate(
              { reviewId: review.id, text, templateId },
              {
                onSuccess: () => {
                  toast.success("Saved for approval");
                  onClose();
                },
                onError: fail,
              },
            )
          }
        >
          Save for later
        </Button>
        {draft ? (
          <Button
            size="sm"
            variant="ghost"
            loading={discard.isPending}
            onClick={() =>
              discard.mutate(draft.id, {
                onSuccess: () => {
                  toast.success("Draft discarded");
                  onClose();
                },
                onError: fail,
              })
            }
          >
            Discard
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
