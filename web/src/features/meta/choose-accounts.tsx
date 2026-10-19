"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AtSign, Building2, Check, Database, Megaphone, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  keys,
  useJob,
  useMetaAssets,
  useMetaConnection,
  useOnboarding,
  useRefreshAssets,
  useSelectAssets,
} from "@/lib/api/queries";
import type { Asset, AssetKind, AssetSelection } from "@/lib/api/types";
import { Banner, PageHead, Skel, Spinner, useToast } from "@/features/replyly/ui";

import { ASSET_LABELS } from "./asset-kinds";
import { formatMinorAmount, timeAgo } from "./format";
import { CardTitle, MUTED, Pill, cardHead } from "./ui";

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
        {typeof d.currency === "string" ? <Pill>{d.currency}</Pill> : null}
        {d.status === 1 ? <Pill tone="success">Active</Pill> : <Pill tone="warn">Not active</Pill>}
        {cap ? <Pill>Spend cap {cap}</Pill> : null}
      </>
    );
  }
  if (asset.kind === "page") {
    return (
      <>
        {typeof d.category === "string" ? <Pill>{d.category}</Pill> : null}
        {d.instagramId ? <Pill tone="info">Instagram linked</Pill> : null}
      </>
    );
  }
  if (asset.kind === "dataset") {
    const ago = timeAgo(d.lastFiredTime, now);
    return ago ? (
      <Pill tone="success">Last event {ago}</Pill>
    ) : (
      <Pill tone="warn">No events yet</Pill>
    );
  }
  return null;
}

