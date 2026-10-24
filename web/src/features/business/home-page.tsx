"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { usePlayClients } from "@/lib/api/queries";
import {
  type GbpMetrics,
  type GbpReview,
  useBusinessAnalytics,
  useBusinessInbox,
  useBusinessInsights,
  useBusinessPosts,
  useBusinessReply,
  useBusinessTemplates,
} from "@/lib/api/business";
import { useToast } from "@/features/replyly/ui";

import { useGoogleConnected, useLocationColors, useLocationFilter, useSetup } from "./shell";
import { agoShort, Avatar, GoogleMark, Notice, Seg, Skel, Sparkbars, Stars } from "./ui";

import { BrandLogo } from "./brand-logos";

import "./home.css";

type Days = 7 | 30 | 90;

const WEEK = 7 * 86_400_000;

function SetupStrip() {
  const setup = useSetup();
  if (setup.complete) return null;
  const nextIdx = setup.steps.findIndex((s) => !s.done);
  return (
    <section className="gb-home-setup" aria-label="Getting started">
      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>Getting started</span>
      <ol className="gb-home-pills">
        {setup.steps.map((s, i) => (
          <li
            key={s.label}
            className="gb-home-pill"
            data-state={s.done ? "done" : i === nextIdx ? "next" : "todo"}
            aria-current={i === nextIdx ? "step" : undefined}
          >
            <span className="gb-home-pill-dot" aria-hidden>
              {s.done ? "✓" : i + 1}
            </span>
            <span className="gb-home-pill-label">
              {s.label}
              {s.done ? <span className="sr-only"> (done)</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {setup.next ? (
        <Link href={setup.next.href} className="gb-btn gb-btn-dark gb-home-cta">
          {setup.next.cta} →
        </Link>
      ) : null}
    </section>
  );
}

function FocusReview({ review, more }: { review: GbpReview; more: boolean }) {
  const toast = useToast();
  const reply = useBusinessReply();
  const { locations } = useLocationColors();
  const place = locations.find((l) => l.id === review.locationId)?.title;
  const ago = agoShort(review.reviewedAt);
  const meta = [place, ago ? (ago === "now" ? "just now" : `${ago} ago`) : ""]
    .filter(Boolean)
    .join(" · ");
  const draft = review.draft?.text.trim() ? review.draft : null;
  const href = `/business/reviews?review=${encodeURIComponent(review.id)}`;
  return (
    <div className="gb-home-focus">
      <article className="gb-home-focus-card" aria-label={`Review from ${review.authorName}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={review.authorName} photo={review.authorPhoto} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{review.authorName}</div>
            <div style={{ fontSize: 12, color: "var(--gb-faint)" }}>{meta}</div>
          </div>
          <Stars n={review.stars} size={13} />
        </div>
        {review.text ? (
          <p className="gb-home-quote">“{review.text}”</p>
        ) : (
          <p className="gb-home-quote" style={{ color: "var(--gb-faint)" }}>
            Rated {review.stars} stars, no written review.
          </p>
        )}
        {draft ? (
          <div className="gb-home-draft">
            <span className="gb-home-draft-mark" aria-hidden>
              ↩
            </span>
            <span>
              <span className="sr-only">Reply draft: </span>
              {draft.text}
            </span>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {draft ? (
            <>
              <Link href={href} className="gb-btn">
                Edit
              </Link>
              <button
                type="button"
                className="gb-btn gb-btn-green"
                style={{ padding: "0 16px" }}
                disabled={reply.isPending}
                onClick={() =>
                  reply.mutate(
                    {
                      reviewId: review.id,
                      text: draft.text,
                      templateId: draft.templateId ?? undefined,
                    },
                    {
                      onSuccess: () => toast("Reply posted to Google"),
                      onError: (err) => toast(errorMessage(err)),
                    },
                  )
                }
              >
                {reply.isPending ? "Sending…" : "Send reply"}
              </button>
            </>
          ) : (
            <Link href={href} className="gb-btn gb-btn-green" style={{ padding: "0 16px" }}>
              Write reply
            </Link>
          )}
        </div>
      </article>
      {more ? (
        <>
          <div className="gb-home-stack-1" aria-hidden />
          <div className="gb-home-stack-2" aria-hidden />
        </>
      ) : null}
    </div>
  );
}

function NeedsReply({ locationId }: { locationId?: string }) {
  const inbox = useBusinessInbox("pending", locationId);
  const waiting = useMemo(
    () =>
      [...(inbox.data?.data ?? [])].sort(
        (a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt),
      ),
    [inbox.data],
  );
  const count = inbox.data?.counts.pending ?? waiting.length;
  const focus = waiting[0];
  return (
    <section className="gb-card gb-home-col" aria-labelledby="gb-home-needs">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 id="gb-home-needs" className="gb-title" style={{ margin: 0 }}>
            Needs your reply
          </h2>
          {inbox.data ? <span className="gb-count">{count}</span> : null}
        </div>
        <Link href="/business/reviews" className="gb-link">
          Open inbox →
        </Link>
      </div>
      {inbox.isError && !inbox.data ? (
        <Notice tone="error">{errorMessage(inbox.error)}</Notice>
      ) : !inbox.data ? (
        <Skel h={220} r={12} />
      ) : focus ? (
        <FocusReview key={focus.id} review={focus} more={count > 1} />
      ) : (
        <div className="gb-home-done gb-dots">
          <span className="gb-check-big" aria-hidden>
            ✓
          </span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>All caught up</span>
        </div>
      )}
    </section>
  );
}

function ProfileHealth({ locationId }: { locationId?: string }) {
  const analytics = useBusinessAnalytics({ kind: "days", days: 30 }, locationId);
  const pending = useBusinessInbox("pending", locationId);
  const posts = useBusinessPosts(locationId);
  const templates = useBusinessTemplates(locationId);
  const [now] = useState(() => Date.now());

  const ready = analytics.data || pending.data;
  if (!ready || !posts.data || !templates.data) {
    const err = [analytics, posts, templates].find((q) => q.isError)?.error;
    return (
      <section className="gb-card gb-home-col" style={{ gap: 18 }} aria-label="Profile health">
        <span className="gb-title">Profile health</span>
        {err ? <Notice tone="error">{errorMessage(err)}</Notice> : <Skel h={92} />}
        {err ? null : <Skel h={126} />}
      </section>
    );
  }

  const counts = pending.data?.counts;
  const waiting = counts?.pending ?? 0;
  const apiRate = analytics.data?.current.replyRate;
  const fallback =
    counts && counts.replied + counts.pending > 0
      ? counts.replied / (counts.replied + counts.pending)
      : 1;
  const replyRate = apiRate !== null && apiRate !== undefined ? apiRate / 100 : fallback;

  const weekPost = posts.data.data.some((p) => {
    if (p.status === "draft" || p.status === "failed") return false;
    const at = Date.parse(p.publishedAt ?? p.scheduledAt ?? p.createdAt);
    return at >= now - WEEK;
  });

  const tpls = templates.data.data;
  const visible = tpls.filter((t) => !t.hidden);
  const covered = new Set(visible.flatMap((t) => t.ratings));
  const tplOk = [1, 2, 3, 4, 5].every((r) => covered.has(r));
  const tplValue = tplOk
    ? `${visible.length} of ${tpls.length}`
    : visible.length < tpls.length
      ? "Some off"
      : "Not set";

  const score = Math.round(50 * replyRate + 30 * (weekPost ? 1 : 0) + 20 * (tplOk ? 1 : 0.5));
  const note =
    score >= 90
      ? "Looking great. Keep the streak going."
      : waiting > 0
        ? "Reply to waiting reviews to push this up."
        : !weekPost
          ? "Post this week to push this up."
          : "Turn on templates for every rating to push this up.";

  const levers = [
    {
      ok: waiting === 0,
      label: "Reply to reviews",
      value: `${Math.round(replyRate * 100)}%`,
      href: "/business/reviews",
    },
    {
      ok: weekPost,
      label: "Post every week",
      value: weekPost ? "On track" : "None yet",
      href: "/business/posts",
    },
    { ok: tplOk, label: "Reply templates", value: tplValue, href: "/business/templates" },
  ];

  return (
    <section className="gb-card gb-home-col" style={{ gap: 18 }} aria-labelledby="gb-home-health">
      <h2 id="gb-home-health" className="gb-title" style={{ margin: 0 }}>
        Profile health
      </h2>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          className="gb-home-ring"
          role="img"
          aria-label={`Health score ${score} out of 100`}
          style={{ background: `conic-gradient(var(--gb-green) ${score * 3.6}deg,#EEEEE9 0)` }}
        >
          <div className="gb-home-ring-in" aria-hidden>
            <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1 }}>
              {score}
            </span>
            <span style={{ fontSize: 11, color: "var(--gb-faint)" }}>/100</span>
          </div>
        </div>
        <span style={{ fontSize: 13, color: "var(--gb-muted)", lineHeight: 1.45 }}>{note}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {levers.map((l) => (
          <Link key={l.label} href={l.href} className="gb-home-lever" data-ok={l.ok}>
            <span className="gb-home-lever-icon" aria-hidden>
              {l.ok ? "✓" : "!"}
            </span>
            <span style={{ flex: 1, fontSize: 13 }}>{l.label}</span>
            <span style={{ fontSize: 12, color: "var(--gb-faint)" }}>{l.value}</span>
            <span style={{ fontSize: 12, color: "#B5B5AE" }} aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AiPromo() {
  const clients = usePlayClients();
  if (!clients.data || clients.data.data.length > 0) return null;
  return (
    <Link href="/business/ai" className="gb-home-ai">
      <span className="gb-home-marks" aria-hidden>
        <span style={{ background: "#D97757", color: "#fff" }}>
          <BrandLogo name="claude" size={16} />
        </span>
        <span style={{ background: "#2B2A27", color: "#D97757" }}>
          <BrandLogo name="claude" size={16} />
        </span>
        <span style={{ background: "#111110", color: "#fff" }}>
          <BrandLogo name="openai" size={16} />
        </span>
        <span style={{ background: "#ECECE8", color: "#111110" }}>
          <BrandLogo name="cursor" size={16} />
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Connect your AI</span>
        <span style={{ fontSize: 13, color: "var(--gb-muted)" }}>
          Reply and post from Claude, ChatGPT or Cursor
        </span>
      </span>
      <span className="gb-home-ai-cta">Connect</span>
    </Link>
  );
}

const METRICS: { label: string; value: (m: GbpMetrics) => number }[] = [
  { label: "Profile views", value: (m) => m.impressionsMaps + m.impressionsSearch },
  { label: "Directions", value: (m) => m.directions },
  { label: "Website clicks", value: (m) => m.websiteClicks },
  { label: "Calls", value: (m) => m.calls },
];

function delta(now: number, before: number) {
  if (before === 0) return now > 0 ? { text: "New", up: true } : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { text: "0%", up: null };
  return { text: pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`, up: pct > 0 };
}

function OnGoogle({ locationId }: { locationId?: string }) {
  const [days, setDays] = useState<Days>(30);
  const insights = useBusinessInsights({ kind: "days", days }, locationId);
  const d = insights.data;
  const recent = d ? d.series.filter((p) => !d.lastDay || p.day <= d.lastDay).slice(-14) : [];
  return (
    <section className="gb-card" style={{ overflow: "hidden" }} aria-labelledby="gb-home-google">
      <div className="gb-card-head">
        <h2 id="gb-home-google" className="gb-title" style={{ margin: 0 }}>
          On Google
        </h2>
        <Seg<`${Days}`>
          label="Time range"
          value={`${days}`}
          onChange={(v) => setDays(Number(v) as Days)}
          options={[
            { id: "7", label: "7d" },
            { id: "30", label: "30d" },
            { id: "90", label: "90d" },
          ]}
        />
      </div>
      {insights.isError && !d ? (
        <div style={{ padding: 20 }}>
          <Notice tone="error">{errorMessage(insights.error)}</Notice>
        </div>
      ) : (
        <div className="gb-home-perf">
          {METRICS.map((m) => {
            const now = d ? m.value(d.current) : 0;
            const ch = d ? delta(now, m.value(d.previous)) : null;
            return (
              <div key={m.label} className="gb-home-metric">
                <span style={{ fontSize: 13, color: "var(--gb-muted)" }}>{m.label}</span>
                {d ? (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span className="gb-home-metric-value">{now.toLocaleString()}</span>
                      {ch ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color:
                              ch.up === null
                                ? "var(--gb-faint)"
                                : ch.up
                                  ? "var(--gb-green)"
                                  : "var(--gb-red)",
                          }}
                        >
                          {ch.text}
                        </span>
                      ) : null}
                    </div>
                    <Sparkbars values={recent.map((p) => m.value(p))} />
                  </>
                ) : (
                  <>
                    <Skel h={34} w={80} r={8} />
                    <Skel h={32} r={4} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function NotConnected() {
  return (
    <div className="gb-card gb-home-prompt">
      <GoogleMark size={28} />
      <h1 className="gb-h1" style={{ fontSize: 20 }}>
        Connect your Google Business Profile
      </h1>
      <p className="gb-sub" style={{ margin: 0 }}>
        Link the Google account that manages your locations to see reviews, posts and how people
        find you.
      </p>
      <Link href="/business/connect" className="gb-btn gb-btn-dark gb-btn-lg">
        Connect Google →
      </Link>
    </div>
  );
}

export function BusinessHomePage() {
  const { connected, loading } = useGoogleConnected();
  const { locationId } = useLocationFilter();
  if (loading) {
    return (
      <div className="gb-home">
        <div className="gb-grid-home">
          <Skel h={320} r={14} />
          <Skel h={320} r={14} />
        </div>
        <Skel h={180} r={14} />
      </div>
    );
  }
  if (!connected) return <NotConnected />;
  return (
    <div className="gb-home">
      <h1 className="sr-only">Home</h1>
      <SetupStrip />
      <div className="gb-grid-home">
        <NeedsReply locationId={locationId} />
        <ProfileHealth locationId={locationId} />
      </div>
      <AiPromo />
      <OnGoogle locationId={locationId} />
    </div>
  );
}
