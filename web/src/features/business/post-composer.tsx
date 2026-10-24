"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpPost,
  type GbpPostContent,
  useDeleteBusinessPost,
  useSaveBusinessPost,
} from "@/lib/api/business";
import { isoDay } from "@/features/replyly/range-calendar";
import { Spinner, useToast } from "@/features/replyly/ui";

import { useLocationColors } from "./shell";
import { Drawer, Icon, Notice } from "./ui";
import "./posts.css";

export const POST_MAX = 1500;

type PostType = GbpPostContent["type"];
type CtaType = NonNullable<GbpPostContent["cta"]>["type"];

export const TYPE_LABEL: Record<PostType, string> = {
  STANDARD: "Update",
  OFFER: "Offer",
  EVENT: "Event",
};

export const STATUS: Record<GbpPost["status"], { label: string; tone: string }> = {
  published: { label: "Live", tone: "live" },
  scheduled: { label: "Scheduled", tone: "scheduled" },
  draft: { label: "Draft", tone: "draft" },
  failed: { label: "Failed", tone: "failed" },
};

export const PILL: Record<GbpPost["status"], string> = {
  published: "gb-pill gb-pill-green",
  scheduled: "gb-pill gb-pill-amber",
  draft: "gb-pill gb-pill-grey",
  failed: "gb-pill gb-pill-red",
};

const TABS: [PostType, string][] = [
  ["STANDARD", "✎"],
  ["OFFER", "%"],
  ["EVENT", "▦"],
];

const CTAS: [CtaType | "none", string][] = [
  ["none", "None"],
  ["LEARN_MORE", "Learn more"],
  ["BOOK", "Book"],
  ["ORDER", "Order online"],
  ["SHOP", "Buy"],
  ["SIGN_UP", "Sign up"],
  ["CALL", "Call now"],
];

const PLACEHOLDER: Record<PostType, string> = {
  STANDARD: "What’s new?",
  OFFER: "Describe your offer…",
  EVENT: "What’s happening?",
};

const MEDIA_HINT: Record<PostType, string> = {
  STANDARD: "Show what’s new",
  OFFER: "Make the offer pop",
  EVENT: "Showcase your event with images",
};

