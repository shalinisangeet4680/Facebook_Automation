"use client";

import { useState } from "react";

import {
  type AutopostComment,
  type AutopostCommentClass,
  type SocialPlatform,
  useApproveAllReplies,
  useAutopostComments,
  useCommentAction,
} from "@/lib/api/autopost";
import { errorMessage } from "@/lib/api/errors";
import { ago, until } from "@/features/replyly/tokens";
import { PageHead, Seg, Skel, Spinner, useToast } from "@/features/replyly/ui";

import { AccountAlerts, AccountSelect, Empty, MUTED, Pill, useConnectedGuard } from "./common";
import { CLASS_LABEL, CLASS_STYLE, PLATFORMS } from "./platform";

const STATE_TEXT: Record<AutopostComment["state"], string> = {
  open: "Needs a reply",
  waiting: "Draft waiting",
  scheduled: "Auto-reply scheduled",
  replied: "Replied",
  hidden: "Hidden",
  skipped: "Skipped",
  failed: "Reply failed",
};

function CommentCard({ c, color }: { c: AutopostComment; color: string }) {
  const toast = useToast();
  const act = useCommentAction();
  const [text, setText] = useState(c.draft?.text ?? "");
  const [bg, fg] = CLASS_STYLE[c.class];
  const run = (a: Parameters<typeof act.mutate>[0], ok: string) =>
    act.mutate(a, { onSuccess: () => toast(ok), onError: (err) => toast(errorMessage(err)) });
  const canReply = !c.hidden && c.state !== "replied";

  return (
    <div
      className="rp-card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          fontSize: 12,
          color: MUTED,
        }}
      >
        <strong style={{ color: "#191917", fontSize: 13.5 }}>{c.author || "Someone"}</strong>
        <Pill bg={bg} fg={fg}>
          {CLASS_LABEL[c.class]}
        </Pill>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: color }} />
          {c.accountName}
        </span>
        <span>· {ago(c.commentedAt)}</span>
        <span>· {STATE_TEXT[c.state]}</span>
        {c.escalatedAt ? <span>· sent to Slack</span> : null}
      </div>
      <span
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          overflowWrap: "anywhere",
          color: c.hidden ? MUTED : undefined,
        }}
      >
        {c.text}
      </span>
      {c.postCaption ? (
        <span style={{ fontSize: 12, color: MUTED }}>
          On:{" "}
          {c.postPermalink ? (
            <a href={c.postPermalink} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
              {c.postCaption}
            </a>
          ) : (
            c.postCaption
          )}
        </span>
      ) : null}
      {c.reply ? (
        <span
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            background: "#F7F6F3",
            borderRadius: 8,
            padding: "8px 10px",
          }}
        >
          <strong>You · </strong>
          {c.reply.text}
        </span>
      ) : null}
      {canReply ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {c.draft?.note ? (
            <span style={{ fontSize: 12, color: "#8A5A00" }}>{c.draft.note}</span>
          ) : null}
          {c.draft?.error ? (
            <span style={{ fontSize: 12, color: "#B42318" }}>{c.draft.error}</span>
          ) : null}
          {c.draft?.status === "scheduled" && c.draft.sendAt ? (
            <span style={{ fontSize: 12, color: "#3B4A6B" }}>
              Auto-reply goes out {until(c.draft.sendAt)}.
            </span>
          ) : null}
          <textarea
            className="rp-textarea"
            rows={2}
            value={text}
            aria-label="Reply"
            placeholder={c.draft ? "" : "Write a reply, or ask AI for a draft."}
            onChange={(e) => setText(e.target.value)}
            style={{ resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="rp-btn-text"
              disabled={act.isPending}
              onClick={() => run({ kind: "hide", id: c.id, hidden: true }, "Hidden")}
            >
              Hide
            </button>
            <button
              type="button"
              className="rp-btn-text"
              disabled={act.isPending}
              onClick={() => run({ kind: "skip", id: c.id }, "Skipped")}
            >
              Skip
            </button>
            {c.draft ? (
              <button
                type="button"
                className="rp-btn-text"
                disabled={act.isPending}
                onClick={() => run({ kind: "discard", replyId: c.draft!.id }, "Draft discarded")}
              >
                Discard
              </button>
            ) : null}
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "7px 12px" }}
              disabled={act.isPending}
              onClick={() =>
                act.mutate(
                  { kind: "ai", id: c.id, rewrite: Boolean(c.draft) },
                  {
                    onSuccess: (v) => setText(v.draft?.text ?? ""),
                    onError: (err) => toast(errorMessage(err)),
                  },
                )
              }
            >
              {act.isPending ? <Spinner size={11} dark /> : "✦"} {c.draft ? "Rewrite" : "AI draft"}
            </button>
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "7px 14px" }}
              disabled={act.isPending || !text.trim()}
              onClick={() =>
                c.draft
                  ? run({ kind: "approve", replyId: c.draft.id, text }, "Reply posted")
                  : run({ kind: "reply", id: c.id, text }, "Reply posted")
              }
            >
              {c.draft ? "Approve & post" : "Reply"}
            </button>
          </div>
        </div>
      ) : c.hidden ? (
        <div>
          <button
            type="button"
            className="rp-btn-text"
            disabled={act.isPending}
            onClick={() => run({ kind: "hide", id: c.id, hidden: false }, "Visible again")}
          >
            Unhide
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CommentsPage({ platform }: { platform: SocialPlatform }) {
  const toast = useToast();
  const { accounts, color } = useConnectedGuard(platform);
  const [filter, setFilter] = useState<"open" | "replied" | "all">("open");
  const [cls, setCls] = useState<"all" | AutopostCommentClass>("all");
  const [accountId, setAccountId] = useState("all");
  const comments = useAutopostComments(
    platform,
    filter,
    cls === "all" ? undefined : cls,
    accountId === "all" ? undefined : accountId,
  );
  const approveAll = useApproveAllReplies();
  const list = comments.data?.data ?? [];
  const drafts = list.filter((c) => c.draft?.status === "pending_approval").map((c) => c.draft!.id);

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHead
        title="Comments"
        sub={`Comments on your ${PLATFORMS[platform].name} posts. AI drafts replies by your rules for questions, praise and complaints${platform === "facebook" ? "; spam is hidden" : ""}.`}
        actions={
          drafts.length ? (
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "8px 14px" }}
              disabled={approveAll.isPending}
              onClick={() =>
                approveAll.mutate(drafts, {
                  onSuccess: (r) =>
                    toast(
                      r.failed.length
                        ? `Posted ${r.sent}; ${r.failed.length} failed`
                        : `Posted ${r.sent} replies`,
                    ),
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              Approve all drafts ({drafts.length})
            </button>
          ) : null
        }
      />
      <AccountAlerts platform={platform} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
        <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Seg
            label="Filter comments"
            value={filter}
            small
            onChange={setFilter}
            options={[
              { id: "open", label: "Open", n: comments.data?.counts.open },
              { id: "replied", label: "Replied" },
              { id: "all", label: "All" },
            ]}
          />
          <Seg
            label="Comment type"
            value={cls}
            small
            onChange={setCls}
            options={[
              { id: "all", label: "Every type" },
              ...(Object.keys(CLASS_LABEL) as AutopostCommentClass[]).map((k) => ({
                id: k,
                label: CLASS_LABEL[k],
              })),
            ]}
          />
        </span>
        {accounts.length > 1 ? (
          <AccountSelect platform={platform} value={accountId} onChange={setAccountId} all />
        ) : null}
      </div>
      {comments.isPending ? (
        <Skel h={200} />
      ) : list.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((c) => (
            <CommentCard
              key={`${c.id}:${c.draft?.id ?? ""}:${c.state}`}
              c={c}
              color={color(c.accountId)}
            />
          ))}
        </div>
      ) : (
        <Empty>
          {filter === "open"
            ? "No comments need a reply. New comments sync every 15 minutes."
            : "No comments here yet."}
        </Empty>
      )}
    </div>
  );
}
