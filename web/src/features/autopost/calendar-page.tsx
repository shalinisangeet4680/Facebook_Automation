"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  type AutopostPost,
  type SocialPlatform,
  useApproveAllAutoposts,
  useCalendar,
  useGeneratePlan,
  useUpdateAutopost,
} from "@/lib/api/autopost";
import { errorMessage } from "@/lib/api/errors";
import { PageHead, Seg, Skel, Spinner, useToast } from "@/features/replyly/ui";

import {
  AccountAlerts,
  AccountSelect,
  MUTED,
  StatusPill,
  fmtTime,
  useConnectedGuard,
} from "./common";
import { Composer } from "./composer";
import { FORMAT_LABEL, STATUS_STYLE, WEEKDAYS, addDays, localDay, mondayOf } from "./platform";

type View = "week" | "month";
type Editing = { post?: AutopostPost; date?: string } | null;

const DRAGGABLE = new Set(["draft", "pending_approval", "scheduled", "failed"]);

function withDay(iso: string | null, day: Date) {
  const base = iso ? new Date(iso) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 11);
  const next = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    base.getHours(),
    base.getMinutes(),
  );
  return next.toISOString();
}

function PostCard({
  post,
  compact,
  color,
  onOpen,
}: {
  post: AutopostPost;
  compact?: boolean;
  color: string;
  onOpen: () => void;
}) {
  const when = post.publishedAt ?? post.scheduledAt;
  const thumb = post.media.find((m) => m.kind === "image")?.url;
  const [bg, fg] = STATUS_STYLE[post.status];
  if (compact)
    return (
      <button
        type="button"
        draggable={DRAGGABLE.has(post.status)}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", post.id)}
        onClick={onOpen}
        title={post.caption}
        style={{
          display: "flex",
          gap: 4,
          alignItems: "center",
          width: "100%",
          padding: "2px 6px",
          borderRadius: 6,
          border: 0,
          background: bg,
          color: fg,
          fontSize: 11,
          cursor: "pointer",
          textAlign: "left",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span className="rp-mono">{when ? fmtTime(when) : "—"}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {FORMAT_LABEL[post.format]}
        </span>
      </button>
    );
  return (
    <button
      type="button"
      draggable={DRAGGABLE.has(post.status)}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", post.id)}
      onClick={onOpen}
      className="rp-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 8,
        textAlign: "left",
        cursor: DRAGGABLE.has(post.status) ? "grab" : "pointer",
        borderLeft: `3px solid ${color}`,
        width: "100%",
      }}
    >
      <span
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
          fontSize: 11.5,
          color: MUTED,
        }}
      >
        <span className="rp-mono">{when ? fmtTime(when) : "No time"}</span>
        <span>{FORMAT_LABEL[post.format]}</span>
      </span>
      {thumb ? (
        <Image
          unoptimized
          src={thumb}
          alt=""
          width={120}
          height={120}
          style={{
            width: "100%",
            aspectRatio: post.format === "story" ? "9 / 16" : "1 / 1",
            maxHeight: 120,
            objectFit: "cover",
            borderRadius: 6,
            background: "#EFEDE8",
          }}
        />
      ) : null}
      <span
        style={{
          fontSize: 12,
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {post.caption || post.idea || "No caption yet"}
      </span>
      <StatusPill status={post.status} />
    </button>
  );
}

