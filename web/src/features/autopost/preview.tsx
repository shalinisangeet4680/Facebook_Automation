"use client";

import Image from "next/image";
import { useState } from "react";

import type { AutopostFormat, SocialPlatform } from "@/lib/api/autopost";

const MUTED = "#6C6962";

export interface PreviewMedia {
  url: string;
  kind: "image" | "video";
}

export interface PreviewProps {
  platform: SocialPlatform;
  format: AutopostFormat;
  account: string;
  caption: string;
  hashtags: string[];
  media: PreviewMedia[];
  link: string | null;
  firstComment: string | null;
}

const tags = (list: string[]) =>
  list
    .map((t) => t.trim().replace(/^#*/, ""))
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(" ");

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)",
        padding: 2,
        flexShrink: 0,
        display: "flex",
      }}
    >
      <span
        style={{
          flex: 1,
          borderRadius: "50%",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.4,
          fontWeight: 700,
          color: "#191917",
        }}
      >
        {name.replace(/^@/, "").charAt(0).toUpperCase() || "T"}
      </span>
    </span>
  );
}

function Media({
  item,
  ratio,
  label,
}: {
  item: PreviewMedia | undefined;
  ratio: string;
  label: string;
}) {
  const box = {
    width: "100%",
    aspectRatio: ratio,
    objectFit: "cover" as const,
    display: "block",
    background: "#EFEDE8",
  };
  if (!item)
    return (
      <div
        style={{
          ...box,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: MUTED,
          fontSize: 12.5,
          background: "linear-gradient(135deg,#EFEDE8,#F7F6F3)",
        }}
      >
        {label}
      </div>
    );
  if (item.kind === "video")
    return <video src={item.url} muted playsInline loop autoPlay style={box} aria-label="Video" />;
  return <Image unoptimized src={item.url} alt="" width={540} height={540} style={box} />;
}

function Caption({ account, text }: { account: string; text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 140;
  return (
    <span
      style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
    >
      <strong style={{ marginRight: 6 }}>{account.replace(/^@/, "")}</strong>
      {long && !open ? `${text.slice(0, 140).trimEnd()}… ` : text}
      {long && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ color: MUTED, background: "none", border: 0, padding: 0, cursor: "pointer" }}
        >
          more
        </button>
      ) : null}
    </span>
  );
}

function InstagramFeed(p: PreviewProps) {
  const [slide, setSlide] = useState(0);
  const count = Math.max(1, p.media.length);
  const current = Math.min(slide, count - 1);
  const text = [p.caption.trim(), tags(p.hashtags)].filter(Boolean).join("\n\n");
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E6E4DF",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        <Avatar name={p.account} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{p.account.replace(/^@/, "")}</span>
        <span style={{ marginLeft: "auto", color: MUTED }}>•••</span>
      </div>
      <div style={{ position: "relative" }}>
        <Media
          item={p.media[current]}
          ratio={p.format === "reel" ? "9 / 16" : "1 / 1"}
          label={p.format === "reel" ? "Add a vertical video" : "Add an image"}
        />
        {count > 1 ? (
          <>
            <span
              className="rp-mono"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(25,25,23,.7)",
                color: "#fff",
                fontSize: 11,
              }}
            >
              {current + 1}/{count}
            </span>
            {current > 0 ? (
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => setSlide(current - 1)}
                style={arrow("left")}
              >
                ‹
              </button>
            ) : null}
            {current < count - 1 ? (
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => setSlide(current + 1)}
                style={arrow("right")}
              >
                ›
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 18 }} aria-hidden>
          <span>♡</span>
          <span>💬</span>
          <span>➤</span>
          {count > 1 ? (
            <span style={{ display: "flex", gap: 4, margin: "0 auto" }}>
              {Array.from({ length: count }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: i === current ? "#3897F0" : "#D6D3CD",
                  }}
                />
              ))}
            </span>
          ) : null}
          <span style={{ marginLeft: count > 1 ? 0 : "auto" }}>⌑</span>
        </div>
        {text ? (
          <Caption account={p.account} text={text} />
        ) : (
          <span style={{ fontSize: 13, color: MUTED }}>Your caption appears here.</span>
        )}
        {p.firstComment ? (
          <span style={{ fontSize: 13, color: "#55534E" }}>
            <strong style={{ marginRight: 6, color: "#191917" }}>
              {p.account.replace(/^@/, "")}
            </strong>
            {p.firstComment}
          </span>
        ) : null}
        <span style={{ fontSize: 11, color: MUTED, textTransform: "uppercase" }}>Just now</span>
      </div>
    </div>
  );
}

