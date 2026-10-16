"use client";

import { ExternalLink, Heart, MessageCircle, RotateCcw, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import { useCancelPost, useLibrary, usePosts, useRetryPost } from "@/lib/api/queries";
import type { LibraryPost, SocialPost } from "@/lib/api/types";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

const STATUS: Record<
  SocialPost["status"],
  { label: string; tone: "accent" | "warning" | "success" | "danger" | "neutral" }
> = {
  scheduled: { label: "Scheduled", tone: "accent" },
  publishing: { label: "Posting…", tone: "accent" },
  published: { label: "Published", tone: "success" },
  partially_published: { label: "Partly published", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

function mediaSrc(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/media/") ? parsed.pathname : url;
  } catch {
    return url;
  }
}

export function PostsPanel() {
  return (
    <div className="grid gap-8">
      <TreeVookPosts />
      <LibrarySection platform="facebook" title="On your Facebook Page" />
      <LibrarySection platform="instagram" title="On Instagram" />
    </div>
  );
}

function TreeVookPosts() {
  const posts = usePosts();
  const cancel = useCancelPost();
  const retry = useRetryPost();
  const client = useQueryClient();
  const busy = posts.data?.data.some((p) => p.status === "publishing") ?? false;
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy)
      void client.invalidateQueries({ queryKey: ["social", "library"] });
    wasBusy.current = busy;
  }, [busy, client]);
  return (
    <section aria-labelledby="autopilot-posts">
      <h2 id="autopilot-posts" className="mb-3 text-[15px] font-semibold">
        Posted from TreeVook
      </h2>
      {posts.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : posts.isError ? (
        <ErrorState message={errorMessage(posts.error)} onRetry={() => void posts.refetch()} />
      ) : posts.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing posted yet"
            description="Choose Post on any image to publish it to your Page and Instagram."
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-border divide-y">
            {posts.data.data.map((post) => {
              const status = STATUS[post.status];
              const caption = post.facebookCaption ?? post.instagramCaption ?? "";
              return (
                <li key={post.id} className="flex gap-4 p-4">
                  {post.mediaType === "video" ? (
                    <video
                      src={mediaSrc(post.imageUrl)}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-20 w-12 shrink-0 rounded-lg bg-black object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaSrc(post.imageUrl)}
                      alt=""
                      className="bg-surface-muted size-16 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="text-caption text-muted">
                        {post.status === "scheduled"
                          ? `For ${when.format(new Date(post.scheduledAt))}`
                          : when.format(new Date(post.publishedAt ?? post.scheduledAt))}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[14px]">{caption}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {(["facebook", "instagram"] as const).map((p) => {
                        const result = post[p];
                        if (!result) return null;
                        const label = p === "facebook" ? "Facebook" : "Instagram";
                        return result.permalink ? (
                          <a
                            key={p}
                            href={result.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-small text-accent inline-flex items-center gap-1 hover:underline"
                          >
                            View on {label} <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        ) : result.error ? (
                          <span key={p} className="text-small text-danger">
                            {label}: {result.error}
                          </span>
                        ) : (
                          <span key={p} className="text-small text-muted">
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {post.status === "failed" || post.status === "partially_published" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={retry.isPending && retry.variables === post.id}
                      onClick={() =>
                        retry.mutate(post.id, {
                          onSuccess: () => toast.success("Retrying the failed platform"),
                          onError: (err) => toast.error(errorMessage(err)),
                        })
                      }
                    >
                      <RotateCcw /> Retry
                    </Button>
                  ) : null}
                  {post.status === "scheduled" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        cancel.mutate(post.id, {
                          onSuccess: () => toast.success("Scheduled post cancelled"),
                          onError: (err) => toast.error(errorMessage(err)),
                        })
                      }
                    >
                      <X /> Cancel
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}

function LibrarySection({
  platform,
  title,
}: {
  platform: "facebook" | "instagram";
  title: string;
}) {
  const library = useLibrary(platform);
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
      {library.isPending ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : library.isError ? (
        <ErrorState message={errorMessage(library.error)} onRetry={() => void library.refetch()} />
      ) : !library.data.connected ? (
        <Card className="text-small text-muted p-4">
          {platform === "instagram"
            ? "No Instagram account is connected. Link your Instagram professional account to your Facebook Page, then refresh accounts in Setup."
            : "Select a Facebook Page in Setup to see its posts."}
        </Card>
      ) : library.data.data.length === 0 ? (
        <Card className="text-small text-muted p-4">No posts yet.</Card>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {library.data.data.map((post) => (
            <LibraryCard key={post.id} post={post} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LibraryCard({ post }: { post: LibraryPost }) {
  return (
    <li>
      <Card className="flex h-full flex-col overflow-hidden">
        <div className="bg-surface-muted aspect-square">
          {post.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaSrc(post.imageUrl)}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <p className="text-small text-muted line-clamp-6 p-4">{post.text}</p>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          {post.text && post.imageUrl ? (
            <p className="line-clamp-2 text-[13px]">{post.text}</p>
          ) : null}
          <div className="text-caption text-muted mt-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3.5" aria-hidden /> {post.likes ?? 0}
              <span className="sr-only">likes</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" aria-hidden /> {post.comments ?? 0}
              <span className="sr-only">comments</span>
            </span>
            {post.permalink ? (
              <a
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                className="text-accent ml-auto inline-flex items-center gap-1 hover:underline"
              >
                Open <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
      </Card>
    </li>
  );
}
