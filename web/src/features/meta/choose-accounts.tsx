"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AtSign, Building2, Database, Megaphone, RefreshCw, Unplug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import {
  keys,
  useJob,
  useMetaAssets,
  useMetaConnection,
  useRefreshAssets,
  useSelectAssets,
} from "@/lib/api/queries";
import type { Asset, AssetKind, AssetSelection } from "@/lib/api/types";

import { ASSET_LABELS } from "./asset-kinds";
import { formatMinorAmount, timeAgo } from "./format";

const SECTIONS: {
  kind: Exclude<AssetKind, "business">;
  field: keyof AssetSelection;
  title: string;
  description: string;
  icon: typeof Megaphone;
  required: boolean;
}[] = [
  {
    kind: "ad_account",
    field: "adAccountId",
    title: "Ad account",
    description: "Where campaigns are created and billed.",
    icon: Megaphone,
    required: true,
  },
  {
    kind: "page",
    field: "pageId",
    title: "Facebook Page",
    description: "The identity your ads run from.",
    icon: Building2,
    required: true,
  },
  {
    kind: "instagram",
    field: "instagramId",
    title: "Instagram account",
    description: "Used for Instagram placements and posts.",
    icon: AtSign,
    required: false,
  },
  {
    kind: "dataset",
    field: "datasetId",
    title: "Dataset (Pixel)",
    description: "Measures visits, leads and sign-ups from your ads.",
    icon: Database,
    required: false,
  },
];

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function AssetMeta({ asset, now }: { asset: Asset; now: number }) {
  const d = asset.details;
  if (asset.kind === "ad_account") {
    const cap = formatMinorAmount(d.spendCap, d.currency);
    return (
      <>
        {typeof d.currency === "string" ? <Badge>{d.currency}</Badge> : null}
        {d.status === 1 ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <Badge tone="warning">Not active</Badge>
        )}
        {cap ? <Badge>Spend cap {cap}</Badge> : null}
      </>
    );
  }
  if (asset.kind === "page") {
    return (
      <>
        {typeof d.category === "string" ? <Badge>{d.category}</Badge> : null}
        {d.instagramId ? <Badge tone="accent">Instagram linked</Badge> : null}
      </>
    );
  }
  if (asset.kind === "dataset") {
    const ago = timeAgo(d.lastFiredTime, now);
    return ago ? (
      <Badge tone="success">Last event {ago}</Badge>
    ) : (
      <Badge tone="warning">No events yet</Badge>
    );
  }
  return null;
}

function AccountsForm({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const select = useSelectAssets();
  const now = useNow();
  const [selection, setSelection] = useState<AssetSelection>(() =>
    Object.fromEntries(
      SECTIONS.map((s) => [
        s.field,
        assets.find((a) => a.kind === s.kind && a.isPrimary)?.externalId,
      ]),
    ),
  );
  const missingRequired = SECTIONS.filter((s) => s.required && !selection[s.field]);

  return (
    <div className="grid gap-6">
      {SECTIONS.map((section) => {
        const options = assets.filter((a) => a.kind === section.kind);
        const Icon = section.icon;
        return (
          <Card key={section.kind}>
            <div className="border-border flex items-start gap-4 border-b px-5 py-4 sm:px-6">
              <span className="bg-accent-soft text-accent grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)]">
                <Icon className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                  {section.title}
                  {section.required ? (
                    <Badge tone="accent">Required</Badge>
                  ) : (
                    <Badge>Optional</Badge>
                  )}
                </h3>
                <p className="text-small text-muted">{section.description}</p>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              {options.length ? (
                <RadioCardGroup
                  value={selection[section.field] ?? ""}
                  onValueChange={(v) => setSelection((s) => ({ ...s, [section.field]: v }))}
                  className="sm:grid-cols-2"
                  aria-label={section.title}
                >
                  {options.map((asset) => (
                    <RadioCard
                      key={asset.id}
                      value={asset.externalId}
                      title={asset.name}
                      description={asset.externalId}
                      meta={<AssetMeta asset={asset} now={now} />}
                    />
                  ))}
                </RadioCardGroup>
              ) : (
                <p className="text-small text-muted">
                  No {ASSET_LABELS[section.kind].one.toLowerCase()} was found. Assign one to the
                  system user in Meta Business settings, then refresh.
                </p>
              )}
            </div>
          </Card>
        );
      })}
      <div className="border-border bg-surface/90 sticky bottom-4 z-10 flex flex-col gap-3 rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-floating)] backdrop-blur sm:flex-row sm:items-center">
        <p className="text-small text-muted flex-1">
          {missingRequired.length
            ? `Choose a ${missingRequired.map((s) => s.title.toLowerCase()).join(" and a ")} to continue.`
            : "You can change these at any time."}
        </p>
        <Button
          size="lg"
          disabled={missingRequired.length > 0}
          loading={select.isPending}
          onClick={() =>
            select.mutate(selection, {
              onSuccess: () => {
                toast.success("Accounts saved");
                router.push("/setup");
              },
              onError: (err) => toast.error(errorMessage(err)),
            })
          }
        >
          Save and continue
        </Button>
      </div>
    </div>
  );
}

function RefreshButton() {
  const client = useQueryClient();
  const refresh = useRefreshAssets();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob(jobId);
  const status = job.data?.status;
  const running =
    refresh.isPending || (jobId !== null && status !== "completed" && status !== "failed");

  useEffect(() => {
    if (!jobId || !status) return;
    if (status === "completed") {
      void client.invalidateQueries({ queryKey: keys.assets });
      void client.invalidateQueries({ queryKey: keys.connection });
      toast.success("Assets refreshed from Meta");
    } else if (status === "failed") {
      toast.error(job.data?.error ?? "Refresh failed.");
    }
  }, [status, jobId, client, job.data?.error]);

  return (
    <Button
      variant="secondary"
      loading={running}
      onClick={() =>
        refresh.mutate(undefined, {
          onSuccess: (res) => setJobId(res.jobId),
          onError: (err) => toast.error(errorMessage(err)),
        })
      }
    >
      <RefreshCw /> Refresh from Meta
    </Button>
  );
}

function Loading() {
  return (
    <div className="grid gap-6">
      {[0, 1].map((i) => (
        <Card key={i} className="p-6">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ChooseAccounts() {
  const connection = useMetaConnection();
  const assets = useMetaAssets();
  const connected = connection.data?.status === "active";

  return (
    <>
      <Link
        href="/setup"
        className="text-small text-muted hover:text-foreground mb-6 inline-flex items-center gap-1.5 font-medium transition-colors"
      >
        <ArrowLeft className="size-4" /> Setup
      </Link>
      <PageHeader
        title="Choose your accounts"
        description="Pick the ad account, Page, Instagram account and dataset your campaigns will use."
        actions={connected ? <RefreshButton /> : undefined}
      />
      {connection.isPending || assets.isPending ? (
        <Loading />
      ) : connection.isError || assets.isError ? (
        <ErrorState
          message={errorMessage(connection.error ?? assets.error)}
          onRetry={() => {
            void connection.refetch();
            void assets.refetch();
          }}
        />
      ) : !connected ? (
        <Card>
          <EmptyState
            icon={<Unplug className="size-5" />}
            title="Connect Meta first"
            description="Once your Meta business is connected, your ad accounts, Pages and datasets appear here."
            action={
              <Button asChild>
                <Link href="/setup/connect-meta">Connect Meta</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <AccountsForm key={assets.data.data.map((a) => a.id).join(",")} assets={assets.data.data} />
      )}
    </>
  );
}
