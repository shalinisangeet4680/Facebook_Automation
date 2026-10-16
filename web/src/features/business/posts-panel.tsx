"use client";

import Image from "next/image";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpPost,
  type GbpPostContent,
  useBusinessPosts,
  useDeleteBusinessPost,
  useSaveBusinessPost,
} from "@/lib/api/business";
import { Select } from "@/features/replyly/select";
import { ago, rowBorder } from "@/features/replyly/tokens";
import { Seg, Skel, Spinner, useToast } from "@/features/replyly/ui";

import { DateTimePicker, fmtDateTime } from "./date-time-picker";
import { useLocationColors } from "./shell";

const MUTED = "#6C6962";
const MAX = 1500;

const CTA = [
  ["none", "No button"],
  ["LEARN_MORE", "Learn more"],
  ["BOOK", "Book"],
  ["ORDER", "Order online"],
  ["SHOP", "Buy"],
  ["SIGN_UP", "Sign up"],
  ["CALL", "Call now"],
] as const;

const TYPE_LABEL = { STANDARD: "Update", OFFER: "Offer", EVENT: "Event" } as const;

const STATUS_STYLE: Record<GbpPost["status"], [string, string, string]> = {
  published: ["#EAF3EE", "#0F6B4A", "Live"],
  scheduled: ["#ECEFF6", "#3B4A6B", "Scheduled"],
  draft: ["#EFEDE8", "#55534E", "Draft"],
  failed: ["#FDF0EE", "#B42318", "Failed"],
};

type Type = GbpPostContent["type"];

interface Draft {
  id?: string;
  locationId: string;
  type: Type;
  summary: string;
  mediaUrl: string;
  cta: (typeof CTA)[number][0];
  ctaUrl: string;
  title: string;
  start: string | null;
  end: string | null;
  coupon: string;
  redeemUrl: string;
  terms: string;
  when: "now" | "schedule" | "draft";
  scheduledAt: string | null;
}

const blank = (locationId: string): Draft => ({
  locationId,
  type: "STANDARD",
  summary: "",
  mediaUrl: "",
  cta: "none",
  ctaUrl: "",
  title: "",
  start: null,
  end: null,
  coupon: "",
  redeemUrl: "",
  terms: "",
  when: "now",
  scheduledAt: null,
});

const fromPost = (p: GbpPost): Draft => ({
  id: p.id,
  locationId: p.locationId,
  type: p.content.type,
  summary: p.content.summary,
  mediaUrl: p.content.mediaUrl ?? "",
  cta: p.content.cta?.type ?? "none",
  ctaUrl: p.content.cta?.url ?? "",
  title: p.content.event?.title ?? "",
  start: p.content.event?.start ?? null,
  end: p.content.event?.end ?? null,
  coupon: p.content.offer?.couponCode ?? "",
  redeemUrl: p.content.offer?.redeemUrl ?? "",
  terms: p.content.offer?.terms ?? "",
  when: p.status === "scheduled" ? "schedule" : "now",
  scheduledAt: p.scheduledAt,
});

function toContent(d: Draft): GbpPostContent {
  return {
    type: d.type,
    summary: d.summary,
    mediaUrl: d.mediaUrl.trim() || null,
    cta:
      d.cta === "none"
        ? null
        : { type: d.cta, url: d.cta === "CALL" ? null : d.ctaUrl.trim() || null },
    event:
      d.type === "STANDARD" ? null : { title: d.title, start: d.start ?? "", end: d.end ?? "" },
    offer:
      d.type === "OFFER"
        ? {
            couponCode: d.coupon.trim() || null,
            redeemUrl: d.redeemUrl.trim() || null,
            terms: d.terms.trim() || null,
          }
        : null,
  };
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="rp-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="rp-label">{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 12, color: MUTED }}>{hint}</span> : null}
    </label>
  );
}

