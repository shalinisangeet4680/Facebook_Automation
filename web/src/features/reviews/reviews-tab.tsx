"use client";

import { Search, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, inputClass } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import {
  type PlayReviewFilters,
  useBulkReply,
  usePlayReviews,
  usePlayTemplates,
} from "@/lib/api/queries";
import type { PlayAppDetail, PlayReviewState } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { STATES, languageLabel } from "./labels";
import { ReviewCard } from "./review-card";

export function Chip({
  pressed,
  onClick,
  children,
  count,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
        pressed
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
      {count !== undefined ? <span className="tabular-nums opacity-80">{count}</span> : null}
    </button>
  );
}

export function ReviewsTab({ app }: { app: PlayAppDetail }) {
  const [state, setState] = useState<PlayReviewState | "all">(
    app.waiting > 0 ? "waiting" : "unreplied",
  );
  const [stars, setStars] = useState<number[]>([]);
  const [language, setLanguage] = useState("");
  const [version, setVersion] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const filters: PlayReviewFilters = {
    state: state === "all" ? undefined : state,
    stars,
    language,
    version,
    q,
    page,
  };
  const reviews = usePlayReviews(app.id, filters);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
    setSelected([]);
  };
  const data = reviews.data;
  const pages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <div className="grid gap-4">
      <div
        role="group"
        aria-label="Review status"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {STATES.filter((s) => s.value !== "failed" || (data?.counts.failed ?? 0) > 0).map((s) => (
          <Chip
            key={s.value}
            pressed={state === s.value}
            onClick={() => reset(() => setState(s.value))}
            count={
              data
                ? s.value === "all"
                  ? Object.values(data.counts).reduce((a, b) => a + b, 0)
                  : data.counts[s.value]
                : undefined
            }
          >
            {s.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Stars" className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip
              key={n}
              pressed={stars.includes(n)}
              onClick={() =>
                reset(() =>
                  setStars(stars.includes(n) ? stars.filter((s) => s !== n) : [...stars, n]),
                )
              }
            >
              {n}★
            </Chip>
          ))}
        </div>
        <select
          aria-label="Language"
          className={cn(inputClass, "h-9 w-auto text-[14px]")}
          value={language}
          onChange={(e) => reset(() => setLanguage(e.target.value))}
        >
          <option value="">All languages</option>
          {(data?.languages ?? []).map((l) => (
            <option key={l} value={l}>
              {languageLabel(l)}
            </option>
          ))}
        </select>
        <select
          aria-label="App version"
          className={cn(inputClass, "h-9 w-auto text-[14px]")}
          value={version}
          onChange={(e) => reset(() => setVersion(e.target.value))}
        >
          <option value="">All versions</option>
          {(data?.versions ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <div className="relative min-w-48 flex-1">
          <Search className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            aria-label="Search reviews"
            placeholder="Search text or name"
            className="h-9 pl-9 text-[14px]"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {selected.length ? (
        <BulkBar app={app} selected={selected} onDone={() => setSelected([])} />
      ) : null}

      {reviews.isPending ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : reviews.isError ? (
        <ErrorState message={errorMessage(reviews.error)} onRetry={() => void reviews.refetch()} />
      ) : !data?.data.length ? (
        <Card>
          <EmptyState
            title={state === "unreplied" ? "Every review has a reply" : "No reviews here"}
            description="Autopilot checks Google Play every hour. Reviews with text from the last week appear here, and are kept after that."
          />
        </Card>
      ) : (
        <>
          <ul className={cn("grid gap-3", reviews.isFetching && "opacity-70 transition-opacity")}>
            {data.data.map((review) => (
              <ReviewCard
                key={review.id}
                app={app}
                review={review}
                selected={selected.includes(review.id)}
                onSelect={() =>
                  setSelected(
                    selected.includes(review.id)
                      ? selected.filter((s) => s !== review.id)
                      : [...selected, review.id].slice(0, 50),
                  )
                }
              />
            ))}
          </ul>
          {pages > 1 ? (
            <nav aria-label="Pages" className="flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-small text-muted">
                Page {page} of {pages} · {data.total} reviews
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

function BulkBar({
  app,
  selected,
  onDone,
}: {
  app: PlayAppDetail;
  selected: string[];
  onDone: () => void;
}) {
  const templates = usePlayTemplates(app.id);
  const bulk = useBulkReply(app.id);
  const [templateId, setTemplateId] = useState("");
  return (
    <Card className="border-accent/40 bg-accent-soft/30 sticky top-2 z-10 flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="text-[14px] font-medium">{selected.length} selected</span>
      <select
        aria-label="Template for the selected reviews"
        className={cn(inputClass, "h-9 w-auto min-w-48 flex-1 text-[14px]")}
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
      >
        <option value="">Choose a template</option>
        {(templates.data?.data ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={!templateId}
        loading={bulk.isPending}
        onClick={() =>
          bulk.mutate(
            { reviewIds: selected, templateId },
            {
              onSuccess: (r) => {
                const parts = [`${r.sent} sent`];
                if (r.held.length)
                  parts.push(`${r.held.length} need a look (missing values or too long)`);
                if (r.failed.length) parts.push(`${r.failed.length} failed`);
                (r.failed.length || r.held.length ? toast.warning : toast.success)(
                  parts.join(", "),
                );
                onDone();
              },
              onError: (err) => toast.error(errorMessage(err)),
            },
          )
        }
      >
        <Send /> Reply to {selected.length}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Clear
      </Button>
    </Card>
  );
}
