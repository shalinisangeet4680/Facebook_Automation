"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { api, unwrap } from "@/lib/api/client";
import {
  useApproveAll,
  useApproveInboxReply,
  useDraftReview,
  usePlayInbox,
  usePlayTemplates,
  useReplyFromInbox,
  useSaveInboxDraft,
  useSkipReview,
} from "@/lib/api/queries";
import type { PlayInboxReview } from "@/lib/api/types";
import { useQueryClient } from "@tanstack/react-query";

import { useAppColors } from "./shell";
import { StateArt } from "./state-art";
import { ago, stars, TOPIC_STYLE, until } from "./tokens";
import { Banner, PageHead, Seg, Skel, Spinner, useToast } from "./ui";

type Filter = "pending" | "replied" | "all";

export function InboxPage() {
  const router = useRouter();
  const params = useSearchParams();
  const filter = (
    ["pending", "replied", "all"].includes(params.get("filter") ?? "")
      ? params.get("filter")
      : "pending"
  ) as Filter;
  const appId = params.get("app") ?? undefined;
  const inbox = usePlayInbox(filter, appId);
  const { apps, color } = useAppColors();
  const approveAll = useApproveAll();
  const toast = useToast();

  const go = (next: { filter?: Filter; app?: string | null }) => {
    const q = new URLSearchParams();
    const f = next.filter ?? filter;
    const a = next.app === undefined ? appId : next.app;
    if (f !== "pending") q.set("filter", f);
    if (a) q.set("app", a);
    router.replace(`/reviews/inbox${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  const data = inbox.data;
  const items = data?.data ?? [];
  const approvable = data?.approvable ?? [];
  const okApps = apps.filter((a) => a.mode !== "needs_access");

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Inbox"
        sub="AI drafts waiting for you. Edit, approve, or skip."
        actions={
          approvable.length > 1 && filter !== "replied" ? (
            <button
              type="button"
              className="rp-btn"
              disabled={approveAll.isPending}
              onClick={() =>
                approveAll.mutate(approvable.slice(0, 50), {
                  onSuccess: (r) =>
                    toast(
                      r.failed.length
                        ? `${r.sent} replies posted · ${r.failed.length} failed`
                        : `${r.sent} replies posted`,
                    ),
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              {approveAll.isPending ? <Spinner /> : null}
              Approve all {Math.min(approvable.length, 50)}
            </button>
          ) : null
        }
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Seg
          label="Inbox filter"
          pad={12}
          value={filter}
          onChange={(f) => go({ filter: f })}
          options={[
            { id: "pending", label: "Needs reply", n: data?.counts.pending ?? "" },
            { id: "replied", label: "Replied", n: data?.counts.replied ?? "" },
            { id: "all", label: "All", n: data?.counts.all ?? "" },
          ]}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ id: "", title: "All apps" }, ...okApps].map((a) => {
            const on = (appId ?? "") === a.id;
            return (
              <button
                key={a.id || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => go({ app: a.id || null })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: `1px solid ${on ? "#191917" : "#E6E4DF"}`,
                  background: "#fff",
                  fontSize: 12.5,
                  cursor: "pointer",
                  color: "#191917",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 3,
                    background: a.id ? color(a.id) : "#191917",
                  }}
                />
                {a.title}
              </button>
            );
          })}
        </div>
      </div>
      {inbox.error ? <Banner tone="error">{errorMessage(inbox.error)}</Banner> : null}
      {inbox.isPending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rp-card"
              style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}
            >
              <Skel h={14} w="40%" />
              <Skel h={12} />
              <Skel h={60} r={10} />
            </div>
          ))}
        </div>
      ) : !items.length ? (
        <div
          className="rp-card"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 28,
            alignItems: "center",
            padding: 24,
            borderRadius: 16,
          }}
        >
          <div style={{ height: 240 }}>
            <StateArt kind="inbox_zero" height={240} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="rp-serif" style={{ fontSize: 34, lineHeight: 1.05 }}>
              Inbox zero. <span style={{ fontStyle: "italic" }}>Nice.</span>
            </h2>
            <p style={{ color: "#55534E", lineHeight: 1.55 }}>
              Every review in this view has a reply. New reviews sync every 15 minutes, and
              auto-mode apps keep answering while you’re away.
            </p>
            {filter !== "replied" ? (
              <button
                type="button"
                className="rp-btn-light"
                style={{ alignSelf: "flex-start", marginTop: 4 }}
                onClick={() => go({ filter: "replied" })}
              >
                See what was sent
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((r) => (
            <InboxItem
              key={`${r.id}:${r.draft?.id ?? ""}:${r.draft?.text ?? ""}`}
              review={r}
              appColor={color(r.appId)}
              appName={apps.find((a) => a.id === r.appId)?.title ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const PENDING = new Set(["waiting", "claude", "scheduled", "unreplied"]);

function byLine(r: PlayInboxReview) {
  if (r.state === "skipped") return `by you · ${ago(r.skippedAt)}`;
  const via = r.sentVia;
  if (!via) return `Play Console · ${ago(r.reply?.repliedAt)}`;
  const who = via.auto ? "Auto" : via.source === "claude" ? "Claude" : "You";
  if (via.auto && via.sentAt) {
    const mins = Math.max(
      1,
      Math.round((Date.parse(via.sentAt) - Date.parse(r.reviewedAt)) / 60000),
    );
    return `${who} · ${mins < 60 ? `${mins}m` : mins < 2880 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`} after review`;
  }
  return `${who} · ${ago(via.sentAt ?? r.reply?.repliedAt)}`;
}

function InboxItem({
  review: r,
  appColor,
  appName,
}: {
  review: PlayInboxReview;
  appColor: string;
  appName: string;
}) {
  const toast = useToast();
  const templates = usePlayTemplates();
  const skip = useSkipReview();
  const draft = useDraftReview();
  const approve = useApproveInboxReply();
  const save = useSaveInboxDraft();
  const replyNow = useReplyFromInbox();
  const client = useQueryClient();
  const [text, setText] = useState(r.draft?.text ?? "");
  const [undoing, setUndoing] = useState(false);

  const pending = PENDING.has(r.state);
  const failed = r.state === "failed";
  const replied = r.state === "replied" || r.state === "skipped";
  const topic = r.topic && r.topic !== "Other" ? r.topic : null;
  const [tagBg, tagFg] = (topic && TOPIC_STYLE[topic]) || ["#EFEDE8", "#55534E"];
  const original = r.originalText && r.originalText !== r.text ? r.originalText : null;
  const tplName = templates.data?.data.find((t) => t.id === r.draft?.templateId)?.name;
  const label = !r.draft
    ? "No draft yet"
    : r.draft.source === "ai"
      ? `AI draft · ${tplName ?? "AI-written"}`
      : r.draft.source === "claude"
        ? "Drafted by Claude"
        : r.draft.source === "template"
          ? `Template · ${tplName ?? "template"}`
          : "Your draft";
  const len = [...text].length;
  const busy = draft.isPending || approve.isPending || replyNow.isPending || skip.isPending;
  const fail = (err: unknown) => toast(errorMessage(err));

  function post() {
    if (!text.trim()) return toast("Write a reply first");
    if (r.draft && r.draft.status !== "needs_claude")
      approve.mutate(
        { replyId: r.draft.id, text: text !== r.draft.text ? text : undefined },
        { onSuccess: () => toast("Reply posted to Google Play"), onError: fail },
      );
    else
      replyNow.mutate(
        { appId: r.appId, reviewId: r.id, text },
        { onSuccess: () => toast("Reply posted to Google Play"), onError: fail },
      );
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
              <span style={{ width: 8, height: 8, borderRadius: 3, background: appColor }} />
              {appName} · {ago(r.reviewedAt)}
              {r.language ? ` · ${r.language.split(/[-_]/)[0]!.toUpperCase()}` : ""}
              {r.appVersionName ? ` · v${r.appVersionName}` : ""}
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
          {original ?? (r.text || <span style={{ color: "#6C6962" }}>Rating only, no text.</span>)}
        </p>
        {original ? (
          <span style={{ fontSize: 12.5, color: "#6C6962", fontStyle: "italic" }}>
            Translated: {r.text}
          </span>
        ) : null}
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
            <span className="rp-mono" style={{ color: len > 350 ? "#B42318" : "#6C6962" }}>
              {len}/350
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
              disabled={!r.canReply}
              placeholder={
                r.canReply
                  ? "Write a reply, or let AI draft one…"
                  : "This review came from a report without a link. Reply in Play Console."
              }
              onChange={(e) => setText(e.target.value)}
              onBlur={() => {
                if (
                  r.draft &&
                  text.trim() &&
                  text !== r.draft.text &&
                  r.draft.status !== "needs_claude"
                )
                  save.mutate({ appId: r.appId, reviewId: r.id, text }, { onError: fail });
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
          {r.draft?.note || r.state === "scheduled" ? (
            <span style={{ fontSize: 12, color: r.state === "scheduled" ? "#0F6B4A" : "#8A5A00" }}>
              {r.state === "scheduled" && r.draft?.sendAt
                ? `Posts automatically ${until(r.draft.sendAt)}. Approve to post now.`
                : r.draft?.note}
            </span>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                skip.mutate(r.id, { onSuccess: () => toast("Skipped"), onError: fail })
              }
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                border: "none",
                background: "none",
                color: "#6C6962",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Skip
            </button>
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "7px 12px" }}
              disabled={busy || !r.canReply}
              onClick={() =>
                draft.mutate({ id: r.id, rewrite: Boolean(r.draft?.text) }, { onError: fail })
              }
            >
              {r.draft?.text ? "Rewrite" : "Draft"}
            </button>
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "7px 14px" }}
              disabled={busy || !r.canReply || len > 350}
              onClick={post}
            >
              {approve.isPending || replyNow.isPending ? <Spinner size={11} /> : null}
              Approve &amp; post
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
          <span
            style={{
              width: 28,
              height: 28,
              flexShrink: 0,
              borderRadius: "50%",
              background: "#B42318",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
            }}
          >
            !
          </span>
          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontWeight: 500, color: "#7A1A12", fontSize: 13.5 }}>
              Reply wasn’t posted
            </span>
            <span
              className="rp-mono"
              style={{ fontSize: 11.5, color: "#9A3B30", overflowWrap: "anywhere" }}
            >
              {r.draft?.error ?? "Google Play didn’t accept the reply."}
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
                { replyId: r.draft.id },
                { onSuccess: () => toast("Posted on retry"), onError: fail },
              )
            }
          >
            {approve.isPending ? <Spinner size={11} /> : null}
            <span>{approve.isPending ? "Retrying…" : "Retry"}</span>
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
            }}
          >
            <span>
              {r.state === "skipped" ? "Skipped" : "Replied"} · {byLine(r)}
            </span>
            {r.state === "skipped" ? (
              <button
                type="button"
                className="rp-btn-text"
                disabled={undoing}
                onClick={async () => {
                  setUndoing(true);
                  try {
                    await unwrap(
                      api.POST("/api/v1/play/reviews/{id}/unskip", {
                        params: { path: { id: r.id } },
                      }),
                    );
                    await client.invalidateQueries({ queryKey: ["play", "inbox"] });
                  } catch (err) {
                    fail(err);
                  } finally {
                    setUndoing(false);
                  }
                }}
              >
                Undo
              </button>
            ) : null}
          </span>
          <span style={{ lineHeight: 1.55, overflowWrap: "anywhere" }}>
            {r.state === "skipped" ? "No reply posted." : r.reply?.text}
          </span>
        </div>
      ) : null}
    </article>
  );
}
