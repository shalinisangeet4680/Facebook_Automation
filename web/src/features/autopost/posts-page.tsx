"use client";

import Image from "next/image";
import { useState } from "react";

import {
  type AutopostPost,
  type AutopostStatus,
  type SocialPlatform,
  useAutopostPosts,
} from "@/lib/api/autopost";
import { ago, rowBorder } from "@/features/replyly/tokens";
import { PageHead, Seg, Skel } from "@/features/replyly/ui";

import {
  AccountAlerts,
  AccountSelect,
  Empty,
  MUTED,
  StatusPill,
  fmtWhen,
  useConnectedGuard,
} from "./common";
import { Composer } from "./composer";
import { CONTENT_LABEL, FORMAT_LABEL, MODE_TEXT, PLATFORMS } from "./platform";

type Filter = "all" | AutopostStatus;

const FILTERS: { id: Filter; label: string; statuses?: string }[] = [
  { id: "all", label: "All" },
  { id: "pending_approval", label: "Needs approval", statuses: "pending_approval" },
  { id: "scheduled", label: "Scheduled", statuses: "scheduled,publishing" },
  { id: "published", label: "Published", statuses: "published" },
  { id: "draft", label: "Drafts", statuses: "draft" },
  { id: "failed", label: "Failed", statuses: "failed" },
];

function Row({
  post,
  i,
  color,
  account,
  onOpen,
}: {
  post: AutopostPost;
  i: number;
  color: string;
  account: string;
  onOpen: () => void;
}) {
  const thumb = post.media.find((m) => m.kind === "image")?.url;
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        padding: "14px 16px",
        borderTop: rowBorder(i),
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      {thumb ? (
        <Image
          unoptimized
          src={thumb}
          alt=""
          width={56}
          height={56}
          style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "#EFEDE8" }}
        />
      ) : (
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 8,
            background: "#F4F2EE",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: MUTED,
          }}
        >
          {FORMAT_LABEL[post.format]}
        </span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 220 }}>
        <span
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            fontSize: 12,
            color: MUTED,
          }}
        >
          <StatusPill status={post.status} />
          <span>{FORMAT_LABEL[post.format]}</span>
          <span>· {CONTENT_LABEL[post.contentType]}</span>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: color }} />
            {account}
          </span>
          <span>
            {post.status === "published" && post.publishedAt
              ? `posted ${ago(post.publishedAt)}`
              : post.scheduledAt
                ? fmtWhen(post.scheduledAt)
                : `created ${ago(post.createdAt)}`}
          </span>
          {post.status !== "published" ? <span>· {MODE_TEXT[post.mode]}</span> : null}
          {post.source.startsWith("mcp:") ? <span>· by {post.source.slice(4)}</span> : null}
        </span>
        <span
          style={{
            fontSize: 13.5,
            lineHeight: 1.5,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflowWrap: "anywhere",
          }}
        >
          {post.caption || post.idea || "No caption yet"}
        </span>
        {post.heldReason ? (
          <span style={{ fontSize: 12, color: "#8A5A00" }}>{post.heldReason}</span>
        ) : null}
        {post.error ? <span style={{ fontSize: 12, color: "#B42318" }}>{post.error}</span> : null}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {post.permalink ? (
          <a href={post.permalink} target="_blank" rel="noreferrer" className="rp-btn-text">
            View
          </a>
        ) : null}
        {post.status !== "published" && post.status !== "cancelled" ? (
          <button type="button" className="rp-btn-text" onClick={onOpen}>
            Open
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PostsPage({ platform }: { platform: SocialPlatform }) {
  const { color, label, accounts } = useConnectedGuard(platform);
  const [filter, setFilter] = useState<Filter>("all");
  const [accountId, setAccountId] = useState("all");
  const [editing, setEditing] = useState<{ post?: AutopostPost } | null>(null);
  const statuses = FILTERS.find((f) => f.id === filter)?.statuses;
  const posts = useAutopostPosts(platform, statuses, accountId === "all" ? undefined : accountId);
  const list = posts.data?.data ?? [];

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHead
        title="Posts"
        sub={`Everything planned, waiting and published on ${PLATFORMS[platform].name}.`}
        actions={
          <button
            type="button"
            className="rp-btn"
            style={{ padding: "8px 14px" }}
            onClick={() => setEditing({})}
          >
            New post
          </button>
        }
      />
      <AccountAlerts platform={platform} />
      {editing ? (
        <Composer
          key={editing.post?.id ?? "new"}
          platform={platform}
          post={editing.post}
          accountId={accountId === "all" ? undefined : accountId}
          onDone={() => setEditing(null)}
        />
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
        <Seg
          label="Filter posts"
          value={filter}
          small
          onChange={setFilter}
          options={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
        />
        {accounts.length > 1 ? (
          <AccountSelect platform={platform} value={accountId} onChange={setAccountId} all />
        ) : null}
      </div>
      {posts.isPending ? (
        <Skel h={180} />
      ) : list.length ? (
        <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
          {list.map((p, i) => (
            <Row
              key={p.id}
              post={p}
              i={i}
              color={color(p.accountId)}
              account={label(p.accountId)}
              onOpen={() => setEditing({ post: p })}
            />
          ))}
        </div>
      ) : (
        <Empty>
          {filter === "all"
            ? "No posts yet. Plan a week from the Calendar or create one here."
            : "Nothing here."}
        </Empty>
      )}
    </div>
  );
}