export interface PostDraft {
  id?: string;
  status?: GbpPost["status"];
  error?: string | null;
  searchUrl?: string | null;
  publishedAt?: string | null;
  locationId: string;
  type: PostType;
  summary: string;
  mediaUrl: string;
  cta: CtaType | "none";
  ctaUrl: string;
  title: string;
  start: string;
  end: string;
  coupon: string;
  redeemUrl: string;
  terms: string;
  when: "now" | "schedule";
  at: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export const localInput = (d: Date) => `${isoDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const atTime = (day: string, h: number, m: number) =>
  new Date(`${day}T${pad(h)}:${pad(m)}:00`).toISOString();

const withDay = (iso: string, day: string, fallback: [number, number]) => {
  const prev = iso ? new Date(iso) : null;
  return prev && !Number.isNaN(prev.getTime())
    ? atTime(day, prev.getHours(), prev.getMinutes())
    : atTime(day, ...fallback);
};

const dayOf = (iso: string) => (iso && !Number.isNaN(Date.parse(iso)) ? isoDay(new Date(iso)) : "");

const isHttps = (u: string) => /^https:\/\/[^\s]+\.[^\s]+$/.test(u.trim());

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function newDraft(locationId: string, when: "now" | "schedule", day?: string): PostDraft {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const week = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);
  return {
    locationId,
    type: "STANDARD",
    summary: "",
    mediaUrl: "",
    cta: "none",
    ctaUrl: "",
    title: "",
    start: atTime(isoDay(today), 0, 0),
    end: atTime(isoDay(week), 23, 59),
    coupon: "",
    redeemUrl: "",
    terms: "",
    when,
    at: `${day ?? isoDay(tomorrow)}T10:00`,
  };
}

export function draftFromPost(p: GbpPost): PostDraft {
  const base = newDraft(p.locationId, p.status === "scheduled" ? "schedule" : "now");
  return {
    ...base,
    id: p.id,
    status: p.status,
    error: p.error,
    searchUrl: p.searchUrl,
    publishedAt: p.publishedAt,
    type: p.content.type,
    summary: p.content.summary,
    mediaUrl: p.content.mediaUrl ?? "",
    cta: p.content.cta?.type ?? "none",
    ctaUrl: p.content.cta?.url ?? "",
    title: p.content.event?.title ?? "",
    start: p.content.event?.start || base.start,
    end: p.content.event?.end || base.end,
    coupon: p.content.offer?.couponCode ?? "",
    redeemUrl: p.content.offer?.redeemUrl ?? "",
    terms: p.content.offer?.terms ?? "",
    at: p.scheduledAt ? localInput(new Date(p.scheduledAt)) : base.at,
  };
}

function toContent(d: PostDraft): GbpPostContent {
  return {
    type: d.type,
    summary: d.summary.trim(),
    mediaUrl: d.mediaUrl.trim() || null,
    cta:
      d.cta === "none"
        ? null
        : { type: d.cta, url: d.cta === "CALL" ? null : d.ctaUrl.trim() || null },
    event: d.type === "STANDARD" ? null : { title: d.title.trim(), start: d.start, end: d.end },
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

function problemsOf(d: PostDraft): string[] {
  const out: string[] = [];
  if (!d.locationId) out.push("Choose a location.");
  if (!d.summary.trim()) out.push("Write the post text.");
  if ([...d.summary].length > POST_MAX) out.push(`Keep the text under ${POST_MAX} characters.`);
  if (d.mediaUrl && !isHttps(d.mediaUrl)) out.push("The photo must be an https link.");
  if (d.cta !== "none" && d.cta !== "CALL" && !isHttps(d.ctaUrl))
    out.push("Add an https link for the button.");
  if (d.type !== "STANDARD") {
    if (!d.title.trim())
      out.push(d.type === "OFFER" ? "Give the offer a title." : "Give the event a title.");
    if (!dayOf(d.start) || !dayOf(d.end)) out.push("Choose a start and end date.");
    else if (Date.parse(d.end) < Date.parse(d.start)) out.push("The end must be after the start.");
  }
  if (d.type === "OFFER" && d.redeemUrl.trim() && !isHttps(d.redeemUrl))
    out.push("The redeem link must be an https link.");
  if (d.when === "schedule") {
    const at = Date.parse(d.at);
    if (Number.isNaN(at)) out.push("Choose when to publish.");
    else if (at < Date.now() + 60_000) out.push("Schedule at least a minute ahead.");
    else if (at > Date.now() + 365 * 86_400_000) out.push("Schedule within a year.");
  }
  return out;
}

const fileName = (url: string) => {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : new URL(url).hostname;
  } catch {
    return url;
  }
};

function CalIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function PhotoIcon({ size = 18, stroke = 1.8 }: { size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m21 16-5-5-9 9" />
    </svg>
  );
}

export function PostComposer({ initial, onClose }: { initial: PostDraft; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveBusinessPost();
  const remove = useDeleteBusinessPost();
  const { locations, color } = useLocationColors();
  const [d, setD] = useState(initial);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState(false);
  const [badImg, setBadImg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof PostDraft>(k: K, v: PostDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  const editing = Boolean(d.id);
  const live = d.status === "published";
  const location = locations.find((l) => l.id === d.locationId);
  const locName = location?.title ?? "Choose a location";
  const locColor = location ? color(location.id) : "var(--gb-faint)";
  const typeLabel = TYPE_LABEL[d.type];
  const len = [...d.summary].length;
  const problems = problemsOf(d);
  const busy = save.isPending || remove.isPending;
  const scheduled = d.when === "schedule";
  const hasDates = d.type !== "STANDARD";
  const photo = d.mediaUrl && isHttps(d.mediaUrl) ? d.mediaUrl : "";
  const showPhoto = photo && badImg !== photo;
  const ctaLabel = CTAS.find(([v]) => v === d.cta)?.[1];
  const needsUrl = d.cta !== "none" && d.cta !== "CALL";
  const touched = Boolean(d.summary.trim() || d.mediaUrl || d.title.trim());

  useEffect(() => {
    if (!live) textRef.current?.focus();
  }, [live]);

  function addLink() {
    const url = link.trim();
    if (!isHttps(url)) {
      setLinkError(true);
      return;
    }
    setLinkError(false);
    setBadImg(null);
    set("mediaUrl", url);
    setLink("");
  }

  function submit(when: "now" | "schedule" | "draft") {
    if (when === "draft" && !d.summary.trim()) {
      toast("Write something first");
      return;
    }
    save.mutate(
      {
        id: d.id,
        locationId: d.locationId,
        content: toContent(d),
        when,
        scheduledAt: when === "schedule" ? new Date(d.at).toISOString() : null,
      },
      {
        onSuccess: (p) => {
          toast(
            p.status === "published"
              ? "Posted to Google"
              : p.status === "scheduled"
                ? "Post scheduled"
                : p.status === "failed"
                  ? `Couldn’t post: ${p.error ?? "Google rejected it"}`
                  : "Draft saved",
          );
          onClose();
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  }

  function destroy() {
    if (!d.id) return;
    remove.mutate(d.id, {
      onSuccess: () => {
        toast("Post deleted");
        onClose();
      },
      onError: (err) => toast(errorMessage(err)),
    });
  }

  const prevWhen = live
    ? d.publishedAt
      ? fmtWhen(d.publishedAt)
      : "Live"
    : scheduled && !Number.isNaN(Date.parse(d.at))
      ? fmtWhen(d.at)
      : "Just now";
  const headline = hasDates ? d.title.trim() : d.summary;
  const headlineFallback = hasDates
    ? d.type === "OFFER"
      ? "Your offer title"
      : "Your event title"
    : "Your post appears here";

  return (
    <Drawer onClose={onClose} label={editing ? "Edit post" : "New post"}>
      <div className="gb-pc">
        <div className="gb-pc-main">
          <div className="gb-pc-head">
            <div className="gb-pc-tabs" role="tablist" aria-label="Post type">
              {TABS.map(([t, icon]) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={d.type === t}
                  className="gb-pc-tab"
                  disabled={live}
                  onClick={() => set("type", t)}
                >
                  <span className="gb-pc-tab-icon" aria-hidden>
                    {icon}
                  </span>
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <span className="gb-pc-spacer" />
            {editing ? (
              <button
                type="button"
                className="gb-pc-close gb-pc-trash"
                aria-label="Delete post"
                title="Delete post"
                disabled={busy || confirming}
                onClick={() => setConfirming(true)}
              >
                <Icon name="trash" size={18} />
              </button>
            ) : null}
            <button type="button" className="gb-pc-close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="gb-pc-body">
            <fieldset className="gb-pc-form" disabled={live || busy}>
              <legend className="sr-only">{editing ? "Edit post" : "New post"}</legend>
              {d.status === "failed" && d.error ? (
                <Notice tone="error">Google rejected this post: {d.error}</Notice>
              ) : null}
              {live ? (
                <Notice tone="ok">
                  This post is live on Google. Published posts can’t be edited there — delete it and
                  post again to change it.
                </Notice>
              ) : null}
              <div className="gb-pc-loc">
                <span
                  className="gb-swatch"
                  aria-hidden
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: locColor,
                    fontSize: 15,
                  }}
                >
                  {initials(location?.title ?? "")}
                </span>
                <div className="gb-pc-loc-info">
                  <div className="gb-pc-loc-pick">
                    <span className="gb-pc-loc-name">{locName}</span>
                    {!editing && locations.length > 1 ? (
                      <>
                        <svg width="11" height="7" viewBox="0 0 10 6" aria-hidden>
                          <path
                            d="M1 1l4 4 4-4"
                            stroke="#55554F"
                            strokeWidth="1.6"
                            fill="none"
                            strokeLinecap="round"
                          />
                        </svg>
                        <select
                          aria-label="Post to location"
                          value={d.locationId}
                          onChange={(e) => set("locationId", e.target.value)}
                        >
                          {locations.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.title}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : null}
                  </div>
                  <span className="gb-pc-loc-sub">Google post · {typeLabel}</span>
                </div>
              </div>

              {live && !photo ? null : (
                <div className="gb-pc-media" data-photo={Boolean(showPhoto)}>
                  {photo ? (
                    <>
                      {showPhoto ? (
                        <Image
                          unoptimized
                          src={photo}
                          alt="Post photo"
                          fill
                          sizes="640px"
                          className="gb-pc-media-img"
                          onError={() => setBadImg(photo)}
                        />
                      ) : (
                        <span className="gb-pc-err" role="alert">
                          Couldn’t load this image. Check that the link is a public image.
                        </span>
                      )}
                      <button
                        type="button"
                        className="gb-pc-media-remove"
                        aria-label="Remove photo"
                        title="Remove"
                        onClick={() => {
                          set("mediaUrl", "");
                          setBadImg(null);
                        }}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                      <span className="gb-pc-media-name">{fileName(photo)}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "var(--gb-ink-2)" }}>
                        <PhotoIcon size={30} />
                      </span>
                      <span className="gb-pc-media-title">Add a photo</span>
                      <span className="gb-pc-media-hint">{MEDIA_HINT[d.type]}</span>
                      <div className="gb-pc-media-add">
                        <input
                          ref={linkRef}
                          className="gb-input"
                          type="url"
                          inputMode="url"
                          aria-label="Photo link"
                          aria-invalid={linkError}
                          placeholder="Paste a public https image link"
                          value={link}
                          onChange={(e) => {
                            setLink(e.target.value);
                            setLinkError(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addLink();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="gb-pc-outline"
                          disabled={!link.trim()}
                          onClick={addLink}
                        >
                          <PhotoIcon />
                          Add photo
                        </button>
                      </div>
                      {linkError ? (
                        <span className="gb-pc-err" role="alert">
                          Use a full https link to an image.
                        </span>
                      ) : null}
                      <span className="gb-pc-media-rec">
                        Recommended: 1200 × 900 px, at least 400 × 300
                      </span>
                    </>
                  )}
                </div>
              )}

              {hasDates ? (
                <label className="gb-pc-section">
                  <span className="gb-pc-label">
                    {d.type === "OFFER" ? "Offer title" : "Event title"}
                  </span>
                  <span className="gb-pc-box">
                    <input
                      value={d.title}
                      maxLength={58}
                      onChange={(e) => set("title", e.target.value)}
                      placeholder={d.type === "OFFER" ? "20% off whitening" : "Free check-up camp"}
                    />
                  </span>
                </label>
              ) : null}

              <div className="gb-pc-section">
                <label className="gb-pc-label" htmlFor="gb-pc-text">
                  {typeLabel} details
                </label>
                <div className="gb-pc-box">
                  <textarea
                    id="gb-pc-text"
                    ref={textRef}
                    rows={3}
                    value={d.summary}
                    placeholder={PLACEHOLDER[d.type]}
                    onChange={(e) => set("summary", e.target.value)}
                  />
                  <div className="gb-pc-tools">
                    {!photo && !live ? (
                      <button
                        type="button"
                        className="gb-pc-tool"
                        aria-label="Add a photo"
                        onClick={() => linkRef.current?.focus()}
                      >
                        <PhotoIcon />
                      </button>
                    ) : null}
                    <span className="gb-pc-count" data-over={len > POST_MAX}>
                      {len}/{POST_MAX}
                    </span>
                  </div>
                </div>
              </div>

              {hasDates ? (
                <div className="gb-pc-section">
                  <span className="gb-pc-label">
                    {d.type === "OFFER" ? "Offer dates" : "Event dates"}
                    <span className="gb-pc-info" title="Shown on your Google post" aria-hidden>
                      i
                    </span>
                  </span>
                  <div className="gb-pc-dates">
                    <label className="gb-pc-date">
                      <CalIcon />
                      <span className="gb-pc-date-inner">
                        <span className="gb-pc-date-cap">Start date</span>
                        <input
                          type="date"
                          value={dayOf(d.start)}
                          onChange={(e) =>
                            e.target.value && set("start", withDay(d.start, e.target.value, [0, 0]))
                          }
                        />
                      </span>
                    </label>
                    <span className="gb-pc-dash" aria-hidden>
                      –
                    </span>
                    <label className="gb-pc-date">
                      <CalIcon />
                      <span className="gb-pc-date-inner">
                        <span className="gb-pc-date-cap">End date</span>
                        <input
                          type="date"
                          value={dayOf(d.end)}
                          min={dayOf(d.start) || undefined}
                          onChange={(e) =>
                            e.target.value && set("end", withDay(d.end, e.target.value, [23, 59]))
                          }
                        />
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}

              {d.type === "OFFER" ? (
                <details
                  className="gb-pc-more"
                  open={Boolean(d.coupon || d.redeemUrl || d.terms) || undefined}
                >
                  <summary>Coupon, redeem link and terms (optional)</summary>
                  <div className="gb-pc-more-grid">
                    <label className="gb-pc-field">
                      <span className="gb-pc-field-cap">Coupon code</span>
                      <input
                        className="gb-input"
                        value={d.coupon}
                        maxLength={58}
                        placeholder="SMILE20"
                        onChange={(e) => set("coupon", e.target.value)}
                      />
                    </label>
                    <label className="gb-pc-field">
                      <span className="gb-pc-field-cap">Redeem link</span>
                      <input
                        className="gb-input"
                        type="url"
                        value={d.redeemUrl}
                        placeholder="https://"
                        aria-invalid={Boolean(d.redeemUrl.trim()) && !isHttps(d.redeemUrl)}
                        onChange={(e) => set("redeemUrl", e.target.value)}
                      />
                    </label>
                    <label className="gb-pc-field" style={{ gridColumn: "1 / -1" }}>
                      <span className="gb-pc-field-cap">Terms</span>
                      <input
                        className="gb-input"
                        value={d.terms}
                        maxLength={5000}
                        placeholder="One per customer. Valid on weekdays."
                        onChange={(e) => set("terms", e.target.value)}
                      />
                    </label>
                  </div>
                </details>
              ) : null}

              <div className="gb-pc-section" style={{ gap: 10 }}>
                <span className="gb-pc-label" id="gb-pc-btn-label">
                  Add a button <span className="gb-pc-optional">(optional)</span>
                </span>
                <div className="gb-pc-chips" role="radiogroup" aria-labelledby="gb-pc-btn-label">
                  {CTAS.map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={d.cta === v}
                      className="gb-pc-chip"
                      onClick={() => set("cta", v)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {needsUrl ? (
                  <label className="gb-pc-field">
                    <span className="gb-pc-field-cap">Button link</span>
                    <input
                      className="gb-input"
                      type="url"
                      value={d.ctaUrl}
                      placeholder="https://"
                      aria-invalid={Boolean(d.ctaUrl.trim()) && !isHttps(d.ctaUrl)}
                      onChange={(e) => set("ctaUrl", e.target.value)}
                    />
                  </label>
                ) : d.cta === "CALL" ? (
                  <span className="gb-faint">Calls the phone number on your Google profile.</span>
                ) : null}
              </div>
            </fieldset>
          </div>

          <div className="gb-pc-foot">
            {!live && touched && problems.length ? (
              <span className="gb-pc-problem" id="gb-pc-problem">
                {problems[0]}
              </span>
            ) : null}
            <div className="gb-pc-foot-row">
              {confirming ? (
                <div className="gb-pc-confirm" role="group" aria-label="Confirm delete">
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {live || d.status === "failed"
                      ? "Delete this post from Google?"
                      : "Delete this post?"}
                  </span>
                  <span className="gb-pc-spacer" />
                  <button
                    type="button"
                    className="gb-btn gb-btn-ghost gb-pc-draft"
                    disabled={remove.isPending}
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="gb-btn gb-btn-lg"
                    style={{ background: "var(--gb-red)", color: "#fff", border: "none" }}
                    disabled={remove.isPending}
                    onClick={destroy}
                  >
                    {remove.isPending ? <Spinner size={11} /> : <Icon name="trash" />}
                    Delete
                  </button>
                </div>
              ) : (
                <>
                  {!live ? (
                    <>
                      <button
                        type="button"
                        className="gb-pc-when"
                        aria-pressed={scheduled}
                        disabled={busy}
                        onClick={() => set("when", scheduled ? "now" : "schedule")}
                      >
                        <CalIcon />
                        {scheduled ? "Scheduled" : "Post now"}
                      </button>
                      {scheduled ? (
                        <input
                          type="datetime-local"
                          className="gb-pc-when-at"
                          aria-label="Publish at"
                          value={d.at}
                          min={localInput(new Date())}
                          disabled={busy}
                          onChange={(e) => set("at", e.target.value)}
                        />
                      ) : null}
                    </>
                  ) : d.searchUrl ? (
                    <a
                      href={d.searchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="gb-btn gb-btn-lg"
                    >
                      View on Google
                    </a>
                  ) : null}
                  <span className="gb-pc-spacer" />
                  {!live ? (
                    <>
                      <button
                        type="button"
                        className="gb-btn gb-btn-ghost gb-pc-draft"
                        disabled={busy}
                        onClick={() => submit("draft")}
                      >
                        Save draft
                      </button>
                      <button
                        type="button"
                        className="gb-btn gb-btn-blue gb-btn-lg"
                        disabled={busy || problems.length > 0}
                        aria-describedby={problems.length && touched ? "gb-pc-problem" : undefined}
                        onClick={() => submit(scheduled ? "schedule" : "now")}
                      >
                        {save.isPending ? <Spinner size={11} /> : <Icon name="send" size={18} />}
                        {scheduled ? "Schedule post" : "Post to Google"}
                      </button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        <aside className="gb-pc-preview" aria-label="Preview on Google">
          <div className="gb-pc-preview-cap">
            <span className="gb-pc-preview-kick">PREVIEW ON GOOGLE</span>
            <span style={{ fontSize: 12, color: "#6E6E68" }}>
              How it appears on Search and Maps
            </span>
          </div>
          <div className="gb-pc-card">
            <div className="gb-pc-card-head">
              <span
                className="gb-swatch"
                aria-hidden
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  background: locColor,
                  fontSize: 13,
                }}
              >
                {initials(location?.title ?? "")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="gb-pc-card-name">{location?.title ?? "Your business"}</div>
                <div style={{ fontSize: 12, color: "#6E6E68" }}>{prevWhen}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#55554F" aria-hidden>
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
            </div>
            <div className="gb-pc-card-media">
              {showPhoto ? (
                <Image
                  unoptimized
                  src={photo}
                  alt=""
                  fill
                  sizes="300px"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <PhotoIcon size={30} stroke={1.6} />
              )}
            </div>
            <div className="gb-pc-card-body">
              {hasDates ? (
                <span className="gb-pc-card-kicker">{typeLabel.toUpperCase()}</span>
              ) : null}
              <span className="gb-pc-card-headline" data-empty={!headline.trim()}>
                {headline.trim() ? headline : headlineFallback}
              </span>
              {hasDates && dayOf(d.start) && dayOf(d.end) ? (
                <span className="gb-pc-card-dates">
                  <CalIcon size={15} />
                  {fmtDay(d.start)} – {fmtDay(d.end)}
                </span>
              ) : null}
              {hasDates && d.summary.trim() ? (
                <span className="gb-pc-card-text">{d.summary}</span>
              ) : null}
              {d.type === "OFFER" && d.coupon.trim() ? (
                <span className="gb-pc-card-coupon">{d.coupon.trim()}</span>
              ) : null}
            </div>
            {ctaLabel && d.cta !== "none" ? (
              <div className="gb-pc-card-cta">
                {ctaLabel}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </div>
            ) : (
              <div style={{ height: 10 }} />
            )}
          </div>
        </aside>
      </div>
    </Drawer>
  );
}
