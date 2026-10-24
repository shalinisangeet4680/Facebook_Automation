"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type KeyboardEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpReview,
  useBusinessAiDraft,
  useBusinessInbox,
  useBusinessReply,
  useBusinessSkip,
  useBusinessTemplates,
} from "@/lib/api/business";
import { useToast } from "@/features/replyly/ui";

import { useGoogleConnected, useLocationColors, useLocationFilter } from "./shell";
import { agoShort, Avatar, Notice, Skel, Stars } from "./ui";
import "./reviews.css";

type Tab = "waiting" | "replied" | "all";
type Tone = "default" | "warmer" | "shorter" | "formal";

const TABS: [Tab, string][] = [
  ["waiting", "Waiting"],
  ["replied", "Replied"],
  ["all", "All"],
];

const TONES: [Tone, string][] = [
  ["default", "Default"],
  ["warmer", "Warmer"],
  ["shorter", "Shorter"],
  ["formal", "Formal"],
];

interface Edit {
  text: string;
  tone: Tone;
  base: string | null;
  templateId: string | null;
}

const noop = () => () => undefined;

const isDone = (r: GbpReview) => Boolean(r.skippedAt) || (Boolean(r.reply) && !r.editedAfterReply);

const agoLong = (iso: string) => {
  const a = agoShort(iso);
  return a === "now" ? "just now" : `${a} ago`;
};

function ListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "14px 16px" }}>
          <Skel h={30} w={30} r={15} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <Skel h={12} w="60%" r={6} />
            <Skel h={10} w="35%" r={5} />
            <Skel h={10} r={5} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BusinessReviewsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { connected, loading } = useGoogleConnected();
  const { locationId } = useLocationFilter();
  const { locations, color } = useLocationColors();
  const inbox = useBusinessInbox("all", locationId);
  const templates = useBusinessTemplates();
  const reply = useBusinessReply();
  const skip = useBusinessSkip();
  const aiDraft = useBusinessAiDraft();

  const [tab, setTab] = useState<Tab>("waiting");
  const [selId, setSelId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [toning, setToning] = useState<{ id: string; tone: Tone } | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const mac = useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => true,
  );

  const q = (params.get("q") ?? "").trim();
  const reviewParam = params.get("review");

  useEffect(() => {
    if (!loading && !connected) router.replace("/business/connect");
  }, [loading, connected, router]);

  const all = useMemo(() => {
    const data = inbox.data?.data ?? [];
    const needle = q.toLowerCase();
    return needle
      ? data.filter(
          (r) =>
            r.authorName.toLowerCase().includes(needle) || r.text.toLowerCase().includes(needle),
        )
      : data;
  }, [inbox.data, q]);
  const waiting = all.filter((r) => !isDone(r));
  const replied = all.filter(isDone);
  const counts = q
    ? { waiting: waiting.length, replied: replied.length, all: all.length }
    : {
        waiting: inbox.data?.counts.pending ?? waiting.length,
        replied: inbox.data?.counts.replied ?? replied.length,
        all: inbox.data?.counts.all ?? all.length,
      };
  const list = tab === "waiting" ? waiting : tab === "replied" ? replied : all;
  const sel = list.find((r) => r.id === selId) ?? list[0] ?? null;

  if (reviewParam && applied !== reviewParam && inbox.data) {
    setApplied(reviewParam);
    const found = inbox.data.data.find((r) => r.id === reviewParam);
    if (found) {
      setTab(isDone(found) ? "replied" : "waiting");
      setSelId(found.id);
      setOpen(true);
    }
  }

  const edit = sel ? edits[sel.id] : undefined;
  const base = edit ? edit.base : (sel?.draft?.text ?? null);
  const templateId = edit ? edit.templateId : (sel?.draft?.templateId ?? null);
  const text = edit?.text ?? sel?.draft?.text ?? "";
  const tone = edit?.tone ?? "default";
  const templateName =
    templateId && base && text === base
      ? templates.data?.data.find((t) => t.id === templateId)?.name
      : undefined;
  const busy = reply.isPending || skip.isPending;

  const patch = (id: string, next: Partial<Edit>) =>
    setEdits((prev) => {
      const r = all.find((x) => x.id === id);
      const current: Edit = prev[id] ?? {
        text: r?.draft?.text ?? "",
        tone: "default",
        base: r?.draft?.text ?? null,
        templateId: r?.draft?.templateId ?? null,
      };
      return { ...prev, [id]: { ...current, ...next } };
    });

  const pickTone = (t: Tone) => {
    if (!sel || toning) return;
    const id = sel.id;
    if (t === "default" && base) {
      patch(id, { tone: t, text: base });
      return;
    }
    setToning({ id, tone: t });
    aiDraft.mutate(
      { reviewId: id, tone: t },
      {
        onSuccess: (view) => {
          const drafted = view.draft?.text ?? "";
          patch(id, {
            tone: t,
            text: drafted,
            ...(!base && t === "default"
              ? { base: drafted, templateId: view.draft?.templateId ?? null }
              : {}),
          });
        },
        onError: (err) => toast(errorMessage(err)),
        onSettled: () => setToning(null),
      },
    );
  };

  const advance = (id: string) => {
    const i = waiting.findIndex((r) => r.id === id);
    const next = (i >= 0 ? waiting[i + 1] : undefined) ?? waiting.find((r) => r.id !== id) ?? null;
    setEdits((prev) => {
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
    if (tab === "replied") setTab("waiting");
    setSelId(next?.id ?? null);
    if (!next) setOpen(false);
  };

  const send = () => {
    if (!sel || isDone(sel) || busy || !text.trim()) return;
    const id = sel.id;
    reply.mutate(
      {
        reviewId: id,
        text: text.trim(),
        templateId: templateId && text === base ? templateId : undefined,
      },
      {
        onSuccess: () => {
          toast("Reply posted to Google");
          advance(id);
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  const skipSel = () => {
    if (!sel || busy) return;
    const id = sel.id;
    skip.mutate(
      { reviewId: id },
      {
        onSuccess: () => advance(id),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  const unskip = () => {
    if (!sel || busy) return;
    const id = sel.id;
    skip.mutate(
      { reviewId: id, undo: true },
      {
        onSuccess: () => {
          setTab("waiting");
          setSelId(id);
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  };

  const clearSearch = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("q");
    const s = next.toString();
    router.replace(s ? `/business/reviews?${s}` : "/business/reviews");
  };

  const locName = (id: string) => locations.find((l) => l.id === id)?.title ?? "Location";

  if (inbox.isError)
    return (
      <Notice
        tone="error"
        action={
          <button type="button" className="gb-btn" onClick={() => void inbox.refetch()}>
            Try again
          </button>
        }
      >
        {errorMessage(inbox.error)}
      </Notice>
    );

  const done = sel ? isDone(sel) : false;
  const byLabel = sel?.skippedAt
    ? "Skipped"
    : sel?.sentVia
      ? sel.sentVia.auto
        ? "Replied automatically"
        : "You replied"
      : "Replied on Google";

  return (
    <div className="gb-reviews" data-open={open && Boolean(sel)}>
      <div className="gb-reviews-list">
        <div className="gb-reviews-tabs">
          <div className="gb-seg gb-seg-fill" role="tablist" aria-label="Review status">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className="gb-seg-btn"
                onClick={() => {
                  setTab(id);
                  setSelId(null);
                }}
              >
                {label}
                <span className="gb-seg-n">{inbox.isPending ? "" : counts[id]}</span>
              </button>
            ))}
          </div>
          {q ? (
            <span className="gb-chip gb-reviews-search">
              <span>Search: {q}</span>
              <button type="button" aria-label="Clear search" onClick={clearSearch}>
                ×
              </button>
            </span>
          ) : null}
        </div>
        <div className="gb-reviews-rows">
          {inbox.isPending ? (
            <ListSkeleton />
          ) : list.length ? (
            list.map((r) => (
              <button
                key={r.id}
                type="button"
                className="gb-reviews-row"
                aria-current={sel?.id === r.id}
                onClick={() => {
                  setSelId(r.id);
                  setOpen(true);
                }}
              >
                <Avatar name={r.authorName} photo={r.authorPhoto} size={30} />
                <div className="gb-reviews-row-body">
                  <div className="gb-reviews-row-top">
                    <span
                      className="gb-reviews-row-name"
                      style={{ fontWeight: isDone(r) ? 400 : 600 }}
                    >
                      {r.authorName || "A Google user"}
                    </span>
                    <span className="gb-reviews-ago">{agoShort(r.reviewedAt)}</span>
                  </div>
                  <Stars n={r.stars} size={11} />
                  <span className="gb-reviews-row-text">{r.text || "Rating only"}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="gb-reviews-nothing">{q ? "No reviews match" : "Nothing here"}</div>
          )}
        </div>
      </div>

      <div className="gb-reviews-detail" onKeyDown={onKey}>
        {inbox.isPending ? (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <Skel h={40} w="50%" />
            <Skel h={60} />
            <Skel h={140} />
          </div>
        ) : sel ? (
          <div className="gb-reviews-sel" key={sel.id}>
            <div className="gb-reviews-head">
              <button
                type="button"
                className="gb-reviews-back"
                aria-label="Back to reviews"
                onClick={() => setOpen(false)}
              >
                ‹
              </button>
              <Avatar name={sel.authorName} photo={sel.authorPhoto} size={40} />
              <div className="gb-reviews-who">
                <div className="gb-reviews-name">{sel.authorName || "A Google user"}</div>
                <div className="gb-reviews-meta">
                  <i style={{ background: color(sel.locationId) }} aria-hidden />
                  <span>
                    {locName(sel.locationId)} · {agoLong(sel.reviewedAt)}
                  </span>
                </div>
              </div>
              <Stars n={sel.stars} size={15} />
            </div>
            <div className="gb-reviews-content">
              {sel.text ? (
                <div className="gb-reviews-quote">“{sel.text}”</div>
              ) : (
                <div className="gb-reviews-quote gb-reviews-quote-none">
                  No written review, rating only.
                </div>
              )}

              {done ? (
                <div className="gb-reviews-done">
                  <span className="gb-reviews-done-by">{byLabel}</span>
                  {sel.skippedAt ? (
                    <div className="gb-reviews-compose-foot">
                      <span className="gb-reviews-done-text">This review won’t get a reply.</span>
                      <button
                        type="button"
                        className="gb-reviews-skip"
                        disabled={busy}
                        onClick={unskip}
                      >
                        Reply anyway
                      </button>
                    </div>
                  ) : (
                    <span className="gb-reviews-done-text">{sel.reply?.text}</span>
                  )}
                </div>
              ) : (
                <div className="gb-reviews-compose">
                  <div className="gb-reviews-compose-top">
                    <label htmlFor="gb-reviews-reply" className="gb-reviews-label">
                      Your reply
                    </label>
                    <div className="gb-reviews-tones" role="group" aria-label="Reply tone">
                      {TONES.map(([id, label]) => {
                        const loadingTone = toning?.id === sel.id && toning.tone === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            className="gb-reviews-tone"
                            aria-pressed={tone === id}
                            aria-busy={loadingTone || undefined}
                            disabled={Boolean(toning)}
                            onClick={() => pickTone(id)}
                          >
                            {loadingTone ? <span className="gb-reviews-spin" aria-hidden /> : null}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <textarea
                    id="gb-reviews-reply"
                    className="gb-reviews-text"
                    rows={5}
                    value={text}
                    placeholder={base ? undefined : "Write a reply, or pick a tone to draft one"}
                    onChange={(e) => patch(sel.id, { text: e.target.value })}
                  />
                  <div className="gb-reviews-compose-foot">
                    {templateName ? (
                      <span className="gb-reviews-from">From “{templateName}”</span>
                    ) : null}
                    <div className="gb-reviews-actions">
                      <button
                        type="button"
                        className="gb-reviews-skip"
                        disabled={busy}
                        onClick={skipSel}
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        className="gb-reviews-send"
                        disabled={busy || !text.trim()}
                        onClick={send}
                      >
                        {reply.isPending ? "Sending…" : "Send reply"}
                        <kbd aria-hidden>{mac ? "⌘↵" : "Ctrl↵"}</kbd>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="gb-reviews-zero">
            <span className="gb-check-big" aria-hidden>
              ✓
            </span>
            <strong>Inbox zero</strong>
          </div>
        )}
      </div>
    </div>
  );
}