function Composer({
  initial,
  fixedLocation,
  onDone,
}: {
  initial: Draft;
  fixedLocation?: boolean;
  onDone: () => void;
}) {
  const toast = useToast();
  const save = useSaveBusinessPost();
  const { locations, color } = useLocationColors();
  const [d, setD] = useState(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const len = [...d.summary].length;
  const location = locations.find((l) => l.id === d.locationId);

  function submit(when: Draft["when"]) {
    save.mutate(
      {
        id: d.id,
        locationId: d.locationId,
        content: toContent(d),
        when,
        scheduledAt: when === "schedule" ? d.scheduledAt : null,
      },
      {
        onSuccess: (p) => {
          toast(
            p.status === "published"
              ? "Posted on Google"
              : p.status === "scheduled"
                ? `Scheduled for ${fmtDateTime(p.scheduledAt!)}`
                : "Draft saved",
          );
          onDone();
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  }

  return (
    <div
      className="rp-card"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))",
      }}
    >
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Seg
            label="Post type"
            value={d.type}
            onChange={(v) => set("type", v)}
            small
            options={(["STANDARD", "OFFER", "EVENT"] as const).map((t) => ({
              id: t,
              label: TYPE_LABEL[t],
            }))}
          />
          {!fixedLocation ? (
            <Select
              label="Location"
              value={d.locationId}
              onChange={(v) => set("locationId", v)}
              minWidth={200}
              options={locations.map((l) => ({ value: l.id, label: l.title, dot: color(l.id) }))}
            />
          ) : null}
        </div>
        {d.type !== "STANDARD" ? (
          <Field label={d.type === "OFFER" ? "Offer title" : "Event title"}>
            <input
              className="rp-input"
              value={d.title}
              maxLength={58}
              onChange={(e) => set("title", e.target.value)}
              placeholder={d.type === "OFFER" ? "Diwali smile offer" : "Free dental check-up camp"}
            />
          </Field>
        ) : null}
        <Field
          label="Text"
          hint={`${len}/${MAX} · Keep it short. Phone numbers in the text are often rejected; use the Call button.`}
        >
          <textarea
            className="rp-textarea"
            rows={5}
            value={d.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="What’s new at your business?"
            style={{ resize: "vertical" }}
          />
        </Field>
        {d.type !== "STANDARD" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Starts">
              <DateTimePicker label="Start" value={d.start} onChange={(v) => set("start", v)} />
            </Field>
            <Field label="Ends">
              <DateTimePicker
                label="End"
                value={d.end}
                min={d.start ?? undefined}
                onChange={(v) => set("end", v)}
              />
            </Field>
          </div>
        ) : null}
        {d.type === "OFFER" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Coupon code">
              <input
                className="rp-input"
                value={d.coupon}
                maxLength={58}
                onChange={(e) => set("coupon", e.target.value)}
                placeholder="SMILE20"
              />
            </Field>
            <Field label="Redeem link">
              <input
                className="rp-input"
                value={d.redeemUrl}
                onChange={(e) => set("redeemUrl", e.target.value)}
                placeholder="https://"
              />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Terms">
                <input
                  className="rp-input"
                  value={d.terms}
                  onChange={(e) => set("terms", e.target.value)}
                  placeholder="One per customer. Valid on weekdays."
                />
              </Field>
            </div>
          </div>
        ) : null}
        <Field
          label="Photo link"
          hint="A public https image, at least 400×300. Creatives from TreeVook work here."
        >
          <input
            className="rp-input"
            value={d.mediaUrl}
            onChange={(e) => set("mediaUrl", e.target.value)}
            placeholder="https://"
          />
        </Field>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: d.cta === "none" || d.cta === "CALL" ? "1fr" : "1fr 1.4fr",
            gap: 10,
          }}
        >
          <Field label="Button">
            <Select
              label="Button"
              value={d.cta}
              onChange={(v) => set("cta", v as Draft["cta"])}
              block
              align="start"
              options={CTA.map(([value, label]) => ({ value, label }))}
            />
          </Field>
          {d.cta !== "none" && d.cta !== "CALL" ? (
            <Field label="Button link">
              <input
                className="rp-input"
                value={d.ctaUrl}
                onChange={(e) => set("ctaUrl", e.target.value)}
                placeholder="https://"
              />
            </Field>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            paddingTop: 4,
            borderTop: "1px solid #EFEDE8",
          }}
        >
          <Seg
            label="When"
            value={d.when}
            onChange={(v) => set("when", v)}
            small
            options={[
              { id: "now", label: "Post now" },
              { id: "schedule", label: "Schedule" },
            ]}
          />
          {d.when === "schedule" ? (
            <DateTimePicker
              label="Publish at"
              value={d.scheduledAt}
              onChange={(v) => set("scheduledAt", v)}
            />
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" className="rp-btn-text" onClick={onDone}>
              Cancel
            </button>
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "8px 14px" }}
              disabled={save.isPending}
              onClick={() => submit("draft")}
            >
              Save draft
            </button>
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "8px 16px" }}
              disabled={
                save.isPending ||
                !d.summary.trim() ||
                len > MAX ||
                (d.when === "schedule" && !d.scheduledAt)
              }
              onClick={() => submit(d.when)}
            >
              {save.isPending ? <Spinner size={11} /> : null}
              {d.when === "now" ? "Post to Google" : "Schedule post"}
            </button>
          </div>
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
        }}
      >
        <span className="rp-label">Preview</span>
        <PostPreview content={toContent(d)} name={location?.title ?? "Your business"} />
      </div>
    </div>
  );
}

