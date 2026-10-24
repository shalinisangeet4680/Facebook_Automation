"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { errorMessage } from "@/lib/api/errors";
import { type GbpPost, useBusinessPosts } from "@/lib/api/business";
import { isoDay } from "@/features/replyly/range-calendar";

import {
  PILL,
  type PostDraft,
  PostComposer,
  STATUS,
  TYPE_LABEL,
  draftFromPost,
  fmtWhen,
  newDraft,
} from "./post-composer";
import { useGoogleConnected, useLocationColors, useLocationFilter } from "./shell";
import { Notice, Seg, Skel } from "./ui";
import "./posts.css";

const noop = () => () => undefined;

type Filter = "all" | GbpPost["status"];

const dateOf = (p: GbpPost) =>
  (p.status === "published" ? p.publishedAt : p.scheduledAt) ?? p.createdAt;

const textOf = (p: GbpPost) => p.content.event?.title?.trim() || p.content.summary;

export function BusinessPostsPage() {
  const router = useRouter();
  const { connected, loading } = useGoogleConnected();
  const { locationId } = useLocationFilter();
  const { locations } = useLocationColors();
  const posts = useBusinessPosts(locationId);
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<{ key: number; value: PostDraft } | null>(null);
  const todayKey = useSyncExternalStore(
    noop,
    () => isoDay(new Date()),
    () => null,
  );

  useEffect(() => {
    if (!loading && !connected) router.replace("/business/connect");
  }, [loading, connected, router]);

  const all = useMemo(() => posts.data?.data ?? [], [posts.data]);
  const defaultLoc = locationId ?? locations[0]?.id ?? "";
  const canCreate = todayKey !== null && Boolean(defaultLoc);
  const open = (value: PostDraft) => setDraft({ key: Date.now(), value });

  const week = useMemo(() => {
    if (!todayKey) return [];
    const today = new Date(`${todayKey}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const key = isoDay(d);
      return {
        key,
        i,
        wd: d.toLocaleDateString("en", { weekday: "short" }),
        num: d.getDate(),
        full: d.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }),
        items: all.filter((p) => isoDay(new Date(dateOf(p))) === key),
      };
    });
  }, [all, todayKey]);

  const count = (s: GbpPost["status"]) => all.filter((p) => p.status === s).length;
  const failed = count("failed");
  const rows = all
    .filter((p) => filter === "all" || p.status === filter)
    .sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  const locName = (id: string) => locations.find((l) => l.id === id)?.title ?? "";
  const emptyText =
    filter === "all"
      ? "No posts yet"
      : filter === "draft"
        ? "No drafts"
        : `No ${STATUS[filter].label.toLowerCase()} posts`;

  return (
    <div className="gb-posts">
      <section className="gb-posts-week-card" aria-labelledby="gb-posts-week-title">
        <div className="gb-posts-week-head">
          <h2 id="gb-posts-week-title" className="gb-title" style={{ margin: 0 }}>
            This week
          </h2>
          <button
            type="button"
            className="gb-btn gb-btn-dark gb-posts-new"
            disabled={!canCreate}
            onClick={() => open(newDraft(defaultLoc, "now"))}
          >
            <span className="gb-posts-new-plus" aria-hidden>
              +
            </span>
            New post
          </button>
        </div>
        <div className="gb-posts-week">
          {week.length
            ? week.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className="gb-posts-day"
                  data-today={d.i === 0}
                  disabled={!canCreate}
                  aria-label={`${d.i === 0 ? "Today, " : ""}${d.full}: ${
                    d.items.length
                      ? `${d.items.length} post${d.items.length === 1 ? "" : "s"}`
                      : "no posts"
                  }. Plan a post`}
                  onClick={() =>
                    open(
                      d.i === 0
                        ? newDraft(defaultLoc, "now")
                        : newDraft(defaultLoc, "schedule", d.key),
                    )
                  }
                >
                  <span className="gb-posts-day-top">
                    <span className="gb-posts-day-wd">{d.wd}</span>
                    <span className="gb-posts-day-num">{d.num}</span>
                  </span>
                  {d.items.map((p) => (
                    <span
                      key={p.id}
                      className={`gb-posts-chip gb-posts-tone-${STATUS[p.status].tone}`}
                    >
                      <span className="gb-posts-chip-text">{textOf(p)}</span>
                    </span>
                  ))}
                  {!d.items.length ? (
                    <span className="gb-posts-day-plus" aria-hidden>
                      +
                    </span>
                  ) : null}
                </button>
              ))
            : Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="gb-posts-day" aria-hidden>
                  <Skel h={14} w={48} r={4} />
                </div>
              ))}
        </div>
      </section>

      <div className="gb-posts-list-wrap">
        <Seg
          label="Filter posts"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All", n: all.length },
            { id: "scheduled", label: "Scheduled", n: count("scheduled") },
            { id: "published", label: "Live", n: count("published") },
            { id: "draft", label: "Drafts", n: count("draft") },
            ...(failed || filter === "failed"
              ? [{ id: "failed" as const, label: "Failed", n: failed }]
              : []),
          ]}
        />
        {posts.isPending ? (
          <div className="gb-posts-list" style={{ padding: 16, display: "grid", gap: 12 }}>
            <Skel h={44} />
            <Skel h={44} />
          </div>
        ) : posts.isError ? (
          <Notice tone="error">{errorMessage(posts.error)}</Notice>
        ) : rows.length ? (
          <div className="gb-posts-list">
            {rows.map((p) => {
              const type = TYPE_LABEL[p.content.type];
              return (
                <button
                  key={p.id}
                  type="button"
                  className="gb-posts-row"
                  onClick={() => open(draftFromPost(p))}
                >
                  <span className="gb-posts-thumb" aria-hidden>
                    {p.content.mediaUrl ? (
                      <Image unoptimized src={p.content.mediaUrl} alt="" width={44} height={44} />
                    ) : (
                      type[0]
                    )}
                  </span>
                  <span className="gb-posts-row-main">
                    <span className="gb-posts-row-text">{textOf(p)}</span>
                    <span className="gb-posts-row-meta">
                      {type}
                      {locName(p.locationId) ? ` · ${locName(p.locationId)}` : ""}
                    </span>
                  </span>
                  <span className="gb-posts-row-when">
                    {p.status === "draft" ? "Not posted" : fmtWhen(dateOf(p))}
                  </span>
                  <span className={PILL[p.status]}>{STATUS[p.status].label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="gb-posts-empty">
            <span style={{ fontSize: 14, color: "var(--gb-faint)" }}>{emptyText}</span>
            <button
              type="button"
              className="gb-btn"
              disabled={!canCreate}
              onClick={() => open(newDraft(defaultLoc, "now"))}
            >
              Create a post
            </button>
          </div>
        )}
      </div>

      {draft ? (
        <PostComposer key={draft.key} initial={draft.value} onClose={() => setDraft(null)} />
      ) : null}
    </div>
  );
}
