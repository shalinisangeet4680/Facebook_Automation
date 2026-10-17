"use client";

import Image from "next/image";
import { useState } from "react";

import {
  type AutopostInsights,
  type BestTimes,
  type SocialPlatform,
  useAutopostInsights,
} from "@/lib/api/autopost";
import { A, minutesLabel, rowBorder } from "@/features/replyly/tokens";
import { PageHead, Section, Seg, Skel } from "@/features/replyly/ui";

import { AccountAlerts, AccountSelect, MUTED, useConnectedGuard } from "./common";
import { CLASS_LABEL, CONTENT_LABEL, FORMAT_LABEL, WEEKDAYS, fmtNum, hourLabel } from "./platform";

type Totals = AutopostInsights["current"];

function delta(now: number, before: number) {
  if (!before) return now ? "new" : "±0%";
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${Math.abs(pct)}%`;
}

function Tile({ label, value, change }: { label: string; value: string; change?: string }) {
  return (
    <div
      className="rp-card"
      style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}
    >
      <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="rp-mono" style={{ fontSize: 22, letterSpacing: "-.02em" }}>
          {value}
        </span>
        {change ? (
          <span
            className="rp-mono"
            style={{
              fontSize: 12,
              color: change.startsWith("−") ? "#B42318" : change === "±0%" ? MUTED : A,
            }}
          >
            {change}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function FollowerChart({ series }: { series: AutopostInsights["series"] }) {
  const values = series.map((s) => s.followers).filter((v) => v > 0);
  if (values.length < 2)
    return (
      <span style={{ fontSize: 13, color: MUTED }}>
        Follower history builds up from daily snapshots.
      </span>
    );
  const points = series.filter((s) => s.followers > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const W = 600;
  const H = 140;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((p.followers - min) / Math.max(1, max - min)) * (H - 10) - 5;
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Followers over time"
      style={{ width: "100%", height: H, display: "block" }}
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#EFEDE8" />
      ))}
      <path d={`${path} L${W},${H} L0,${H} Z`} fill="rgba(15,107,74,.07)" />
      <path
        d={path}
        fill="none"
        stroke={A}
        strokeWidth={2}
        style={{ vectorEffect: "non-scaling-stroke" }}
      />
    </svg>
  );
}

export function BestTimeGrid({ times }: { times: BestTimes }) {
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ overflowX: "auto" }}>
        <div
          role="table"
          aria-label="Engagement by day and hour"
          style={{
            display: "grid",
            gridTemplateColumns: `40px repeat(${hours.length},minmax(18px,1fr))`,
            gap: 3,
            minWidth: 460,
          }}
        >
          <span />
          {hours.map((h) => (
            <span
              key={h}
              className="rp-mono"
              style={{ fontSize: 10, color: MUTED, textAlign: "center" }}
            >
              {h % 3 === 0 ? hourLabel(h).replace(" ", "") : ""}
            </span>
          ))}
          {WEEKDAYS.map((d, wd) => (
            <div key={d} role="row" style={{ display: "contents" }}>
              <span style={{ fontSize: 11, color: MUTED }}>{d}</span>
              {hours.map((h) => {
                const v = times.heatmap[wd]?.[h] ?? 0;
                return (
                  <span
                    key={h}
                    role="cell"
                    title={`${d} ${hourLabel(h)}: ${v}`}
                    style={{
                      height: 16,
                      borderRadius: 3,
                      background: v ? `rgba(15,107,74,${0.12 + (v / 100) * 0.88})` : "#F4F2EE",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <span style={{ fontSize: 12, color: MUTED }}>
        {times.source === "own"
          ? `Learned from ${times.basedOn} of your posts. Best: ${times.slots
              .slice(0, 3)
              .map((s) => `${WEEKDAYS[s.weekday]} ${hourLabel(s.hour)}`)
              .join(", ")}.`
          : "Based on defaults for your category until there are enough posts to learn from."}
      </span>
    </div>
  );
}

function Breakdown({
  rows,
}: {
  rows: { label: string; posts: number; avgEngagement: number; avgReach: number }[];
}) {
  if (!rows.length)
    return <span style={{ fontSize: 13, color: MUTED }}>No posts in this period.</span>;
  const max = Math.max(1, ...rows.map((r) => r.avgEngagement));
  return (
    <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(110px,1fr) 2fr auto",
            gap: 12,
            alignItems: "center",
            padding: "10px 14px",
            borderTop: rowBorder(i),
            fontSize: 13,
          }}
        >
          <span>{r.label}</span>
          <span style={{ height: 8, background: "#F4F2EE", borderRadius: 4, overflow: "hidden" }}>
            <span
              style={{
                display: "block",
                height: 8,
                width: `${(r.avgEngagement / max) * 100}%`,
                background: A,
              }}
            />
          </span>
          <span className="rp-mono" style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>
            {r.avgEngagement} avg · {r.posts} post{r.posts === 1 ? "" : "s"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function InsightsPage({ platform }: { platform: SocialPlatform }) {
  const { accounts } = useConnectedGuard(platform);
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const [accountId, setAccountId] = useState("all");
  const insights = useAutopostInsights(
    platform,
    Number(days) as 7 | 30 | 90,
    accountId === "all" ? undefined : accountId,
  );
  const d = insights.data;
  const cur: Totals | undefined = d?.current;

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHead
        title="Insights"
        sub="Reach, engagement and follower growth from daily snapshots, and the best time to post."
        actions={
          <>
            {accounts.length > 1 ? (
              <AccountSelect platform={platform} value={accountId} onChange={setAccountId} all />
            ) : null}
            <Seg
              label="Period"
              value={days}
              small
              onChange={setDays}
              options={[
                { id: "7", label: "7 days" },
                { id: "30", label: "30 days" },
                { id: "90", label: "90 days" },
              ]}
            />
          </>
        }
      />
      <AccountAlerts platform={platform} />
      {!d || !cur ? (
        <Skel h={260} />
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              gap: 10,
            }}
          >
            <Tile
              label="Posts"
              value={String(cur.posts)}
              change={delta(cur.posts, d.previous.posts)}
            />
            <Tile
              label="Reach"
              value={fmtNum(cur.reach)}
              change={delta(cur.reach, d.previous.reach)}
            />
            <Tile
              label="Engagements"
              value={fmtNum(cur.engagement)}
              change={delta(cur.engagement, d.previous.engagement)}
            />
            <Tile
              label="Engagement rate"
              value={cur.engagementRate === null ? "—" : `${cur.engagementRate}%`}
            />
            <Tile
              label="Followers"
              value={fmtNum(d.followers.total)}
              change={`${d.followers.change >= 0 ? "+" : "−"}${Math.abs(d.followers.change)}`}
            />
            <Tile label="Profile visits" value={fmtNum(d.profileVisits)} />
            <Tile
              label={platform === "instagram" ? "Saves" : "Shares"}
              value={fmtNum(platform === "instagram" ? cur.saves : cur.shares)}
            />
            <Tile label="Video plays" value={fmtNum(cur.videoPlays)} />
          </div>
          {d.recommendations.length ? (
            <Section title="What to do more of">
              <div className="rp-card" style={{ padding: "6px 0" }}>
                {d.recommendations.map((r, i) => (
                  <div
                    key={r}
                    style={{
                      padding: "10px 16px",
                      borderTop: rowBorder(i),
                      fontSize: 13.5,
                      lineHeight: 1.5,
                    }}
                  >
                    {r}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))",
              gap: 18,
            }}
          >
            <Section title="Followers">
              <div className="rp-card" style={{ padding: 16 }}>
                <FollowerChart series={d.series} />
              </div>
            </Section>
            <Section title="Best time to post">
              <div className="rp-card" style={{ padding: 16 }}>
                <BestTimeGrid times={d.bestTimes} />
              </div>
            </Section>
          </div>
          <Section title="Top posts">
            {d.topPosts.length ? (
              <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
                {d.topPosts.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "12px 16px",
                      borderTop: rowBorder(i),
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {p.imageUrl ? (
                      <Image
                        unoptimized
                        src={p.imageUrl}
                        alt=""
                        width={48}
                        height={48}
                        style={{ borderRadius: 8, objectFit: "cover", background: "#EFEDE8" }}
                      />
                    ) : (
                      <span
                        style={{ width: 48, height: 48, borderRadius: 8, background: "#F4F2EE" }}
                      />
                    )}
                    <span
                      style={{
                        flex: 1,
                        minWidth: 200,
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {p.caption || FORMAT_LABEL[p.format]}
                      </span>
                      <span style={{ fontSize: 12, color: MUTED }}>
                        {FORMAT_LABEL[p.format]} ·{" "}
                        {new Date(p.publishedAt).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </span>
                    <span
                      className="rp-mono"
                      style={{ fontSize: 12, color: MUTED, display: "flex", gap: 12 }}
                    >
                      <span>{fmtNum(p.metrics.reach)} reach</span>
                      <span>{p.metrics.likes} likes</span>
                      <span>{p.metrics.comments} comments</span>
                      <span style={{ color: A }}>{p.engagement} eng.</span>
                    </span>
                    {p.permalink ? (
                      <a
                        href={p.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="rp-btn-text"
                      >
                        View
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 13, color: MUTED }}>
                No posts were published in this period.
              </span>
            )}
          </Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))",
              gap: 18,
            }}
          >
            <Section title="By format" desc="Average engagements per post">
              <Breakdown rows={d.byFormat.map((f) => ({ ...f, label: FORMAT_LABEL[f.format] }))} />
            </Section>
            <Section title="By content type" desc="Posts made in TreeVook">
              <Breakdown
                rows={d.byContentType.map((c) => ({ ...c, label: CONTENT_LABEL[c.contentType] }))}
              />
            </Section>
          </div>
          <Section title="Comments" desc={`${d.comments.total} comments in this period`}>
            <div
              className="rp-card"
              style={{ padding: 16, display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}
            >
              <span>
                Reply rate{" "}
                <strong className="rp-mono">
                  {d.comments.replyRate === null ? "—" : `${d.comments.replyRate}%`}
                </strong>
              </span>
              <span>
                Median response{" "}
                <strong className="rp-mono">
                  {minutesLabel(d.comments.medianResponseMinutes)}
                </strong>
              </span>
              {d.comments.classes.map((c) => (
                <span key={c.class}>
                  {CLASS_LABEL[c.class]} <strong className="rp-mono">{c.count}</strong>
                </span>
              ))}
              {d.comments.themes.length ? (
                <span style={{ color: MUTED }}>
                  People mention: {d.comments.themes.map((t) => t.word).join(", ")}
                </span>
              ) : null}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
