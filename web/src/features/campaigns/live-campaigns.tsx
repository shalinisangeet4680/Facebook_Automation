"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAdCampaigns } from "@/lib/api/queries";
import type { CampaignList, CampaignStatusFilter, ReportPreset } from "@/lib/api/types";
import { Banner, Seg, Skel } from "@/features/replyly/ui";

import { DeliveryPill, EmptyCard, StatusSwitch } from "./controls";
import {
  LINE,
  MUTED,
  OBJECTIVE_LABELS,
  PRESETS,
  RESULT_LABELS,
  budgetSource,
  budgetText,
  count,
  money,
} from "./labels";

const FILTERS: { id: CampaignStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "On" },
  { id: "paused", label: "Paused" },
];

export const th: CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 500,
  color: MUTED,
  textAlign: "right",
  whiteSpace: "nowrap",
};
export const td: CSSProperties = { padding: "12px", textAlign: "right", verticalAlign: "top" };
export const sub: CSSProperties = { display: "block", fontSize: 11.5, color: MUTED, marginTop: 2 };

export function NotConnected({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.code === "META_NOT_CONNECTED")
    return (
      <EmptyCard
        title="Connect Meta to manage campaigns"
        text="Your campaigns, budgets and results come straight from your Meta ad account."
        action={
          <Link href="/setup/connect-meta" className="rp-btn">
            Connect Meta
          </Link>
        }
      />
    );
  if (error instanceof ApiError && error.code === "META_ASSETS_MISSING")
    return (
      <EmptyCard
        title="Choose an ad account"
        text={error.message}
        action={
          <Link href="/setup/connect-meta" className="rp-btn">
            Open Meta setup
          </Link>
        }
      />
    );
  return null;
}

function Table({ data }: { data: CampaignList }) {
  const c$ = (v: number) => money(v, data.currency);
  const c2 = (v: number) => money(v, data.currency, 2);
  return (
    <div className="rp-card" style={{ overflow: "hidden", minWidth: 0 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ borderBottom: LINE }}>
              <th scope="col" style={{ ...th, textAlign: "left", paddingLeft: 18, width: 56 }}>
                On/off
              </th>
              <th scope="col" style={{ ...th, textAlign: "left" }}>
                Campaign
              </th>
              <th scope="col" style={th}>
                Budget
              </th>
              <th scope="col" style={th}>
                Spend
              </th>
              <th scope="col" style={th}>
                Results
              </th>
              <th scope="col" style={{ ...th, paddingRight: 18 }}>
                Cost / result
              </th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map((c, i) => (
              <tr key={c.id} style={{ borderTop: i ? LINE : "none" }}>
                <td style={{ ...td, textAlign: "left", paddingLeft: 18 }}>
                  <StatusSwitch
                    level="campaign"
                    id={c.id}
                    name={c.name}
                    status={c.status}
                    canManage={data.canManage}
                  />
                </td>
                <td style={{ ...td, textAlign: "left", minWidth: 220 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Link
                      href={`/campaigns/${c.id}`}
                      style={{ fontWeight: 500, color: "inherit", overflowWrap: "anywhere" }}
                    >
                      {c.name}
                    </Link>
                    <DeliveryPill status={c.effectiveStatus} />
                  </span>
                  <span style={sub}>{OBJECTIVE_LABELS[c.objective] ?? c.objective}</span>
                </td>
                <td className="rp-mono" style={td}>
                  {budgetText(c.budget, data.currency)}
                  <span style={{ ...sub, fontFamily: "var(--rp-sans)" }}>
                    {budgetSource(c.budget)}
                  </span>
                </td>
                <td className="rp-mono" style={td}>
                  {c$(c.metrics.spend)}
                </td>
                <td className="rp-mono" style={td}>
                  {count.format(c.metrics.results)}
                  {c.metrics.resultType ? (
                    <span style={{ ...sub, fontFamily: "var(--rp-sans)" }}>
                      {RESULT_LABELS[c.metrics.resultType] ?? c.metrics.resultType}
                    </span>
                  ) : null}
                </td>
                <td className="rp-mono" style={{ ...td, paddingRight: 18 }}>
                  {c.metrics.costPerResult === null ? "—" : c2(c.metrics.costPerResult)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LiveCampaigns({
  preset,
  status,
  onPreset,
  onStatus,
}: {
  preset: ReportPreset;
  status: CampaignStatusFilter;
  onPreset: (preset: ReportPreset) => void;
  onStatus: (status: CampaignStatusFilter) => void;
}) {
  const campaigns = useAdCampaigns(preset, status);
  const connectionProblem = campaigns.isError ? <NotConnected error={campaigns.error} /> : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {connectionProblem ? null : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ overflowX: "auto", maxWidth: "100%" }}>
            <Seg label="Period" value={preset} onChange={onPreset} small options={PRESETS} />
          </div>
          <Seg label="Status" value={status} onChange={onStatus} small options={FILTERS} />
        </div>
      )}
      {campaigns.isPending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skel h={56} r={14} />
          <Skel h={56} r={14} />
          <Skel h={56} r={14} />
        </div>
      ) : campaigns.isError ? (
        (connectionProblem ?? (
          <Banner
            tone="error"
            title="Couldn’t load campaigns"
            action={
              <button
                type="button"
                className="rp-btn-light"
                onClick={() => void campaigns.refetch()}
              >
                Try again
              </button>
            }
          >
            {errorMessage(campaigns.error)}
          </Banner>
        ))
      ) : !campaigns.data.campaigns.length ? (
        status === "all" ? (
          <EmptyCard
            title="No campaigns yet"
            text="Create your first campaign here, or ask Claude to plan one. It shows up here once it’s in Meta."
            action={
              <Link href="/campaigns/new" className="rp-btn">
                <Plus size={14} /> New campaign
              </Link>
            }
          />
        ) : (
          <EmptyCard
            title={status === "active" ? "Nothing is running" : "No paused campaigns"}
            text="Try another filter to see the rest of your campaigns."
            action={
              <button type="button" className="rp-btn-light" onClick={() => onStatus("all")}>
                Show all campaigns
              </button>
            }
          />
        )
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            opacity: campaigns.isPlaceholderData ? 0.7 : 1,
            transition: "opacity .2s",
          }}
        >
          <Table data={campaigns.data} />
          {campaigns.data.truncated ? (
            <span style={{ fontSize: 12.5, color: MUTED }}>
              Showing the first {campaigns.data.campaigns.length} of {campaigns.data.total}{" "}
              campaigns. Use the filter or Ads Manager to see the rest.
            </span>
          ) : null}
          {!campaigns.data.canManage ? (
            <span style={{ fontSize: 12.5, color: MUTED }}>
              Only workspace owners and admins can pause, resume or change budgets.
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