const arrow = (side: "left" | "right") => ({
  position: "absolute" as const,
  top: "50%",
  [side]: 8,
  transform: "translateY(-50%)",
  width: 26,
  height: 26,
  borderRadius: "50%",
  border: 0,
  background: "rgba(255,255,255,.9)",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: "26px",
});

function InstagramStory(p: PreviewProps) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 14,
        overflow: "hidden",
        background: "#191917",
        maxWidth: 270,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <Media item={p.media[0]} ratio="9 / 16" label="Add an image or video" />
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          right: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span style={{ height: 2, background: "rgba(255,255,255,.5)", borderRadius: 2 }}>
          <span style={{ display: "block", width: "35%", height: 2, background: "#fff" }} />
        </span>
        <span
          style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 12.5 }}
        >
          <Avatar name={p.account} size={24} />
          <strong>{p.account.replace(/^@/, "")}</strong>
          <span style={{ opacity: 0.7 }}>now</span>
        </span>
      </div>
    </div>
  );
}

function InstagramReel(p: PreviewProps) {
  const text = [p.caption.trim(), tags(p.hashtags)].filter(Boolean).join(" ");
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 14,
        overflow: "hidden",
        background: "#191917",
        maxWidth: 270,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <Media item={p.media[0]} ratio="9 / 16" label="Add a vertical video" />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "40px 12px 12px",
          background: "linear-gradient(transparent,rgba(0,0,0,.65))",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: 12.5,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={p.account} size={24} />
          <strong>{p.account.replace(/^@/, "")}</strong>
          <span
            style={{ border: "1px solid #fff", borderRadius: 6, padding: "0 6px", fontSize: 11 }}
          >
            Follow
          </span>
        </span>
        <span
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {text || "Your caption appears here."}
        </span>
      </div>
    </div>
  );
}

function FacebookPost(p: PreviewProps) {
  const text = [p.caption.trim(), tags(p.hashtags)].filter(Boolean).join("\n\n");
  const grid = p.media.slice(0, 4);
  let host = "";
  try {
    host = p.link ? new URL(p.link).hostname : "";
  } catch {
    host = "";
  }
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E6E4DF",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 12px 8px" }}>
        <span
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#2D5BD7",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
          }}
        >
          {p.account.charAt(0).toUpperCase() || "T"}
        </span>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <strong style={{ fontSize: 13.5 }}>{p.account}</strong>
          <span style={{ fontSize: 11.5, color: MUTED }}>Just now · 🌐</span>
        </span>
      </div>
      <div
        style={{
          padding: "0 12px 10px",
          fontSize: 13.5,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {text || <span style={{ color: MUTED }}>What’s on your mind?</span>}
      </div>
      {p.format === "link" ? (
        <div style={{ borderTop: "1px solid #EFEDE8", background: "#F0F2F5" }}>
          <div
            style={{
              aspectRatio: "1.91 / 1",
              background: "linear-gradient(135deg,#DCE3F5,#F0F2F5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: MUTED,
              fontSize: 12,
            }}
          >
            Link preview image
          </div>
          <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: MUTED, textTransform: "uppercase" }}>
              {host || "example.com"}
            </span>
            <strong style={{ fontSize: 13.5 }}>{p.link || "Add a link"}</strong>
          </div>
        </div>
      ) : p.format === "text" ? null : grid.length > 1 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
          {grid.map((m, i) => (
            <div key={`${m.url}${i}`} style={{ position: "relative" }}>
              <Media item={m} ratio="1 / 1" label="" />
              {i === 3 && p.media.length > 4 ? (
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,.45)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 600,
                  }}
                >
                  +{p.media.length - 4}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Media
          item={p.media[0]}
          ratio={p.format === "video" ? "9 / 16" : "1 / 1"}
          label={p.format === "video" ? "Add a video" : "Add an image"}
        />
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          padding: "8px 12px",
          borderTop: "1px solid #EFEDE8",
          color: MUTED,
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        <span>👍 Like</span>
        <span>💬 Comment</span>
        <span>↗ Share</span>
      </div>
      {p.firstComment ? (
        <div style={{ padding: "0 12px 12px", fontSize: 12.5 }}>
          <span
            style={{
              background: "#F0F2F5",
              borderRadius: 14,
              padding: "6px 10px",
              display: "inline-block",
            }}
          >
            <strong>{p.account}</strong> {p.firstComment}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function PostPreview(p: PreviewProps) {
  if (p.platform === "facebook") return <FacebookPost {...p} />;
  if (p.format === "story") return <InstagramStory {...p} />;
  if (p.format === "reel") return <InstagramReel {...p} />;
  return <InstagramFeed {...p} />;
}