function AssetOption({
  asset,
  name,
  checked,
  now,
  onSelect,
}: {
  asset: Asset;
  name: string;
  checked: boolean;
  now: number;
  onSelect: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <label
      style={{
        position: "relative",
        outline: focused ? "2px solid #C9C5BC" : "none",
        outlineOffset: 2,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${checked ? "#191917" : "#E6E4DF"}`,
        background: checked ? "#FAF9F7" : "#fff",
        cursor: "pointer",
        minWidth: 0,
        transition: "border-color .15s, background .15s",
      }}
    >
      <input
        type="radio"
        name={name}
        value={asset.externalId}
        checked={checked}
        onChange={onSelect}
        onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
        onBlur={() => setFocused(false)}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1, margin: 0 }}
      />
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          marginTop: 1,
          borderRadius: 999,
          flexShrink: 0,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: checked ? "#191917" : "#fff",
          border: checked ? "none" : "1.5px solid #C9C5BC",
          color: "#fff",
        }}
      >
        {checked ? <Check size={11} strokeWidth={3} /> : null}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 500, fontSize: 13.5, overflowWrap: "anywhere" }}>
          {asset.name}
        </span>
        <span
          className="rp-mono"
          style={{ fontSize: 11.5, color: MUTED, overflowWrap: "anywhere" }}
        >
          {asset.externalId}
        </span>
        <span style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
          <AssetMeta asset={asset} now={now} />
        </span>
      </span>
    </label>
  );
}

function datasetFits(dataset: Asset, adAccountId: string | undefined): boolean {
  if (!adAccountId) return true;
  const ids = dataset.details.adAccountIds;
  if (Array.isArray(ids)) return ids.includes(adAccountId);
  const single = dataset.details.adAccountId;
  return typeof single !== "string" || single === adAccountId;
}

function AccountsForm({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const toast = useToast();
  const select = useSelectAssets();
  const onboarding = useOnboarding();
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
  const chooseAdAccount = (adAccountId: string) =>
    setSelection((s) => {
      const current = assets.find((a) => a.kind === "dataset" && a.externalId === s.datasetId);
      if (!current || datasetFits(current, adAccountId)) return { ...s, adAccountId };
      const fitting = assets.filter((a) => a.kind === "dataset" && datasetFits(a, adAccountId));
      return {
        ...s,
        adAccountId,
        datasetId: fitting.length === 1 ? fitting[0]!.externalId : undefined,
      };
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {SECTIONS.map((section) => {
        const options = assets.filter(
          (a) =>
            a.kind === section.kind &&
            (section.kind !== "dataset" || datasetFits(a, selection.adAccountId)),
        );
        const hidden =
          section.kind === "dataset" &&
          assets.some((a) => a.kind === "dataset" && !datasetFits(a, selection.adAccountId));
        const Icon = section.icon;
        return (
          <section key={section.kind} className="rp-card" style={{ overflow: "hidden" }}>
            <div style={{ ...cardHead, justifyContent: "flex-start", alignItems: "flex-start" }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#F4F2EE",
                  color: "#191917",
                }}
              >
                <Icon size={17} />
              </span>
              <CardTitle
                title={
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {section.title}
                    {section.required ? (
                      <Pill tone="success">Required</Pill>
                    ) : (
                      <Pill>Optional</Pill>
                    )}
                  </span>
                }
                sub={section.description}
              />
            </div>
            <div style={{ padding: 16 }}>
              {options.length ? (
                <div
                  role="radiogroup"
                  aria-label={section.title}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
                    gap: 10,
                  }}
                >
                  {options.map((asset) => (
                    <AssetOption
                      key={asset.id}
                      asset={asset}
                      name={section.kind}
                      now={now}
                      checked={selection[section.field] === asset.externalId}
                      onSelect={() =>
                        section.kind === "ad_account"
                          ? chooseAdAccount(asset.externalId)
                          : setSelection((s) => ({ ...s, [section.field]: asset.externalId }))
                      }
                    />
                  ))}
                </div>
              ) : hidden ? (
                <span style={{ fontSize: 13, color: MUTED }}>
                  The selected ad account has no dataset yet. You can add one later.
                </span>
              ) : (
                <span style={{ fontSize: 13, color: MUTED }}>
                  No {ASSET_LABELS[section.kind].one.toLowerCase()} was found. Assign one to the
                  system user in Meta Business settings, then refresh.
                </span>
              )}
            </div>
          </section>
        );
      })}
      <div
        className="rp-card"
        style={{
          position: "sticky",
          bottom: 16,
          zIndex: 10,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          boxShadow: "0 16px 34px -18px rgba(25,25,23,.35)",
        }}
      >
        <span style={{ fontSize: 13, color: MUTED, flex: "1 1 220px" }}>
          {missingRequired.length
            ? `Choose a ${missingRequired.map((s) => s.title.toLowerCase()).join(" and a ")} to continue.`
            : "You can change these at any time. Datasets are shown for the selected ad account."}
        </span>
        <button
          type="button"
          className="rp-btn"
          style={{ padding: "10px 16px" }}
          disabled={missingRequired.length > 0 || select.isPending}
          onClick={() =>
            select.mutate(selection, {
              onSuccess: () => {
                toast("Accounts saved");
                router.push(
                  onboarding.data?.isComplete ? "/setup" : "/setup/start?step=business_profile",
                );
              },
              onError: (err) => toast(errorMessage(err)),
            })
          }
        >
          {select.isPending ? <Spinner /> : null}
          Save and continue
        </button>
      </div>
    </div>
  );
}

function RefreshButton() {
  const client = useQueryClient();
  const toast = useToast();
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
      toast("Assets refreshed from Meta");
    } else if (status === "failed") {
      toast(job.data?.error ?? "Refresh failed.");
    }
  }, [status, jobId, client, job.data?.error, toast]);

  return (
    <button
      type="button"
      className="rp-btn-light"
      disabled={running}
      onClick={() =>
        refresh.mutate(undefined, {
          onSuccess: (res) => setJobId(res.jobId),
          onError: (err) => toast(errorMessage(err)),
        })
      }
    >
      {running ? <Spinner dark /> : <RefreshCw size={14} />}
      Refresh from Meta
    </button>
  );
}

function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="rp-card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}
        >
          <Skel h={16} w={160} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: 10,
            }}
          >
            <Skel h={88} r={10} />
            <Skel h={88} r={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChooseAccounts() {
  const connection = useMetaConnection();
  const assets = useMetaAssets();
  const connected = connection.data?.status === "active";

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Link
        href="/setup"
        className="rp-btn-quiet"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
      >
        <ArrowLeft size={14} /> Back to overview
      </Link>
      <PageHead
        title="Choose your accounts"
        sub="Pick the ad account, Page, Instagram account and dataset your campaigns will use."
        actions={connected ? <RefreshButton /> : undefined}
      />
      {connection.isPending || assets.isPending ? (
        <Loading />
      ) : connection.isError || assets.isError ? (
        <Banner
          tone="error"
          title="Couldn’t load your accounts"
          action={
            <button
              type="button"
              className="rp-btn-light"
              onClick={() => {
                void connection.refetch();
                void assets.refetch();
              }}
            >
              Try again
            </button>
          }
        >
          {errorMessage(connection.error ?? assets.error)}
        </Banner>
      ) : !connected ? (
        <div
          className="rp-card"
          style={{
            padding: "32px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <span className="rp-serif" style={{ fontSize: 26 }}>
            Connect Meta first
          </span>
          <span style={{ fontSize: 13, color: MUTED, maxWidth: 420 }}>
            Once your Meta business is connected, your ad accounts, Pages and datasets appear here.
          </span>
          <Link href="/setup/connect-meta" className="rp-btn" style={{ marginTop: 8 }}>
            Connect Meta
          </Link>
        </div>
      ) : (
        <AccountsForm key={assets.data.data.map((a) => a.id).join(",")} assets={assets.data.data} />
      )}
    </div>
  );
}
