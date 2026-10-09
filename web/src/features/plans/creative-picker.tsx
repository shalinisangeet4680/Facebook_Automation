"use client";

import { Check, Heart, MessageCircle } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreatives, useLibrary } from "@/lib/api/queries";
import type { CampaignPlan } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type Creative = CampaignPlan["creative"];
type Tab = "images" | "facebook" | "instagram";

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creative: Creative;
  onPick: (patch: Partial<Creative>) => void;
}) {
  const [tab, setTab] = useState<Tab>("images");
  const creatives = useCreatives();
  const facebook = useLibrary("facebook", open && tab === "facebook");
  const instagram = useLibrary("instagram", open && tab === "instagram");

  const pick = (patch: Partial<Creative>) => {
    onPick(patch);
    onOpenChange(false);
  };

  const library = tab === "facebook" ? facebook : instagram;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Choose what the ad shows"
        description="Use an image from your library, or run the ad on a post that's already on your Page or Instagram so it keeps its likes and comments."
        className="max-h-[90dvh] max-w-3xl overflow-y-auto"
      >
        <div role="tablist" aria-label="Source" className="border-border mb-4 flex gap-5 border-b">
          {(
            [
              ["images", "Your images"],
              ["facebook", "Facebook posts"],
              ["instagram", "Instagram posts"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "-mb-px border-b-2 px-1 pb-2 text-[14px] font-medium outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
                tab === value
                  ? "border-accent text-foreground"
                  : "text-muted hover:text-foreground border-transparent",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "images" ? (
          creatives.isPending ? (
            <Grid>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </Grid>
          ) : !creatives.data?.data.length ? (
            <p className="text-small text-muted py-8 text-center">
              No images yet. Upload one in Creatives or ask Claude to design one.
            </p>
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
          <Grid>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </Grid>
        ) : !library.data?.connected ? (
          <p className="text-small text-muted py-8 text-center">
            {tab === "instagram"
              ? "No Instagram account is connected."
              : "No Facebook Page is selected."}
          </p>
        ) : !library.data.data.length ? (
          <p className="text-small text-muted py-8 text-center">
            No posts yet. Publish one from Creatives first.
          </p>
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
      </DialogContent>
    </Dialog>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</ul>;
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
        className={cn(
          "border-border bg-surface hover:border-border-strong relative w-full overflow-hidden rounded-[var(--radius-card)] border text-left outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
          selected && "border-accent ring-accent ring-1",
        )}
      >
        <div className="bg-surface-muted aspect-square">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" loading="lazy" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="p-2.5">
          <p className="line-clamp-2 text-[13px]">{label}</p>
          {stats ? (
            <p className="text-caption text-muted mt-1 flex gap-3">
              <span className="inline-flex items-center gap-1">
                <Heart className="size-3" aria-hidden /> {stats.likes ?? 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3" aria-hidden /> {stats.comments ?? 0}
              </span>
            </p>
          ) : null}
        </div>
        {selected ? (
          <span className="bg-accent text-accent-foreground absolute top-2 right-2 grid size-6 place-items-center rounded-full">
            <Check className="size-3.5" aria-hidden />
            <span className="sr-only">Selected</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}
