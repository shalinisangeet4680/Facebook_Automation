"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import { useImportReport, usePlayInsights } from "@/lib/api/queries";
import type { PlayAppDetail, PlayInsights } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import {
  ChartCard,
  HBars,
  RatingLine,
  STAR_COLORS,
  StarColumns,
  StarLegend,
  StatTile,
} from "./charts";
import { languageLabel } from "./labels";
import { Chip } from "./reviews-tab";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
] as const;

const dateLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function delta(
  current: number | null,
  previous: number | null,
  unit: string,
  digits = 1,
  upIsGood = true,
) {
  if (current === null || previous === null) return null;
  const change = Math.round((current - previous) * 10 ** digits) / 10 ** digits;
  if (change === 0) return { text: `No change vs previous ${unit}`, good: null };
  return {
    text: `${change > 0 ? "+" : ""}${change.toFixed(digits)} vs previous ${unit}`,
    good: change > 0 === upIsGood,
  };
}

function hours(h: number | null) {
  if (h === null) return "–";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round(h / 24)} days`;
}

export function InsightsTab({ app }: { app: PlayAppDetail }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]["days"]>(30);
  const insights = usePlayInsights(app.id, days);
  const [importing, setImporting] = useState(false);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Period" className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <Chip key={p.days} pressed={days === p.days} onClick={() => setDays(p.days)}>
              {p.label}
            </Chip>
          ))}
        </div>
        <span className="flex-1" />
        <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
          <FileUp /> Import history
        </Button>
      </div>
      {insights.isPending ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : insights.isError ? (
        <ErrorState
          message={errorMessage(insights.error)}
          onRetry={() => void insights.refetch()}
        />
      ) : (
        <div className={cn("grid gap-4 transition-opacity", insights.isFetching && "opacity-70")}>
          <Overview app={app} data={insights.data} onImport={() => setImporting(true)} />
        </div>
      )}
      <ImportDialog app={app} open={importing} onOpenChange={setImporting} />
    </div>
  );
}

function Overview({
  app,
  data,
  onImport,
}: {
  app: PlayAppDetail;
  data: PlayInsights;
  onImport: () => void;
}) {
  const unit = data.days === 365 ? "year" : `${data.days} days`;
  const labelFor = (start: string) => {
    const d = new Date(`${start}T00:00:00`);
    return data.weekly ? `Week of ${dateLabel.format(d)}` : dateLabel.format(d);
  };
  const axisLabel = (start: string) => dateLabel.format(new Date(`${start}T00:00:00`));
  const none = data.reviews === 0;
  const emptyNote = none
    ? "No reviews in this period. Google only shares the last week through its API; import your Play Console reports for history."
    : null;
  const totalShare = (n: number) =>
    data.reviews ? `${Math.round((n / data.reviews) * 100)}%` : "0%";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Average rating"
          value={data.rating === null ? "–" : `${data.rating.toFixed(2)}★`}
          delta={delta(data.rating, data.previousRating, unit, 2)}
          hint={`From ${data.reviews} reviews`}
        />
        <StatTile
          label="Reviews"
          value={String(data.reviews)}
          delta={delta(data.reviews, data.previousReviews, unit, 0)}
          hint={`${data.textReviews} with text`}
        />
        <StatTile
          label="Reply rate"
          value={data.replyRate === null ? "–" : `${data.replyRate}%`}
          delta={
            data.replyRate !== null && data.previousReplyRate !== null
              ? delta(data.replyRate, data.previousReplyRate, unit, 1)
              : null
          }
          hint="Of reviews with text"
        />
        <StatTile
          label="Median time to reply"
          value={hours(data.medianReplyHours)}
          hint={app.needsReply ? `${app.needsReply} reviews still need a reply` : "Nothing waiting"}
        />
      </div>

      <ChartCard
        title="Reviews by rating"
        description={data.weekly ? "Per week" : "Per day"}
        empty={emptyNote}
        table={{
          head: [data.weekly ? "Week" : "Day", "Total", "5★", "4★", "3★", "2★", "1★"],
          rows: data.series.map((p) => [labelFor(p.start), p.total, ...[...p.stars].reverse()]),
        }}
      >
        <StarLegend />
        <StarColumns
          data={data.series.map((p) => ({
            label: axisLabel(p.start),
            stars: p.stars,
            total: p.total,
          }))}
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Average rating"
          description={data.weekly ? "Per week" : "Per day, days without reviews are skipped"}
          empty={emptyNote}
          table={{
            head: [data.weekly ? "Week" : "Day", "Average", "Reviews"],
            rows: data.series.map((p) => [
              labelFor(p.start),
              p.rating === null ? "–" : p.rating.toFixed(2),
              p.total,
            ]),
          }}
        >
          <RatingLine
            data={data.series.map((p) => ({ label: axisLabel(p.start), value: p.rating }))}
          />
        </ChartCard>

        <ChartCard
          title="Star breakdown"
          description={`Share of ${data.reviews} reviews`}
          empty={emptyNote}
          table={{
            head: ["Rating", "Reviews", "Share"],
            rows: [5, 4, 3, 2, 1].map((s) => [
              `${s}★`,
              data.distribution[s - 1]!,
              totalShare(data.distribution[s - 1]!),
            ]),
          }}
        >
          <HBars
            label="Reviews per star rating"
            max={Math.max(...data.distribution, 1)}
            format={(v) => `${v} · ${totalShare(v)}`}
            rows={[5, 4, 3, 2, 1].map((s) => ({
              key: String(s),
              label: `${s}★`,
              value: data.distribution[s - 1]!,
              color: STAR_COLORS[s - 1],
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Rating by app version"
          description="Newest versions first. A drop usually points at a bad release."
          empty={data.versions.length ? null : "No version information in this period."}
          table={{
            head: ["Version", "Average", "Reviews"],
            rows: data.versions.map((v) => [v.version, v.rating.toFixed(2), v.reviews]),
          }}
        >
          <HBars
            label="Average rating per app version"
            max={5}
            format={(v) => `${v.toFixed(1)}★`}
            rows={data.versions.map((v) => ({
              key: v.version,
              label: v.version,
              value: v.rating,
              detail: `${v.reviews} reviews`,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Languages"
          description="Add template wordings for the languages you see most."
          empty={data.languages.length ? null : emptyNote}
          table={{
            head: ["Language", "Reviews"],
            rows: data.languages.map((l) => [languageLabel(l.language), l.reviews]),
          }}
        >
          <HBars
            label="Reviews per language"
            format={(v) => String(v)}
            rows={data.languages.slice(0, 8).map((l) => ({
              key: l.language,
              label: l.language === "unknown" ? "Unknown" : languageLabel(l.language),
              value: l.reviews,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="What unhappy reviewers mention"
          description="Words in 1–2★ reviews, by how many reviews use them"
          empty={data.complaints.length ? null : "No common words in 1–2★ reviews yet."}
          table={{
            head: ["Word", "Reviews"],
            rows: data.complaints.map((w) => [w.word, w.reviews]),
          }}
        >
          <HBars
            label="Common words in unhappy reviews"
            color="var(--chart-star-1)"
            format={(v) => `${v} review${v === 1 ? "" : "s"}`}
            rows={data.complaints.map((w) => ({ key: w.word, label: w.word, value: w.reviews }))}
          />
        </ChartCard>

        <ChartCard
          title="What happy reviewers mention"
          description="Words in 4–5★ reviews. Good material for your store listing."
          empty={data.praise.length ? null : "No common words in 4–5★ reviews yet."}
          table={{ head: ["Word", "Reviews"], rows: data.praise.map((w) => [w.word, w.reviews]) }}
        >
          <HBars
            label="Common words in happy reviews"
            color="var(--chart-star-5)"
            format={(v) => `${v} review${v === 1 ? "" : "s"}`}
            rows={data.praise.map((w) => ({ key: w.word, label: w.word, value: w.reviews }))}
          />
        </ChartCard>
      </div>
      {none ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={onImport}>
            <FileUp /> Import Play Console reports
          </Button>
        </div>
      ) : null}
    </>
  );
}

function ImportDialog({
  app,
  open,
  onOpenChange,
}: {
  app: PlayAppDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const upload = useImportReport(app.id);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const send = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let imported = 0;
    let rows = 0;
    for (const file of Array.from(files)) {
      try {
        const r = await upload.mutateAsync(file);
        imported += r.imported;
        rows += r.rows;
      } catch (err) {
        toast.error(`${file.name}: ${errorMessage(err)}`);
      }
    }
    setBusy(false);
    if (rows) {
      toast.success(`${imported} reviews imported (${rows - imported} were already here)`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Import review history"
        description="Google's API only returns the last week of reviews. Play Console's monthly reports have everything, including star-only ratings."
        className="max-w-lg"
      >
        <ol className="text-small text-muted mb-5 grid list-decimal gap-2 pl-5">
          <li>
            In Play Console, open{" "}
            <span className="text-foreground font-medium">Download reports → Reviews</span>.
          </li>
          <li>
            Pick <span className="text-foreground font-medium">{app.title}</span> and download the
            months you want. Each is a file like{" "}
            <code className="font-mono text-[12px]">reviews_{app.packageName}_202609.csv</code>.
          </li>
          <li>
            Upload one or more files here. Reviews you already have are skipped, and nothing is
            replied to automatically.
          </li>
        </ol>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="sr-only"
          aria-label="Choose review report files"
          onChange={(e) => {
            void send(e.target.files);
            e.target.value = "";
          }}
        />
        <Button onClick={() => input.current?.click()} loading={busy}>
          <FileUp /> Choose report files
        </Button>
      </DialogContent>
    </Dialog>
  );
}
