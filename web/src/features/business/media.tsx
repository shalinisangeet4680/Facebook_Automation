"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpMedia,
  type GbpPhotoCategory,
  useAddBusinessPhoto,
  useBusinessMedia,
  useDeleteBusinessMedia,
} from "@/lib/api/business";
import { useToast } from "@/features/replyly/ui";

import { useLocationColors } from "./shell";
import { Avatar, Modal, Notice, Seg, Skel, Swatch } from "./ui";

import "./media.css";

export const CATEGORY_LABELS: Record<GbpPhotoCategory, string> = {
  COVER: "Cover",
  PROFILE: "Profile",
  LOGO: "Logo",
  EXTERIOR: "Exterior",
  INTERIOR: "Interior",
  PRODUCT: "Product",
  AT_WORK: "At work",
  FOOD_AND_DRINK: "Food & drink",
  MENU: "Menu",
  COMMON_AREA: "Common area",
  ROOMS: "Rooms",
  TEAMS: "Team",
  ADDITIONAL: "Other",
};

const UPLOAD_CATEGORIES: GbpPhotoCategory[] = [
  "ADDITIONAL",
  "COVER",
  "LOGO",
  "EXTERIOR",
  "INTERIOR",
  "PRODUCT",
  "AT_WORK",
  "TEAMS",
  "FOOD_AND_DRINK",
  "MENU",
];

type Filter = "all" | "photos" | "videos" | "customers";

export function logoOf(items: GbpMedia[] | undefined) {
  const photos = items?.filter((m) => m.format === "PHOTO" && m.source === "owner");
  return (
    photos?.find((m) => m.category === "LOGO") ?? photos?.find((m) => m.category === "PROFILE")
  );
}

const labelOf = (m: GbpMedia) =>
  m.source === "customer"
    ? `From ${m.author ?? "a customer"}`
    : m.category
      ? CATEGORY_LABELS[m.category]
      : "Photo";

const dateOf = (iso: string) =>
  Date.parse(iso) > 0
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

function PlayBadge({ size = 34 }: { size?: number }) {
  return (
    <span className="gb-media-play" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.5 2.8v10.4L13 8z" />
      </svg>
    </span>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={dir === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "m6 3.5 4.5 4.5L6 12.5"} />
    </svg>
  );
}

function ViewerVideo({ item }: { item: GbpMedia }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="gb-viewer-fallback">
        <Image
          unoptimized
          src={item.thumbnailUrl}
          alt=""
          width={1280}
          height={720}
          referrerPolicy="no-referrer"
        />
        <a href={item.url} target="_blank" rel="noreferrer" className="gb-btn gb-btn-dark">
          Play on Google ↗
        </a>
      </div>
    );
  return (
    <video
      key={item.id}
      className="gb-viewer-media"
      src={item.url}
      poster={item.thumbnailUrl}
      controls
      autoPlay
      playsInline
      onError={() => setFailed(true)}
    />
  );
}

