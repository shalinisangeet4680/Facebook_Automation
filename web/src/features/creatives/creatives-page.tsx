"use client";

import { ImagePlus, Link2, Sparkles, Trash2, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import { useCreatives, useDeleteCreative, useUploadCreative } from "@/lib/api/queries";
import type { Creative } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp";
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

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
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const send = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    upload.mutate(
      { file },
      {
        onSuccess: (c) => toast.success(`${c.name} added`),
        onError: (err) => toast.error(errorMessage(err)),
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
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <PageHeader
        title="Creatives"
        description="Your ad images. Upload your own, or ask Claude to design one; it lands here ready to post or use in an ad."
        actions={
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Upload an image"
              onChange={(e) => {
                send(e.target.files);
                e.target.value = "";
              }}
            />
            <Button onClick={() => input.current?.click()} loading={upload.isPending}>
              <Upload /> Upload image
            </Button>
          </>
        }
      />

      {creatives.isPending ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/5]" />
          ))}
        </div>
      ) : creatives.isError ? (
        <ErrorState
          message={errorMessage(creatives.error)}
          onRetry={() => void creatives.refetch()}
        />
      ) : creatives.data.data.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn(
            "border-border-strong hover:border-accent hover:bg-accent-soft/30 flex w-full flex-col items-center rounded-[var(--radius-card)] border-2 border-dashed px-6 py-16 text-center transition-colors outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
            dragging && "border-accent bg-accent-soft/40",
          )}
        >
          <span className="bg-accent-soft text-accent grid size-12 place-items-center rounded-full">
            <ImagePlus className="size-5" />
          </span>
          <span className="mt-4 text-[15px] font-semibold">
            Drop an image here or choose a file
          </span>
          <span className="text-small text-muted mt-1 max-w-md">
            PNG, JPEG or WebP up to 8 MB. Square 1080 × 1080 works everywhere. Or ask Claude:
            “Design a square ad image for my clinic app and save it to Autopilot.”
          </span>
        </button>
      ) : (
        <>
          {dragging ? (
            <div className="border-accent bg-accent-soft/40 text-accent mb-4 rounded-[var(--radius-card)] border-2 border-dashed p-6 text-center font-medium">
              Drop to upload
            </div>
          ) : null}
          <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {creatives.data.data.map((c) => (
              <CreativeCard key={c.id} creative={c} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CreativeCard({ creative }: { creative: Creative }) {
  const [confirm, setConfirm] = useState(false);
  const remove = useDeleteCreative();
  return (
    <li>
      <Card className="flex h-full flex-col overflow-hidden">
        <div className="bg-surface-muted relative aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaSrc(creative.url)}
            alt={creative.name}
            loading="lazy"
            className="size-full object-contain"
          />
          {creative.source === "claude" ? (
            <Badge tone="accent" className="absolute top-2 left-2">
              <Sparkles className="size-3" /> Claude
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">{creative.name}</p>
            <p className="text-caption text-muted">
              {creative.width} × {creative.height} · {sizeLabel(creative.bytes)} ·{" "}
              {date.format(new Date(creative.createdAt))}
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Copy link to ${creative.name}`}
              onClick={async () => {
                await navigator.clipboard.writeText(creative.url);
                toast.success("Image link copied");
              }}
            >
              <Link2 />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger-soft hover:text-danger"
              aria-label={`Delete ${creative.name}`}
              onClick={() => setConfirm(true)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </Card>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent
          title={`Delete ${creative.name}?`}
          description="It's removed from your library. Posts and ads already using it on Facebook or Instagram stay as they are."
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(creative.id, {
                  onSuccess: () => {
                    setConfirm(false);
                    toast.success("Image deleted");
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}