function PostPreview({ content, name }: { content: GbpPostContent; name: string }) {
  const cta = CTA.find(([v]) => v === content.cta?.type)?.[1];
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E6E4DF",
        borderRadius: 12,
        overflow: "hidden",
        maxWidth: 380,
      }}
    >
      {content.mediaUrl ? (
        <Image
          unoptimized
          src={content.mediaUrl}
          alt=""
          width={400}
          height={300}
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            objectFit: "cover",
            display: "block",
            background: "#EFEDE8",
          }}
        />
      ) : (
        <div
          style={{
            aspectRatio: "4 / 3",
            background: "linear-gradient(135deg,#EFEDE8,#F7F6F3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: MUTED,
            fontSize: 12.5,
          }}
        >
          No photo
        </div>
      )}
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 12, color: MUTED }}>{name}</span>
        {content.event?.title ? (
          <span style={{ fontWeight: 600 }}>{content.event.title}</span>
        ) : null}
        {content.event?.start && content.event.end ? (
          <span style={{ fontSize: 12, color: MUTED }}>
            {fmtDateTime(content.event.start)} – {fmtDateTime(content.event.end)}
          </span>
        ) : null}
        <span
          style={{
            fontSize: 13.5,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {content.summary || <span style={{ color: MUTED }}>Your text appears here.</span>}
        </span>
        {content.offer?.couponCode ? (
          <span
            className="rp-mono"
            style={{
              alignSelf: "flex-start",
              padding: "4px 10px",
              border: "1px dashed #0F6B4A",
              borderRadius: 6,
              color: "#0F6B4A",
              fontSize: 12.5,
            }}
          >
            {content.offer.couponCode}
          </span>
        ) : null}
        {cta ? (
          <span style={{ color: "#1A73E8", fontWeight: 500, fontSize: 13.5 }}>{cta}</span>
        ) : null}
      </div>
    </div>
  );
}

