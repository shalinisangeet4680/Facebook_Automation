"use client";

import { CalendarClock, Camera, Check, Send, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { useChannels, useCreatePost } from "@/lib/api/queries";
import type { Creative } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type Platform = "facebook" | "instagram";

const LIMITS: Record<Platform, number> = { facebook: 5000, instagram: 2200 };
const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

function localInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function mediaSrc(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function PublishDialog({
  creative,
  open,
  onOpenChange,
}: {
  creative: Creative;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const channels = useChannels();
  const create = useCreatePost();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [captions, setCaptions] = useState<Record<Platform, string>>({
    facebook: "",
    instagram: "",
  });
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState(() =>
    localInputValue(new Date(Date.now() + 60 * 60_000)),
  );
  const [review, setReview] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const available: Record<Platform, string | null> = {
    facebook: channels.data?.facebook?.name ?? null,
    instagram: channels.data?.instagram?.username ?? null,
  };
  const chosen = platforms.filter((p) => available[p]);
  const scheduleDate = mode === "schedule" ? new Date(scheduledAt) : null;
  const scheduleError =
    scheduleDate &&
    (Number.isNaN(scheduleDate.getTime())
      ? "Choose a date and time."
      : scheduleDate.getTime() < openedAt + 2 * 60_000
        ? "Pick a time at least 2 minutes from now."
        : scheduleDate.getTime() > openedAt + 60 * 86_400_000
          ? "Pick a time within 60 days."
          : null);
  const captionErrors = Object.fromEntries(
    chosen.map((p) => [
      p,
      !captions[p].trim()
        ? "Write a caption."
        : captions[p].length > LIMITS[p]
          ? `At most ${LIMITS[p]} characters.`
          : p === "instagram" && (captions[p].match(/#[\p{L}\p{N}_]+/gu) ?? []).length > 30
            ? "At most 30 hashtags."
            : null,
    ]),
  ) as Partial<Record<Platform, string | null>>;
  const invalid =
    !chosen.length || Boolean(scheduleError) || Object.values(captionErrors).some(Boolean);

  const toggle = (p: Platform) =>
    setPlatforms((current) =>
      current.includes(p) ? current.filter((x) => x !== p) : [...current, p],
    );

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setReview(false);
  };

  const submit = () =>
    create.mutate(
      {
        creativeId: creative.id,
        platforms: chosen,
        facebookCaption: chosen.includes("facebook") ? captions.facebook.trim() : null,
        instagramCaption: chosen.includes("instagram") ? captions.instagram.trim() : null,
        scheduledAt: scheduleDate ? scheduleDate.toISOString() : null,
      },
      {
        onSuccess: () => {
          toast.success(
            scheduleDate
              ? `Scheduled for ${when.format(scheduleDate)}`
              : "Posting now. It appears in Posts in a few seconds.",
          );
          close(false);
          setPlatforms([]);
          setCaptions({ facebook: "", instagram: "" });
        },
        onError: (err) => {
          setReview(false);
          toast.error(errorMessage(err));
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        title={review ? "Ready to publish?" : "Post this image"}
        description={
          review
            ? "This will be public on the accounts below."
            : "Post to your Facebook Page and Instagram. You can use the post as an ad later."
        }
        className="max-h-[90dvh] max-w-xl overflow-y-auto"
      >
        {review ? (
          <div className="grid gap-4">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaSrc(creative.url)}
                alt=""
                className="bg-surface-muted size-20 shrink-0 rounded-lg object-cover"
              />
              <ul className="text-small grid content-start gap-1.5">
                {chosen.map((p) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <Check className="text-success size-4" aria-hidden />
                    {p === "facebook"
                      ? `Facebook Page ${available.facebook}`
                      : `Instagram ${available.instagram}`}
                  </li>
                ))}
                <li className="text-muted">
                  {scheduleDate ? `On ${when.format(scheduleDate)}` : "Right now"}
                </li>
              </ul>
            </div>
            {chosen.map((p) => (
              <div key={p} className="border-border rounded-lg border p-3">
                <p className="text-caption text-muted mb-1">
                  {p === "facebook" ? "Facebook caption" : "Instagram caption"}
                </p>
                <p className="text-[13px] whitespace-pre-line">{captions[p]}</p>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setReview(false)}
                disabled={create.isPending}
              >
                Back
              </Button>
              <Button onClick={submit} loading={create.isPending}>
                {scheduleDate ? <CalendarClock /> : <Send />}
                {scheduleDate ? "Schedule post" : "Publish now"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-[14px] font-medium">Where</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["facebook", "instagram"] as const).map((p) => {
                  const Icon = p === "facebook" ? Users : Camera;
                  const name = available[p];
                  return (
                    <label
                      key={p}
                      className={cn(
                        "border-border flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-3",
                        platforms.includes(p) && name && "border-accent bg-accent-soft/40",
                        !name && "cursor-not-allowed opacity-70",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--accent)]"
                        checked={platforms.includes(p) && Boolean(name)}
                        disabled={!name}
                        onChange={() => toggle(p)}
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[14px] font-medium">
                          <Icon className="size-4" aria-hidden />{" "}
                          {p === "facebook" ? "Facebook" : "Instagram"}
                        </span>
                        <span className="text-caption text-muted block truncate">
                          {name ??
                            (p === "facebook"
                              ? "Select a Page in Setup"
                              : "No Instagram account connected")}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {chosen.map((p) => (
              <Field
                key={p}
                label={p === "facebook" ? "Facebook caption" : "Instagram caption"}
                error={captions[p] ? captionErrors[p] : null}
                hint={`${captions[p].length}/${LIMITS[p]}${p === "instagram" ? " · a few relevant hashtags help" : ""}`}
              >
                {(fieldProps) => (
                  <Textarea
                    {...fieldProps}
                    rows={p === "facebook" ? 4 : 3}
                    value={captions[p]}
                    onChange={(e) => setCaptions((c) => ({ ...c, [p]: e.target.value }))}
                  />
                )}
              </Field>
            ))}

            <fieldset>
              <legend className="mb-2 text-[14px] font-medium">When</legend>
              <div className="flex flex-wrap items-start gap-3">
                <div
                  role="radiogroup"
                  aria-label="When to post"
                  className="border-border flex rounded-[var(--radius-control)] border p-1"
                >
                  {(["now", "schedule"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-[13px] font-medium outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
                        mode === m
                          ? "bg-accent text-accent-foreground"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      {m === "now" ? "Now" : "Schedule"}
                    </button>
                  ))}
                </div>
                {mode === "schedule" ? (
                  <Field label="Date and time" error={scheduleError} className="min-w-56 flex-1">
                    {(fieldProps) => (
                      <Input
                        {...fieldProps}
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                      />
                    )}
                  </Field>
                ) : null}
              </div>
            </fieldset>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button disabled={invalid} onClick={() => setReview(true)}>
                Review
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
