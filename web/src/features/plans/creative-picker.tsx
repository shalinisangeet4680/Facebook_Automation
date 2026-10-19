"use client";

import { Check, Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";

import { useCreatives, useLibrary } from "@/lib/api/queries";
import type { CampaignPlan } from "@/lib/api/types";
import { RpDialogContent, RpDialogRoot } from "@/features/replyly/dialog";
import { Seg, Skel } from "@/features/replyly/ui";

type Creative = CampaignPlan["creative"];
type Tab = "images" | "facebook" | "instagram";

const MUTED = "#6C6962";

export function displaySrc(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/media/") ? parsed.pathname : url;
  } catch {
    return url;
  }
}

export function CreativePicker({
  open,
  onOpenChange,
  creative,
  onPick,
  imagesOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creative: Pick<Creative, "imageUrl" | "post">;
  onPick: (patch: Partial<Creative>) => void;
  imagesOnly?: boolean;
}) {
  const [chosen, setTab] = useState<Tab>("images");
  const tab: Tab = imagesOnly ? "images" : chosen;
  const creatives = useCreatives();
  const facebook = useLibrary("facebook", open && tab === "facebook");
  const instagram = useLibrary("instagram", open && tab === "instagram");

  const pick = (patch: Partial<Creative>) => {
    onPick(patch);
    onOpenChange(false);
  };

  const library = tab === "facebook" ? facebook : instagram;

  return (
    <RpDialogRoot open={open} onOpenChange={onOpenChange}>
      <RpDialogContent
        width={760}
        title={imagesOnly ? "Choose an image" : "Choose what the ad shows"}
        description={
          imagesOnly
            ? "Pick an image from your library. Upload new ones in Creatives."
            : "Use an image from your library, or run the ad on a post that's already on your Page or Instagram so it keeps its likes and comments."
        }
      >
        {imagesOnly ? null : (
          <div style={{ display: "flex", overflowX: "auto" }}>
            <Seg
              label="Source"
              value={tab}
              onChange={setTab}
              options={[
                { id: "images", label: "Your images" },
                { id: "facebook", label: "Facebook posts" },
                { id: "instagram", label: "Instagram posts" },
              ]}
            />
          </div>
        )}

        {tab === "images" ? (
          creatives.isPending ? (
            <Loading />
          ) : !creatives.data?.data.length ? (
            <Note>No images yet. Upload one in Creatives or ask Claude to design one.</Note>
          ) : (
            <Grid>
              {creatives.data.data
                .filter((c) => c.kind !== "video")
                .map((c) => (
                  <Option
                    key={c.id}
                    label={c.name}
                    image={displaySrc(c.url)}
                    selected={!creative.post && creative.imageUrl === c.url}
                    onSelect={() => pick({ imageUrl: c.url, post: null })}
                  />
                ))}
            </Grid>
          )
        ) : library.isPending ? (
          <Loading />
        ) : !library.data?.connected ? (
          <Note>
            {tab === "instagram"
              ? "No Instagram account is connected."
              : "No Facebook Page is selected."}
          </Note>
        ) : !library.data.data.length ? (
          <Note>No posts yet. Publish one from Creatives first.</Note>
        ) : (
          <Grid>
            {library.data.data.map((post) => (
              <Option
                key={post.id}
                label={post.text ?? "Post"}
                image={post.imageUrl}
                stats={{ likes: post.likes, comments: post.comments }}
                selected={creative.post?.id === post.id}
                onSelect={() =>
                  pick({
                    imageUrl: null,
                    post: {
                      platform: post.platform,
                      id: post.id,
                      permalink: post.permalink,
                      imageUrl: post.imageUrl,
                      text: post.text,
                    },
                  })
                }
              />
            ))}
          </Grid>
        )}
      </RpDialogContent>
    </RpDialogRoot>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: MUTED }}>{children}</p>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </ul>
  );
}

function Loading() {
  return (
    <Grid>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i}>
          <Skel h={160} r={12} />
        </li>
      ))}
    </Grid>
  );
}

function Option({
  label,
  image,
  stats,
  selected,
  onSelect,
}: {
  label: string;
  image: string | null;
  stats?: { likes: number | null; comments: number | null };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        style={{
          position: "relative",
          width: "100%",
          padding: 0,
          overflow: "hidden",
          borderRadius: 12,
          border: selected ? "1.5px solid #0F6B4A" : "1px solid #E6E4DF",
          background: "#fff",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span
          style={{
            position: "relative",
            display: "block",
            aspectRatio: "1 / 1",
            width: "100%",
            background: "#F4F2EE",
          }}
        >
          {image ? (
            <Image
              unoptimized
              fill
              src={image}
              alt=""
              loading="lazy"
              sizes="200px"
              style={{ objectFit: "cover" }}
            />
          ) : null}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 4, padding: 10 }}>
          <span
            style={{
              fontSize: 12.5,
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {label}
          </span>
          {stats ? (
            <span style={{ display: "flex", gap: 12, fontSize: 11.5, color: MUTED }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Heart size={12} aria-hidden /> {stats.likes ?? 0}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <MessageCircle size={12} aria-hidden /> {stats.comments ?? 0}
              </span>
            </span>
          ) : null}
        </span>
        {selected ? (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: 999,
              background: "#0F6B4A",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={14} strokeWidth={3} aria-hidden />
            <span
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
                whiteSpace: "nowrap",
              }}
            >
              Selected
            </span>
          </span>
        ) : null}
      </button>
    </li>
  );
}
