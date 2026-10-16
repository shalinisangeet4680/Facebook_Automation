"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import { usePlayApp, useSyncPlayApp } from "@/lib/api/queries";
import type { PlayAppDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { AppIcon } from "./apps-page";
import { MODE, ago } from "./labels";
import { ReviewsTab } from "./reviews-tab";
import { RulesTab } from "./rules-tab";
import { SettingsTab } from "./settings-tab";
import { Rating } from "./stars";
import { TemplatesTab } from "./templates-tab";

const TABS = ["reviews", "templates", "rules", "settings"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  reviews: "Reviews",
  templates: "Templates",
  rules: "Rules",
  settings: "Settings",
};

export function ReviewAppView() {
  const { id } = useParams<{ id: string }>();
  const app = usePlayApp(id);
  if (app.isPending)
    return (
      <div className="grid gap-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (app.isError)
    return <ErrorState message={errorMessage(app.error)} onRetry={() => void app.refetch()} />;
  return <AppBody app={app.data} />;
}

function AppBody({ app }: { app: PlayAppDetail }) {
  const [tab, setTab] = useState<Tab>("reviews");
  const sync = useSyncPlayApp(app.id);
  const mode = MODE[app.mode];

  return (
    <>
      <PageHeader
        eyebrow={
          <Button asChild variant="link" size="sm">
            <Link href="/reviews">Review replies</Link>
          </Button>
        }
        title={app.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{app.packageName}</span>
            <Rating value={app.rating} previous={app.previousRating} />
          </span>
        }
        actions={
          <>
            <AppIcon app={app} size={40} />
            <Badge tone={mode.tone}>{mode.label}</Badge>
            <Button
              variant="secondary"
              size="sm"
              loading={sync.isPending}
              onClick={() =>
                sync.mutate(undefined, {
                  onSuccess: (r) =>
                    toast.success(
                      r.created || r.updated
                        ? `${r.created} new and ${r.updated} updated reviews, ${r.drafts} replies drafted`
                        : "No new reviews",
                    ),
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              <RefreshCw /> Check now
            </Button>
          </>
        }
      />
      {app.syncError ? (
        <div
          role="alert"
          className="border-danger/30 bg-danger-soft mb-6 flex items-start gap-3 rounded-[var(--radius-card)] border px-4 py-3"
        >
          <AlertTriangle className="text-danger mt-0.5 size-4 shrink-0" />
          <p className="text-[14px]">
            {app.syncError}{" "}
            <span className="text-muted">Last checked {ago(app.lastSyncedAt)}.</span>
          </p>
        </div>
      ) : null}
      <div
        role="tablist"
        aria-label="App sections"
        className="border-border mb-6 flex gap-6 overflow-x-auto border-b"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-1 pb-2.5 text-[14px] font-medium outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
              tab === t
                ? "border-accent text-foreground"
                : "text-muted hover:text-foreground border-transparent",
            )}
          >
            {TAB_LABELS[t]}
            {t === "reviews" && app.needsReply + app.waiting > 0 ? (
              <Badge tone="accent">{app.needsReply}</Badge>
            ) : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={TAB_LABELS[tab]}>
        {tab === "reviews" ? <ReviewsTab app={app} /> : null}
        {tab === "templates" ? <TemplatesTab app={app} /> : null}
        {tab === "rules" ? <RulesTab app={app} onOpenSettings={() => setTab("settings")} /> : null}
        {tab === "settings" ? <SettingsTab key={app.id} app={app} /> : null}
      </div>
    </>
  );
}