export function PostsPanel({ locationId }: { locationId?: string }) {
  const toast = useToast();
  const posts = useBusinessPosts(locationId);
  const remove = useDeleteBusinessPost();
  const { locations, color } = useLocationColors();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<"all" | GbpPost["status"]>("all");
  const list = (posts.data?.data ?? []).filter((p) => filter === "all" || p.status === filter);
  const count = (s: GbpPost["status"]) =>
    (posts.data?.data ?? []).filter((p) => p.status === s).length;
  const firstLocation = locationId ?? locations[0]?.id ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {editing ? (
        <Composer
          key={editing.id ?? "new"}
          initial={editing}
          fixedLocation={Boolean(locationId)}
          onDone={() => setEditing(null)}
        />
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Seg
            label="Filter posts"
            value={filter}
            onChange={setFilter}
            small
            options={[
              { id: "all", label: "All", n: posts.data?.data.length ?? 0 },
              { id: "published", label: "Live", n: count("published") },
              { id: "scheduled", label: "Scheduled", n: count("scheduled") },
              { id: "draft", label: "Drafts", n: count("draft") },
              { id: "failed", label: "Failed", n: count("failed") },
            ]}
          />
          <button
            type="button"
            className="rp-btn"
            style={{ padding: "8px 14px" }}
            disabled={!firstLocation}
            onClick={() => setEditing(blank(firstLocation))}
          >
            New post
          </button>
        </div>
      )}
      {posts.isPending ? (
        <Skel h={160} />
      ) : list.length ? (
        <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
          {list.map((p, i) => {
            const [bg, fg, label] = STATUS_STYLE[p.status];
            const loc = locations.find((l) => l.id === p.locationId);
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "14px 16px",
                  borderTop: rowBorder(i),
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                {p.content.mediaUrl ? (
                  <Image
                    unoptimized
                    src={p.content.mediaUrl}
                    alt=""
                    width={64}
                    height={48}
                    style={{
                      borderRadius: 8,
                      objectFit: "cover",
                      flexShrink: 0,
                      background: "#EFEDE8",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 64,
                      height: 48,
                      borderRadius: 8,
                      background: "#F4F2EE",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    flex: 1,
                    minWidth: 220,
                  }}
                >
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
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: bg,
                        color: fg,
                        fontWeight: 500,
                      }}
                    >
                      {label}
                    </span>
                    <span>{TYPE_LABEL[p.type]}</span>
                    {!locationId && loc ? (
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 3,
                            background: color(loc.id),
                          }}
                        />
                        {loc.title}
                      </span>
                    ) : null}
                    <span>
                      {p.status === "published" && p.publishedAt
                        ? `posted ${ago(p.publishedAt)}`
                        : p.status === "scheduled" && p.scheduledAt
                          ? `goes live ${fmtDateTime(p.scheduledAt)}`
                          : `created ${ago(p.createdAt)}`}
                      {p.source.startsWith("mcp:") ? ` · by ${p.source.slice(4)}` : ""}
                    </span>
                  </span>
                  {p.content.event?.title ? (
                    <span style={{ fontWeight: 500 }}>{p.content.event.title}</span>
                  ) : null}
                  <span
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {p.content.summary}
                  </span>
                  {p.error ? (
                    <span style={{ fontSize: 12, color: "#B42318" }}>{p.error}</span>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {p.searchUrl ? (
                    <a href={p.searchUrl} target="_blank" rel="noreferrer" className="rp-btn-text">
                      View on Google
                    </a>
                  ) : null}
                  {p.status !== "published" ? (
                    <button
                      type="button"
                      className="rp-btn-text"
                      onClick={() => setEditing(fromPost(p))}
                    >
                      Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rp-btn-text"
                    style={{ color: "#B42318" }}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          p.status === "published"
                            ? "Delete this post from Google?"
                            : "Delete this post?",
                        )
                      )
                        remove.mutate(p.id, {
                          onSuccess: () => toast("Post deleted"),
                          onError: (err) => toast(errorMessage(err)),
                        });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rp-card" style={{ padding: 24, color: MUTED, fontSize: 13.5 }}>
          {filter === "all"
            ? "No posts yet. Updates, offers and events keep your profile fresh and show up in Search and Maps."
            : "Nothing here."}
        </div>
      )}
    </div>
  );
}