export function MediaViewer({
  items,
  index,
  onIndex,
  onClose,
  locationName,
}: {
  items: GbpMedia[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  locationName: (id: string) => string | null;
}) {
  const toast = useToast();
  const remove = useDeleteBusinessMedia();
  const [confirming, setConfirming] = useState(false);
  const touch = useRef<number | null>(null);
  const item = items[index];
  const count = items.length;
  const go = useCallback(
    (step: number) => {
      if (count < 2) return;
      setConfirming(false);
      onIndex((index + step + count) % count);
    },
    [count, index, onIndex],
  );

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  useEffect(() => {
    if (count < 2) return;
    for (const step of [1, -1]) {
      const next = items[(index + step + count) % count];
      if (next?.format === "PHOTO") {
        const img = new window.Image();
        img.referrerPolicy = "no-referrer";
        img.src = next.url;
      }
    }
  }, [items, index, count]);

  if (!item) return null;
  const date = dateOf(item.createTime);
  const where = locationName(item.locationId);
  const meta = [where, date, item.views !== null ? `${item.views.toLocaleString()} views` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="gb-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${labelOf(item)}, ${index + 1} of ${count}`}
      onTouchStart={(e) => {
        touch.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        const end = e.changedTouches[0]?.clientX;
        touch.current = null;
        if (start === null || end === undefined || Math.abs(end - start) < 50) return;
        go(end < start ? 1 : -1);
      }}
    >
      <div className="gb-viewer-scrim" onClick={onClose} aria-hidden />
      <div className="gb-viewer-top">
        <span className="gb-viewer-count">
          {index + 1} / {count}
        </span>
        <button type="button" className="gb-viewer-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      {count > 1 ? (
        <button
          type="button"
          className="gb-viewer-nav gb-viewer-prev"
          aria-label="Previous"
          onClick={() => go(-1)}
        >
          <Chevron dir="left" />
        </button>
      ) : null}
      <div className="gb-viewer-stage">
        {item.format === "VIDEO" ? (
          <ViewerVideo key={item.id} item={item} />
        ) : (
          <Image
            key={item.id}
            unoptimized
            priority
            className="gb-viewer-media"
            src={item.url}
            alt={labelOf(item)}
            width={item.width ?? 1600}
            height={item.height ?? 1200}
            referrerPolicy="no-referrer"
          />
        )}
      </div>
      {count > 1 ? (
        <button
          type="button"
          className="gb-viewer-nav gb-viewer-next"
          aria-label="Next"
          onClick={() => go(1)}
        >
          <Chevron dir="right" />
        </button>
      ) : null}
      <div className="gb-viewer-bar">
        {item.source === "customer" ? (
          <Avatar name={item.author ?? "Customer"} photo={item.authorPhoto} size={30} />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gb-viewer-title">
            {labelOf(item)}
            {item.format === "VIDEO" ? <span className="gb-viewer-tag">Video</span> : null}
          </div>
          {meta ? <div className="gb-viewer-meta">{meta}</div> : null}
        </div>
        <a href={item.url} target="_blank" rel="noreferrer" className="gb-viewer-action">
          Open original ↗
        </a>
        {item.source === "owner" ? (
          confirming ? (
            <span className="gb-viewer-confirm">
              <span>Delete from Google?</span>
              <button
                type="button"
                className="gb-viewer-action gb-viewer-danger"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { locationId: item.locationId, mediaId: item.id },
                    {
                      onSuccess: () => {
                        toast("Deleted from Google");
                        setConfirming(false);
                        if (count <= 1) onClose();
                        else if (index >= count - 1) onIndex(index - 1);
                      },
                      onError: (err) => toast(errorMessage(err)),
                    },
                  )
                }
              >
                {remove.isPending ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                className="gb-viewer-action"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="gb-viewer-action gb-viewer-danger"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

function readDimensions(file: File) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function AddPhotoModal({
  locationId,
  onClose,
}: {
  locationId?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const add = useAddBusinessPhoto();
  const { locations, color } = useLocationColors();
  const [target, setTarget] = useState(locationId ?? locations[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [category, setCategory] = useState<GbpPhotoCategory>("ADDITIONAL");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const fixed = Boolean(locationId);
  const where = target || locations[0]?.id || "";

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setProblem(null);
    if (!["image/jpeg", "image/png"].includes(f.type)) {
      setProblem("Choose a JPEG or PNG photo.");
      return;
    }
    if (f.size < 10_240) {
      setProblem("Google needs photos of at least 10 KB.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setProblem("Google takes photos up to 5 MB.");
      return;
    }
    const size = await readDimensions(f);
    if (!size) {
      setProblem("This file isn't a readable photo.");
      return;
    }
    if (size.width < 250 || size.height < 250) {
      setProblem("Use a photo at least 250 × 250 pixels. 720 × 720 or larger looks best.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    if (input.current) input.current.value = "";
  };

  return (
    <Modal onClose={onClose} label="Add a photo">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>Add a photo</div>
          <div className="gb-faint">It goes straight to your Google Business Profile</div>
        </div>
        <button type="button" className="gb-icon-btn" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>

      {!fixed && locations.length > 1 ? (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="gb-title" style={{ fontSize: 13 }}>
            Location
          </span>
          <span className="gb-media-select">
            <Swatch
              color={color(where)}
              label={locations.find((l) => l.id === where)?.title ?? "?"}
              size={22}
            />
            <select value={where} onChange={(e) => setTarget(e.target.value)} aria-label="Location">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </span>
        </label>
      ) : null}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {preview && file ? (
        <div className="gb-media-preview">
          <Image unoptimized src={preview} alt="Selected photo" width={800} height={600} />
          <div className="gb-media-preview-bar">
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {file.name}
            </span>
            <button type="button" className="gb-btn" onClick={() => input.current?.click()}>
              Change
            </button>
            <button type="button" className="gb-btn gb-btn-ghost" onClick={clear}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={dragging ? "gb-media-drop gb-media-drop-on" : "gb-media-drop"}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void pick(e.dataTransfer.files[0]);
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <circle cx="9" cy="10" r="1.8" />
            <path d="m21 16-5-5-9 9" />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--gb-ink)" }}>
            Drop a photo or browse
          </span>
          <span className="gb-faint">JPEG or PNG · 10 KB to 5 MB · at least 250 × 250</span>
        </button>
      )}
      {problem ? <Notice tone="error">{problem}</Notice> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="gb-title" style={{ fontSize: 13 }}>
          What does it show?
        </span>
        <div className="gb-media-cats" role="radiogroup" aria-label="Photo category">
          {UPLOAD_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              className="gb-media-cat"
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="gb-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="gb-btn gb-btn-green"
          disabled={!file || !where || add.isPending}
          onClick={() =>
            file &&
            add.mutate(
              { locationId: where, file, category },
              {
                onSuccess: () => {
                  toast("Photo added to Google");
                  onClose();
                },
                onError: (err) => setProblem(errorMessage(err)),
              },
            )
          }
        >
          {add.isPending ? "Uploading…" : "Add to Google"}
        </button>
      </div>
    </Modal>
  );
}

export function MediaGallery({ locationId }: { locationId?: string }) {
  const media = useBusinessMedia(locationId);
  const { locations, color } = useLocationColors();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const all = useMemo(() => media.data?.items ?? [], [media.data]);
  const counts = {
    all: all.length,
    photos: all.filter((m) => m.format === "PHOTO").length,
    videos: all.filter((m) => m.format === "VIDEO").length,
    customers: all.filter((m) => m.source === "customer").length,
  };
  const list = all.filter((m) =>
    filter === "photos"
      ? m.format === "PHOTO"
      : filter === "videos"
        ? m.format === "VIDEO"
        : filter === "customers"
          ? m.source === "customer"
          : true,
  );
  const many = !locationId && locations.length > 1;
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.title ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="gb-media-head">
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <Seg
            label="Media filter"
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setOpen(null);
            }}
            options={[
              { id: "all", label: "All", n: counts.all },
              { id: "photos", label: "Photos", n: counts.photos },
              { id: "videos", label: "Videos", n: counts.videos },
              { id: "customers", label: "From customers", n: counts.customers },
            ]}
          />
        </div>
        <button
          type="button"
          className="gb-btn gb-btn-dark"
          disabled={!locations.length}
          onClick={() => setAdding(true)}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }} aria-hidden>
            +
          </span>
          Add photo
        </button>
      </div>

      {media.error ? <Notice tone="error">{errorMessage(media.error)}</Notice> : null}
      {media.data?.error ? <Notice tone="warn">{media.data.error}</Notice> : null}

      {media.isPending ? (
        <div className="gb-media-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <Skel key={i} h={180} r={12} />
          ))}
        </div>
      ) : list.length ? (
        <div className="gb-media-grid">
          {list.map((m, i) => (
            <button
              key={`${m.locationId}-${m.id}`}
              type="button"
              className="gb-media-tile"
              aria-label={`${m.format === "VIDEO" ? "Video" : "Photo"}: ${labelOf(m)}${many && nameOf(m.locationId) ? `, ${nameOf(m.locationId)}` : ""}`}
              onClick={() => setOpen(i)}
            >
              <Image
                unoptimized
                src={m.thumbnailUrl}
                alt=""
                width={400}
                height={400}
                referrerPolicy="no-referrer"
              />
              {m.format === "VIDEO" ? <PlayBadge /> : null}
              <span className="gb-media-cap">
                {many ? (
                  <span
                    className="gb-media-loc"
                    style={{ background: color(m.locationId) }}
                    aria-hidden
                  />
                ) : null}
                <span className="gb-media-cap-text">{labelOf(m)}</span>
                {m.views !== null ? (
                  <span className="gb-media-views">{m.views.toLocaleString()} views</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="gb-media-empty">
          <span style={{ fontSize: 14, color: "var(--gb-faint)" }}>
            {filter === "all"
              ? "No photos or videos on this profile yet"
              : filter === "videos"
                ? "No videos yet"
                : filter === "customers"
                  ? "No customer photos yet"
                  : "No photos yet"}
          </span>
          {filter === "customers" || filter === "videos" ? null : (
            <button type="button" className="gb-btn" onClick={() => setAdding(true)}>
              Add a photo
            </button>
          )}
        </div>
      )}

      {open !== null && list[open] ? (
        <MediaViewer
          items={list}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          locationName={(id) => (many ? nameOf(id) : null)}
        />
      ) : null}
      {adding ? <AddPhotoModal locationId={locationId} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
