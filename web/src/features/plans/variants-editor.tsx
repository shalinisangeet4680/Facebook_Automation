"use client";

import { Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { CampaignPlan, PlanVariant } from "@/lib/api/types";
import { Toggle } from "@/features/replyly/ui";

import { CreativePicker, VideoFill, displaySrc } from "./creative-picker";
import { Field, MUTED } from "./plan-sections";

const full = { width: "100%", boxSizing: "border-box" } as const;
const LABELS = ["B", "C"];
export const MAX_VERSIONS = 2;

function Thumb({ image, video }: { image: string | null; video: string | null }) {
  return (
    <span
      style={{
        position: "relative",
        width: 56,
        height: 56,
        borderRadius: 8,
        overflow: "hidden",
        background: "#F4F2EE",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: MUTED,
      }}
    >
      {video ? (
        <VideoFill src={video} />
      ) : image ? (
        <Image unoptimized fill src={image} alt="" sizes="56px" style={{ objectFit: "cover" }} />
      ) : (
        <ImageIcon size={16} aria-hidden />
      )}
    </span>
  );
}

export function VariantsEditor({
  plan,
  onChange,
  disabled,
  instant,
}: {
  plan: CampaignPlan;
  onChange: (variants: PlanVariant[]) => void;
  disabled: boolean;
  instant: boolean;
}) {
  const [picking, setPicking] = useState<number | null>(null);
  const variants = plan.variants ?? [];
  const main = plan.creative;
  const post = Boolean(main.post);
  const set = (i: number, patch: Partial<PlanVariant>) =>
    onChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const legacy = main.alternatives.filter((text) => !variants.some((v) => v.primaryText === text));
  const mainImage = displaySrc(main.imageUrl);
  const mainVideo = displaySrc(main.videoUrl);
  const active = variants.filter((v) => v.enabled).length + 1;

  if (post)
    return (
      <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
        Ads made from an existing post always run as they are, so versions can’t be tested. Choose
        an image or video instead to test different messages.
      </p>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
          borderRadius: 10,
          border: "1px solid #EFEDE8",
          background: "#FAF9F7",
        }}
      >
        <Thumb image={mainImage} video={mainVideo} />
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>Version A</span>
          <span style={{ fontSize: 12.5, color: MUTED }}>The ad above.</span>
        </span>
      </div>
      {variants.map((v, i) => {
        const label = LABELS[i] ?? String(i + 2);
        const ownImage = displaySrc(v.imageUrl);
        const ownVideo = displaySrc(v.videoUrl);
        const own = Boolean(ownImage || ownVideo);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #EFEDE8",
              opacity: v.enabled ? 1 : 0.65,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>Version {label}</span>
              <Toggle
                on={v.enabled}
                disabled={disabled}
                label={`Test version ${label}`}
                onChange={() => set(i, { enabled: !v.enabled })}
              />
              {disabled ? null : (
                <button
                  type="button"
                  className="rp-btn-light"
                  aria-label={`Remove version ${label}`}
                  style={{ padding: "6px 8px" }}
                  onClick={() => onChange(variants.filter((_, j) => j !== i))}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <Field label={`Primary text, version ${label}`}>
              <textarea
                className="rp-input rp-textarea"
                rows={3}
                style={{ ...full, resize: "vertical", lineHeight: 1.5 }}
                value={v.primaryText}
                onChange={(e) => set(i, { primaryText: e.target.value })}
              />
            </Field>
            <Field label={`Headline, version ${label}`}>
              <input
                className="rp-input"
                style={full}
                value={v.headline}
                onChange={(e) => set(i, { headline: e.target.value })}
              />
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Thumb image={own ? ownImage : mainImage} video={own ? ownVideo : mainVideo} />
              <span style={{ flex: "1 1 160px", minWidth: 0, fontSize: 12.5, color: MUTED }}>
                {own
                  ? `Uses its own ${ownVideo ? "video" : "image"}.`
                  : "Uses the same image or video as version A."}
              </span>
              {disabled ? null : (
                <span style={{ display: "flex", gap: 8 }}>
                  {own ? (
                    <button
                      type="button"
                      className="rp-btn-light"
                      style={{ padding: "6px 10px" }}
                      onClick={() => set(i, { imageUrl: null, videoUrl: null })}
                    >
                      Use version A’s
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rp-btn-light"
                    style={{ padding: "6px 10px" }}
                    onClick={() => setPicking(i)}
                  >
                    {own ? "Change" : "Use another image or video"}
                  </button>
                </span>
              )}
            </div>
          </div>
        );
      })}
      {disabled ? null : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {variants.length < MAX_VERSIONS ? (
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "6px 10px" }}
              onClick={() =>
                onChange([
                  ...variants,
                  {
                    enabled: true,
                    primaryText: main.primaryText,
                    headline: main.headline,
                    imageUrl: null,
                    videoUrl: null,
                  },
                ])
              }
            >
              <Plus size={14} /> Add a version
            </button>
          ) : null}
          {legacy.length && variants.length < MAX_VERSIONS ? (
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "6px 10px" }}
              onClick={() =>
                onChange([
                  ...variants,
                  ...legacy.slice(0, MAX_VERSIONS - variants.length).map((text) => ({
                    enabled: true,
                    primaryText: text,
                    headline: main.headline,
                    imageUrl: null,
                    videoUrl: null,
                  })),
                ])
              }
            >
              Use Claude’s other texts as versions
            </button>
          ) : null}
        </div>
      )}
      <span style={{ fontSize: 12.5, color: MUTED }}>
        {active === 1
          ? "Only version A will be created."
          : `${active} ads will be created in the same ad set, all paused.`}
      </span>
      <CreativePicker
        open={picking !== null}
        onOpenChange={(open) => {
          if (!open) setPicking(null);
        }}
        imagesOnly
        creative={{
          imageUrl: picking !== null ? (variants[picking]?.imageUrl ?? null) : null,
          videoUrl: picking !== null ? (variants[picking]?.videoUrl ?? null) : null,
          post: null,
        }}
        onPick={(patch) => {
          if (picking === null) return;
          set(picking, { imageUrl: patch.imageUrl ?? null, videoUrl: patch.videoUrl ?? null });
        }}
      />
      {instant ? (
        <span style={{ fontSize: 12.5, color: MUTED }}>
          Every version opens the same instant form.
        </span>
      ) : null}
    </div>
  );
}
