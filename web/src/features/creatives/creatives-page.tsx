"use client";

import { ImagePlus, Link2, Sparkles, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties, type DragEvent } from "react";

import { ConfirmDialog } from "@/features/replyly/dialog";
import { Banner, PageHead, Skel, Spinner, copyText, cx, useToast } from "@/features/replyly/ui";
import { errorMessage } from "@/lib/api/errors";
import { useCreatives, useDeleteCreative, useUploadCreative } from "@/lib/api/queries";
import type { Creative } from "@/lib/api/types";

const ACCEPT = "image/png,image/jpeg,image/webp,video/mp4,video/quicktime";
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const MUTED = "#6C6962";

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))",
  gap: 14,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function mediaSrc(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function sizeLabel(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export function CreativesPage() {
  const creatives = useCreatives();
  const upload = useUploadCreative();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const send = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    upload.mutate(
      { file },
      {
        onSuccess: (c) => toast(`${c.name} added`),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    send(e.dataTransfer.files);
  };

  return (
    <div
      className="rp-in"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <PageHead
        title="Creatives"
        sub="Your ad images. Upload your own, or ask Claude to design one; it lands here ready to use in an ad."
        actions={
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              style={VISUALLY_HIDDEN}
              aria-label="Upload an image"
              onChange={(e) => {
                send(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="rp-btn"
              disabled={upload.isPending}
              onClick={() => input.current?.click()}
            >
              {upload.isPending ? <Spinner /> : <Upload size={14} />}
              Upload image
            </button>
          </>
        }
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          fontSize: 13,
          color: "#55534E",
        }}
      >
        <span>Want to post organically?</span>
        <Link href="/instagram" className="rp-chip">
          Instagram Autopost →
        </Link>
        <Link href="/facebook" className="rp-chip">
          Facebook Autopost →
        </Link>
      </div>

      {creatives.isPending ? (
        <div style={GRID}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skel key={i} h={300} r={14} />
          ))}
        </div>
      ) : creatives.isError ? (
        <Banner
          tone="error"
          title="Couldn’t load your creatives"
          action={
            <button type="button" className="rp-btn-light" onClick={() => void creatives.refetch()}>
              Try again
            </button>
          }
        >
          {errorMessage(creatives.error)}
        </Banner>
      ) : creatives.data.data.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cx("rp-drop", dragging && "rp-drop-over")}
          style={{ padding: "56px 24px", textAlign: "center", gap: 8 }}
        >
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: "#EAF3EE",
              color: "#0F6B4A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ImagePlus size={20} />
          </span>
          <span style={{ fontWeight: 600, fontSize: 15, marginTop: 6 }}>
            Drop an image here or choose a file
          </span>
          <span style={{ fontSize: 13, color: MUTED, maxWidth: 460, lineHeight: 1.5 }}>
            Images (PNG, JPEG, WebP up to 8 MB) or vertical videos for Reels (MP4 up to 200 MB).
            Square 1080 × 1080 images work everywhere. Or ask Claude: “Design a square ad image for
            my clinic app and save it to TreeVook.”
          </span>
        </button>
      ) : (
        <>
          {dragging ? (
            <div
              className="rp-drop rp-drop-over"
              style={{ color: "#0F6B4A", fontWeight: 500, cursor: "default" }}
            >
              Drop to upload
            </div>
          ) : null}
          <ul style={GRID}>
            {creatives.data.data.map((c) => (
              <CreativeCard key={c.id} creative={c} />
            ))}
          </ul>
          <span
            style={{ fontSize: 12.5, color: MUTED, display: "flex", gap: 6, alignItems: "center" }}
          >
            <Sparkles size={13} />
            Ask Claude: “Design a square ad image for my clinic app and save it to TreeVook.”
          </span>
        </>
      )}
    </div>
  );
}

function CreativeCard({ creative }: { creative: Creative }) {
  const [confirm, setConfirm] = useState(false);
  const remove = useDeleteCreative();
  const toast = useToast();
  return (
    <li style={{ minWidth: 0 }}>
      <div
        className="rp-card"
        style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}
      >
        <div
          style={{
            position: "relative",
            aspectRatio: "1 / 1",
            background: creative.kind === "video" ? "#000" : "#F7F6F3",
            borderBottom: "1px solid #EFEDE8",
          }}
        >
          {creative.kind === "video" ? (
            <video
              src={mediaSrc(creative.url)}
              aria-label={creative.name}
              controls
              muted
              playsInline
              preload="metadata"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <Image
              unoptimized
              src={mediaSrc(creative.url)}
              alt={creative.name}
              width={creative.width || 1080}
              height={creative.height || 1080}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          )}
          {creative.source === "claude" ? (
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 500,
                background: "#EAF3EE",
                color: "#0F6B4A",
              }}
            >
              <Sparkles size={11} /> Claude
            </span>
          ) : null}
        </div>
        <div
          style={{
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
            <span
              style={{
                fontWeight: 500,
                fontSize: 13.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {creative.name}
            </span>
            <span style={{ fontSize: 12, color: MUTED }}>
              {creative.kind === "video" ? `Video · ${creative.durationSeconds ?? 0}s · ` : ""}
              {creative.width} × {creative.height} · {sizeLabel(creative.bytes)} ·{" "}
              {date.format(new Date(creative.createdAt))}
            </span>
          </div>
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: 7 }}
            aria-label={`Copy link to ${creative.name}`}
            onClick={async () => {
              toast(
                (await copyText(creative.url)) ? "Image link copied" : "Couldn’t copy the link",
              );
            }}
          >
            <Link2 size={14} />
          </button>
          <button
            type="button"
            className="rp-btn-light rp-btn-danger"
            style={{ padding: 7 }}
            aria-label={`Delete ${creative.name}`}
            onClick={() => setConfirm(true)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${creative.name}?`}
        description="It's removed from your library. Posts and ads already using it on Facebook or Instagram stay as they are."
        confirm="Delete"
        danger
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(creative.id, {
            onSuccess: () => {
              setConfirm(false);
              toast("Image deleted");
            },
            onError: (err) => toast(errorMessage(err)),
          })
        }
      />
    </li>
  );
}