export function CalendarPage({ platform }: { platform: SocialPlatform }) {
  const toast = useToast();
  const params = useSearchParams();
  const { accounts, color, loading } = useConnectedGuard(platform);
  const [view, setView] = useState<View>(params.get("view") === "month" ? "month" : "week");
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [accountId, setAccountId] = useState("all");
  const [editing, setEditing] = useState<Editing>(null);
  const [over, setOver] = useState<string | null>(null);
  const generate = useGeneratePlan();
  const approveAll = useApproveAllAutoposts();
  const move = useUpdateAutopost();

  const start = useMemo(
    () =>
      view === "week"
        ? mondayOf(anchor)
        : mondayOf(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    [anchor, view],
  );
  const days = view === "week" ? 7 : 42;
  const from = start.toISOString();
  const to = addDays(start, days).toISOString();
  const selected = accountId === "all" ? undefined : accountId;
  const calendar = useCalendar(platform, from, to, selected);
  const posts = calendar.data?.data ?? [];
  const byDay = new Map<string, AutopostPost[]>();
  for (const p of posts) {
    const when = p.publishedAt ?? p.scheduledAt ?? p.createdAt;
    const key = localDay(new Date(when));
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }
  const pending = posts.filter((p) => p.status === "pending_approval").length;
  const today = localDay(new Date());
  const month = anchor.getMonth();

  function shift(n: number) {
    setAnchor((a) =>
      view === "week" ? addDays(a, n * 7) : new Date(a.getFullYear(), a.getMonth() + n, 1),
    );
  }

  async function plan() {
    const targets = selected
      ? [selected]
      : accounts.filter((a) => a.status === "active").map((a) => a.id);
    if (!targets.length) return;
    const week = view === "week" ? localDay(mondayOf(anchor)) : undefined;
    let created = 0;
    for (const id of targets) {
      try {
        const r = await generate.mutateAsync({ accountId: id, weekStart: week });
        created += r.posts.length;
      } catch (err) {
        toast(errorMessage(err));
        return;
      }
    }
    toast(
      created
        ? `Planned ${created} post${created === 1 ? "" : "s"}`
        : "No free slots left this week",
    );
  }

  function drop(day: Date, id: string) {
    setOver(null);
    const post = posts.find((p) => p.id === id);
    if (!post || !DRAGGABLE.has(post.status)) return;
    const next = withDay(post.scheduledAt, day);
    if (post.scheduledAt && localDay(new Date(post.scheduledAt)) === localDay(day)) return;
    move.mutate(
      { id, scheduledAt: next },
      {
        onSuccess: () =>
          toast(
            `Moved to ${day.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}`,
          ),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  }

  const title =
    view === "week"
      ? `${start.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${addDays(start, 6).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`
      : anchor.toLocaleDateString("en", { month: "long", year: "numeric" });

  const cell = (day: Date) => {
    const key = localDay(day);
    const list = (byDay.get(key) ?? []).sort((a, b) =>
      (a.scheduledAt ?? a.publishedAt ?? "").localeCompare(b.scheduledAt ?? b.publishedAt ?? ""),
    );
    const past = key < today;
    return (
      <div
        key={key}
        onDragOver={(e) => {
          if (past) return;
          e.preventDefault();
          setOver(key);
        }}
        onDragLeave={() => setOver((o) => (o === key ? null : o))}
        onDrop={(e) => {
          e.preventDefault();
          if (!past) drop(day, e.dataTransfer.getData("text/plain"));
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: 8,
          minHeight: view === "week" ? 260 : 96,
          background: over === key ? "#F1F5F2" : past ? "#FAF9F7" : "#fff",
          borderLeft: "1px solid #EFEDE8",
          borderTop: "1px solid #EFEDE8",
          opacity: view === "month" && day.getMonth() !== month ? 0.55 : 1,
          minWidth: 0,
        }}
      >
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            className="rp-mono"
            style={{
              fontSize: 12,
              fontWeight: key === today ? 700 : 400,
              color: key === today ? "#191917" : MUTED,
            }}
          >
            {view === "week"
              ? `${WEEKDAYS[(day.getDay() + 6) % 7]} ${day.getDate()}`
              : day.getDate()}
          </span>
          {!past ? (
            <button
              type="button"
              className="rp-btn-text"
              aria-label={`New post on ${key}`}
              style={{ padding: "0 4px", fontSize: 14 }}
              onClick={() => setEditing({ date: withDay(null, day) })}
            >
              +
            </button>
          ) : null}
        </span>
        {list.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            compact={view === "month"}
            color={color(p.accountId)}
            onOpen={() => setEditing({ post: p })}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHead
        title="Calendar"
        sub="Your weekly plan. Drag a post to another day, open it to edit, or approve the week."
        actions={
          <>
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "8px 14px" }}
              disabled={generate.isPending || loading || !accounts.length}
              onClick={() => void plan()}
            >
              {generate.isPending ? <Spinner size={11} dark /> : "✦"} Plan week
            </button>
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "8px 14px" }}
              onClick={() => setEditing({})}
            >
              New post
            </button>
          </>
        }
      />
      <AccountAlerts platform={platform} />
      {editing ? (
        <Composer
          key={editing.post?.id ?? editing.date ?? "new"}
          platform={platform}
          post={editing.post}
          date={editing.date}
          accountId={selected}
          onDone={() => setEditing(null)}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "6px 10px" }}
            aria-label="Previous"
            onClick={() => shift(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "6px 10px" }}
            onClick={() => setAnchor(view === "week" ? mondayOf(new Date()) : new Date())}
          >
            Today
          </button>
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "6px 10px" }}
            aria-label="Next"
            onClick={() => shift(1)}
          >
            ›
          </button>
          <strong style={{ fontSize: 14 }}>{title}</strong>
          {calendar.isFetching ? <Spinner size={11} dark /> : null}
        </span>
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {accounts.length > 1 ? (
            <AccountSelect platform={platform} value={accountId} onChange={setAccountId} all />
          ) : null}
          <Seg
            label="View"
            value={view}
            small
            onChange={(v) => {
              setView(v);
              setAnchor(v === "week" ? mondayOf(new Date()) : new Date());
            }}
            options={[
              { id: "week", label: "Week" },
              { id: "month", label: "Month" },
            ]}
          />
          {pending ? (
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "7px 12px" }}
              disabled={approveAll.isPending}
              onClick={() =>
                approveAll.mutate(
                  { platform, accountId: selected },
                  {
                    onSuccess: (r) =>
                      toast(
                        r.failed.length
                          ? `Approved ${r.approved}; ${r.failed.length} need edits first`
                          : `Approved ${r.approved} post${r.approved === 1 ? "" : "s"}`,
                      ),
                    onError: (err) => toast(errorMessage(err)),
                  },
                )
              }
            >
              Approve all ({pending})
            </button>
          ) : null}
        </span>
      </div>
      {calendar.data?.plans.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {calendar.data.plans
            .filter(
              (p) => p.weekStart >= localDay(start) && p.weekStart < localDay(addDays(start, days)),
            )
            .map((p) => (
              <span key={p.id} className="rp-chip" style={{ cursor: "default" }}>
                Week of{" "}
                {new Date(`${p.weekStart}T00:00:00`).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })}
                : {p.summary}
              </span>
            ))}
        </div>
      ) : null}
      {calendar.isPending ? (
        <Skel h={300} />
      ) : (
        <div className="rp-card" style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,minmax(120px,1fr))",
              minWidth: 840,
              marginLeft: -1,
              marginTop: -1,
            }}
          >
            {view === "month"
              ? WEEKDAYS.map((w) => (
                  <span
                    key={w}
                    style={{
                      padding: "8px",
                      fontSize: 12,
                      color: MUTED,
                      borderLeft: "1px solid #EFEDE8",
                      borderTop: "1px solid #EFEDE8",
                    }}
                  >
                    {w}
                  </span>
                ))
              : null}
            {Array.from({ length: days }, (_, i) => cell(addDays(start, i)))}
          </div>
        </div>
      )}
      {!calendar.isPending && !posts.length ? (
        <span style={{ fontSize: 13, color: MUTED }}>
          Nothing planned here yet. Press Plan to fill the week with posts at your best times, or
          add one yourself.
        </span>
      ) : null}
    </div>
  );
}
