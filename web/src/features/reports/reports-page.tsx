"use client";

import { ArrowDownRight, ArrowUpRight, BarChart3, Minus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DailyBarChart } from "@/components/charts/daily-bar-chart";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useReport } from "@/lib/api/queries";
import type { ReportOverview, ReportPreset } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const PRESETS: { value: ReportPreset; label: string }[] = [
  { value: "last_7d", label: "7 days" },
  { value: "last_14d", label: "14 days" },
  { value: "last_30d", label: "30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

const RESULT_LABELS: Record<string, string> = {
  lead: "Leads",
  "offsite_conversion.fb_pixel_lead": "Leads",
  complete_registration: "Sign-ups",
  purchase: "Purchases",
  "offsite_conversion.fb_pixel_purchase": "Purchases",
  landing_page_view: "Page views",
  link_click: "Clicks",
};

const dateLabel = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const count = new Intl.NumberFormat("en-IN");
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

function moneyFormatter(currency: string, digits = 0) {
  const f = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
  });
  return (v: number) => f.format(v);
}

export function ReportsPage() {
  const [preset, setPreset] = useState<ReportPreset>("last_7d");
  const report = useReport(preset);

  return (
    <>
      <PageHeader
        title="Reports"
        description={
          report.data
            ? `${dateLabel.format(new Date(`${report.data.period.since}T00:00:00Z`))} – ${dateLabel.format(new Date(`${report.data.period.until}T00:00:00Z`))}, compared with the period before.`
            : "How your ads are doing."
        }
        actions={
          <div
            role="radiogroup"
            aria-label="Period"
            className="border-border bg-surface flex flex-wrap rounded-[var(--radius-control)] border p-1"
          >
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={preset === p.value}
                onClick={() => setPreset(p.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
                  preset === p.value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />
      {report.isPending ? (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : report.isError ? (
        report.error instanceof ApiError && report.error.code === "META_NOT_CONNECTED" ? (
          <Card>
            <EmptyState
              icon={<BarChart3 className="size-5" />}
              title="Connect Meta to see reports"
              description="Reports read results straight from your ad account."
              action={
                <Button asChild>
                  <Link href="/setup/connect-meta">Connect Meta</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <ErrorState message={errorMessage(report.error)} onRetry={() => void report.refetch()} />
        )
      ) : (
        <Report data={report.data} refreshing={report.isFetching} />
      )}
    </>
  );
}

function Report({ data, refreshing }: { data: ReportOverview; refreshing: boolean }) {
  const money = moneyFormatter(data.currency);
  const money2 = moneyFormatter(data.currency, 2);
  const k = data.kpis;
  const p = data.previousKpis;
  const empty = k.spend === 0 && k.impressions === 0;

  if (empty) {
    return (
      <Card>
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="No ads ran in this period"
          description="Once a campaign is live, spend and results show up here within a few hours."
          action={
            <Button asChild variant="secondary">
              <Link href="/campaigns">Plan a campaign</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className={cn("grid gap-6 transition-opacity", refreshing && "opacity-70")}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Spend"
          value={money(k.spend)}
          current={k.spend}
          previous={p.spend}
          goodWhen="neutral"
        />
        <Kpi
          label="Results"
          value={count.format(k.results)}
          current={k.results}
          previous={p.results}
          goodWhen="up"
        />
        <Kpi
          label="Cost per result"
          value={k.costPerResult === null ? "—" : money2(k.costPerResult)}
          current={k.costPerResult}
          previous={p.costPerResult}
          goodWhen="down"
          note={
            data.targetCostPerResult !== null && k.costPerResult !== null ? (
              <Badge tone={k.costPerResult <= data.targetCostPerResult ? "success" : "warning"}>
                Target {money(data.targetCostPerResult)}
              </Badge>
            ) : null
          }
        />
        <Kpi
          label="Link CTR"
          value={k.ctr === null ? "—" : `${k.ctr.toFixed(2)}%`}
          current={k.ctr}
          previous={p.ctr}
          goodWhen="up"
        />
      </div>
      <div className="text-small text-muted -mt-2 flex flex-wrap gap-x-5 gap-y-1">
        <span>Reach {compact.format(k.reach)}</span>
        <span>Impressions {compact.format(k.impressions)}</span>
        <span>Link clicks {count.format(k.linkClicks)}</span>
        <span>CPM {k.cpm === null ? "—" : money2(k.cpm)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-5">
          <h2 className="text-[15px] font-semibold">Spend per day</h2>
          <div className="mt-4">
            <DailyBarChart
              data={data.daily.map((d) => ({ date: d.date, value: d.spend }))}
              label="Spend"
              format={money}
            />
          </div>
        </Card>
        <Card className="min-w-0 p-5">
          <h2 className="text-[15px] font-semibold">Results per day</h2>
          <div className="mt-4">
            <DailyBarChart
              data={data.daily.map((d) => ({ date: d.date, value: d.results }))}
              label="Results"
              format={(v) => count.format(Math.round(v))}
            />
          </div>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-[15px] font-semibold">Campaigns</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead>
              <tr className="text-caption text-muted border-border border-b text-left">
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Campaign
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Spend
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Results
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Cost / result
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">
                  CTR
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {data.campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-caption text-muted">
                      {c.status === "ACTIVE" ? "Active" : c.status.toLowerCase().replace(/_/g, " ")}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(c.spend)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {count.format(c.results)}
                    {c.resultType ? (
                      <span className="text-caption text-muted block">
                        {RESULT_LABELS[c.resultType] ?? c.resultType}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {c.costPerResult === null ? "—" : money2(c.costPerResult)}
                    {data.targetCostPerResult !== null && c.costPerResult !== null ? (
                      <span
                        className={cn(
                          "text-caption block",
                          c.costPerResult <= data.targetCostPerResult
                            ? "text-success"
                            : "text-warning",
                        )}
                      >
                        {c.costPerResult <= data.targetCostPerResult
                          ? "Within target"
                          : "Above target"}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {c.ctr === null ? "—" : `${c.ctr.toFixed(2)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {data.topAds.length ? (
        <Card className="min-w-0">
          <div className="border-border border-b px-5 py-4">
            <h2 className="text-[15px] font-semibold">Best ads</h2>
          </div>
          <ol className="divide-border divide-y">
            {data.topAds.map((ad, i) => (
              <li key={ad.id} className="flex items-center gap-4 px-5 py-3">
                <span className="bg-surface-muted text-muted grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold">
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-[14px] font-medium">{ad.name}</p>
                <p className="text-small text-muted shrink-0 tabular-nums">
                  {count.format(ad.results)} results ·{" "}
                  {ad.costPerResult === null ? "—" : money2(ad.costPerResult)} each
                </p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  current,
  previous,
  goodWhen,
  note,
}: {
  label: string;
  value: string;
  current: number | null;
  previous: number | null;
  goodWhen: "up" | "down" | "neutral";
  note?: React.ReactNode;
}) {
  const change = current !== null && previous ? ((current - previous) / previous) * 100 : null;
  const direction = change === null || Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
  const good = goodWhen === "neutral" || direction === "flat" ? null : direction === goodWhen;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <p className="text-small text-muted">{label}</p>
      <p className="mt-1 truncate text-[22px] font-semibold tracking-tight tabular-nums sm:text-[26px]">
        {value}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {change === null ? (
          <span className="text-caption text-muted">No earlier data</span>
        ) : (
          <span
            className={cn(
              "text-caption inline-flex items-center gap-0.5 font-medium",
              good === null ? "text-muted" : good ? "text-success" : "text-danger",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {Math.abs(change).toFixed(0)}%
            <span className="sr-only">
              {" "}
              {direction === "up" ? "higher" : direction === "down" ? "lower" : ""} than the
              previous period
            </span>
          </span>
        )}
        {note}
      </div>
    </Card>
  );
}
