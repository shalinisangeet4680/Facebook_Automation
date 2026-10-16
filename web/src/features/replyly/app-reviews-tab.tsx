"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useApproveAll, usePlayInbox } from "@/lib/api/queries";
import type { PlayAppDetail } from "@/lib/api/types";

import { InboxItem } from "./review-card";
import { StateArt } from "./state-art";
import { Banner, Seg, Skel, Spinner, useToast } from "./ui";

type Filter = "pending" | "replied" | "all";

export function AppReviewsTab({ app, color }: { app: PlayAppDetail; color: string }) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [stars, setStars] = useState<"all" | "5" | "4" | "3" | "2" | "1">("all");
  const inbox = usePlayInbox(filter, app.id, stars === "all" ? undefined : Number(stars));
  const approveAll = useApproveAll();
  const toast = useToast();
  const data = inbox.data;
  const items = data?.data ?? [];
  const approvable = filter === "replied" ? [] : (data?.approvable ?? []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Seg
            label="Review filter"
            pad={12}
            value={filter}
            onChange={setFilter}
            options={[
              { id: "pending", label: "Needs reply", n: data?.counts.pending ?? "" },
              { id: "replied", label: "Replied", n: data?.counts.replied ?? "" },
              { id: "all", label: "All", n: data?.counts.all ?? "" },
            ]}
          />
          <Seg
            label="Rating"
            pad={10}
            value={stars}
            onChange={setStars}
            options={[
              { id: "all", label: "All ★" },
              ...(["5", "4", "3", "2", "1"] as const).map((n) => ({
                id: n,
                label: (
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span className="rp-mono">{n}</span>
                    <span style={{ color: "#C9A227", fontSize: 12 }}>★</span>
                  </span>
                ),
              })),
            ]}
          />
        </div>
        {approvable.length > 1 ? (
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
        ) : null}
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
          <div style={{ height: 220 }}>
            <StateArt kind="inbox_zero" height={220} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="rp-serif" style={{ fontSize: 32, lineHeight: 1.05 }}>
              {stars === "all" ? `All caught up on ${app.title}.` : `No ${stars}★ reviews here.`}
            </h2>
            <p style={{ color: "#55534E", lineHeight: 1.55 }}>
              {stars === "all"
                ? "No reviews in this view. New ones sync every 15 minutes."
                : "Try another rating or switch to All."}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((r) => (
            <InboxItem
              key={`${r.id}:${r.draft?.id ?? ""}:${r.draft?.text ?? ""}`}
              review={r}
              appColor={color}
              appName={app.title}
            />
          ))}
        </div>
      )}
    </div>
  );
}
