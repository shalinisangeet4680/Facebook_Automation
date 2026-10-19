"use client";

import { ExternalLink, ImageIcon, Pencil, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";

import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAdCampaign } from "@/lib/api/queries";
import type {
  AdMetrics,
  AdRow,
  CampaignDetail,
  ReportPreset,
  VariantComparison,
} from "@/lib/api/types";
import { CTA_LABELS } from "@/features/plans/labels";
import { PlayBadge, displaySrc } from "@/features/plans/creative-picker";
import { Banner, Seg, Section, Skel } from "@/features/replyly/ui";

import { BudgetDialog, DeliveryPill, EmptyCard, StatusSwitch } from "./controls";
import { EditAdDialog } from "./edit-ad-dialog";
import {
  LINE,
  MUTED,
  OBJECTIVE_LABELS,
  PRESETS,
  RESULT_LABELS,
  budgetSource,
  budgetText,
  count,
  linkHost,
  money,
} from "./labels";
import { NotConnected, sub, td, th } from "./live-campaigns";

const ID = /^\d{5,30}$/;

const tileGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

function Tile({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div
      className="rp-card"
      style={{
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 12.5, color: MUTED }}>{label}</span>
      <span
        className="rp-serif"
        style={{
          fontSize: 28,
          lineHeight: 1.1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      {note ? <span style={{ fontSize: 12, color: MUTED }}>{note}</span> : null}
    </div>
  );
}

function resultLabel(m: AdMetrics) {
  return m.resultType ? (RESULT_LABELS[m.resultType] ?? m.resultType) : "Results";
}

function BudgetEditor({
  data,
  level,
  id,
  name,
  current,
}: {
  data: CampaignDetail;
  level: "campaign" | "adset";
  id: string;
  name: string;
  current: number | null;
}) {
  const [open, setOpen] = useState(false);
  if (!data.canManage) return null;
  return (
    <>
      <button
        type="button"
        className="rp-btn-light"
        style={{ padding: "4px 10px", fontSize: 12.5 }}
        onClick={() => setOpen(true)}
        aria-label={`Edit budget of ${name}`}
      >
        <Pencil size={12} aria-hidden /> Edit budget
      </button>
      {open ? (
        <BudgetDialog
          open
          onOpenChange={setOpen}
          level={level}
          id={id}
          name={name}
          current={current}
          currency={data.currency}
          maxDailyBudget={data.guardrails.maxDailyBudget}
          monthlyBudget={data.guardrails.monthlyBudget}
        />
      ) : null}
    </>
  );
}

function Header({
  data,
  preset,
  onPreset,
}: {
  data: CampaignDetail;
  preset: ReportPreset;
  onPreset: (preset: ReportPreset) => void;
}) {
  const c = data.campaign;
  const m = c.metrics;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 0,
            flex: "1 1 320px",
          }}
        >
          <h1
            className="rp-serif"
            style={{ fontSize: 34, lineHeight: 1.05, overflowWrap: "anywhere" }}
          >
            {c.name}
          </h1>
          <span
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              fontSize: 13,
              color: MUTED,
            }}
          >
            <DeliveryPill status={c.effectiveStatus} />
            <span>{OBJECTIVE_LABELS[c.objective] ?? c.objective}</span>
            <span aria-hidden>·</span>
            <span>
              {c.adSetCount} ad set{c.adSetCount === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>
              {data.adAccount.name} ({data.currency})
            </span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <StatusSwitch
              level="campaign"
              id={c.id}
              name={c.name}
              status={c.status}
              canManage={data.canManage}
            />
            {c.status === "ACTIVE" ? "On" : "Off"}
          </span>
          <a href={c.adsManagerUrl} target="_blank" rel="noreferrer" className="rp-btn-light">
            Open in Ads Manager <ExternalLink size={13} aria-hidden />
          </a>
        </div>
      </div>

      <div
        className="rp-card"
        style={{
          padding: "14px 16px",
          display: "flex",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 12.5, color: MUTED }}>Budget</span>
          <span style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="rp-mono" style={{ fontSize: 15 }}>
              {c.budget.level === "adset" && c.budget.amount !== null
                ? `${budgetText(c.budget, data.currency)} across ad sets`
                : budgetText(c.budget, data.currency)}
            </span>
            {c.budgetEditable ? (
              <BudgetEditor
                data={data}
                level="campaign"
                id={c.id}
                name={c.name}
                current={c.budget.amount}
              />
            ) : null}
          </span>
          <span style={{ fontSize: 12, color: MUTED }}>
            {c.budget.level === "campaign"
              ? c.budget.type === "lifetime"
                ? "Lifetime campaign budget. Change it in Ads Manager."
                : "Campaign budget, shared across its ad sets"
              : c.budget.level === "adset"
                ? "Each ad set has its own budget. Change them below."
                : budgetSource(c.budget)}
          </span>
        </div>
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <Seg label="Period" value={preset} onChange={onPreset} small options={PRESETS} />
        </div>
      </div>

      <div style={tileGrid}>
        <Tile label="Spend" value={money(m.spend, data.currency)} />
        <Tile label={resultLabel(m)} value={count.format(m.results)} />
        <Tile
          label="Cost per result"
          value={m.costPerResult === null ? "—" : money(m.costPerResult, data.currency, 2)}
        />
        <Tile
          label="Link CTR"
          value={m.ctr === null ? "—" : `${m.ctr.toFixed(2)}%`}
          note={`${count.format(m.impressions)} impressions`}
        />
      </div>
    </div>
  );
}

function AdSets({ data }: { data: CampaignDetail }) {
  if (!data.adSets.length)
    return <EmptyCard title="No ad sets" text="This campaign doesn’t have any ad sets yet." />;
  const c2 = (v: number) => money(v, data.currency, 2);
  return (
    <div className="rp-card" style={{ overflow: "hidden", minWidth: 0 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ borderBottom: LINE }}>
              <th scope="col" style={{ ...th, textAlign: "left", paddingLeft: 18, width: 56 }}>
                On/off
              </th>
              <th scope="col" style={{ ...th, textAlign: "left" }}>
                Ad set
              </th>
              <th scope="col" style={th}>
                Budget
              </th>
              <th scope="col" style={{ ...th, textAlign: "left" }}>
                Audience
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
            {data.adSets.map((s, i) => {
              const t = s.targeting;
              const who = [t.age, t.gender ?? "All genders"].filter(Boolean).join(" · ");
              return (
                <tr key={s.id} style={{ borderTop: i ? LINE : "none" }}>
                  <td style={{ ...td, textAlign: "left", paddingLeft: 18 }}>
                    <StatusSwitch
                      level="adset"
                      id={s.id}
                      name={s.name}
                      status={s.status}
                      canManage={data.canManage}
                    />
                  </td>
                  <td style={{ ...td, textAlign: "left", minWidth: 180 }}>
                    <span style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{s.name}</span>
                    <span style={{ ...sub, marginTop: 4 }}>
                      <DeliveryPill status={s.effectiveStatus} />
                    </span>
                  </td>
                  <td style={td}>
                    <span className="rp-mono">
                      {s.budget.level === "campaign"
                        ? "Shared"
                        : budgetText(s.budget, data.currency)}
                    </span>
                    <span style={sub}>
                      {s.budget.level === "campaign" ? "Uses the campaign budget" : null}
                    </span>
                    {s.budgetEditable ? (
                      <span style={{ display: "inline-block", marginTop: 6 }}>
                        <BudgetEditor
                          data={data}
                          level="adset"
                          id={s.id}
                          name={s.name}
                          current={s.budget.amount}
                        />
                      </span>
                    ) : null}
                  </td>
                  <td style={{ ...td, textAlign: "left", minWidth: 180, fontSize: 12.5 }}>
                    <span>{t.locations ?? "Any location"}</span>
                    <span style={sub}>{who}</span>
                    {t.audience ? <span style={sub}>{t.audience}</span> : null}
                  </td>
                  <td className="rp-mono" style={td}>
                    {money(s.metrics.spend, data.currency)}
                  </td>
                  <td className="rp-mono" style={td}>
                    {count.format(s.metrics.results)}
                  </td>
                  <td className="rp-mono" style={{ ...td, paddingRight: 18 }}>
                    {s.metrics.costPerResult === null ? "—" : c2(s.metrics.costPerResult)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const BASIS: Record<string, string> = {
  cost_per_result: "Lowest cost per result",
  ctr: "Most clicks so far",
};

function AdCard({
  ad,
  data,
  winner,
}: {
  ad: AdRow;
  data: CampaignDetail;
  winner?: VariantComparison | null;
}) {
  const [editing, setEditing] = useState(false);
  const c = ad.creative;
  const image = displaySrc(c.thumbnailUrl ?? c.imageUrl);
  const m = ad.metrics;
  const video = c.kind === "video";
  return (
    <li
      className="rp-card"
      style={{
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        ...(winner ? { borderColor: "#0F6B4A", boxShadow: "0 0 0 1px #0F6B4A" } : {}),
      }}
    >
      <span
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          aspectRatio: "1.91 / 1",
          background: "#F4F2EE",
          color: MUTED,
        }}
      >
        {winner ? (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 999,
              background: "#0F6B4A",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Trophy size={12} aria-hidden /> Winner so far
          </span>
        ) : null}
        {image ? (
          <Image
            unoptimized
            fill
            src={image}
            alt=""
            sizes="(max-width: 640px) 100vw, 360px"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <ImageIcon size={22} aria-hidden />
        )}
        {video ? <PlayBadge size={44} /> : null}
      </span>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{ad.name}</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <DeliveryPill status={ad.effectiveStatus} />
              {video ? <span style={{ fontSize: 12, color: MUTED }}>Video</span> : null}
            </span>
            {winner?.basis ? (
              <span style={{ fontSize: 12, color: "#0F6B4A" }}>{BASIS[winner.basis]}</span>
            ) : null}
          </div>
          <StatusSwitch
            level="ad"
            id={ad.id}
            name={ad.name}
            status={ad.status}
            canManage={data.canManage}
          />
        </div>
        {c.primaryText ? (
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {c.primaryText}
          </p>
        ) : null}
        {c.headline ? <span style={{ fontWeight: 500, fontSize: 13.5 }}>{c.headline}</span> : null}
        <span
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            fontSize: 12,
            color: MUTED,
          }}
        >
          {c.callToAction ? (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 6,
                background: "#F4F2EE",
                color: "#191917",
              }}
            >
              {CTA_LABELS[c.callToAction] ?? c.callToAction}
            </span>
          ) : null}
          {c.link ? <span style={{ overflowWrap: "anywhere" }}>{linkHost(c.link)}</span> : null}
        </span>
        <span className="rp-mono" style={{ fontSize: 12.5, color: MUTED, marginTop: "auto" }}>
          {money(m.spend, data.currency)} spent · {count.format(m.results)}{" "}
          {resultLabel(m).toLowerCase()} ·{" "}
          {m.costPerResult === null ? "—" : money(m.costPerResult, data.currency, 2)} each
        </span>
        {c.kind === "post" ? (
          <span style={{ fontSize: 12.5, color: MUTED }}>
            Created from a post; edit it on Facebook/Instagram.
          </span>
        ) : c.kind === "other" || !c.editable ? (
          <span style={{ fontSize: 12.5, color: MUTED }}>
            This ad format can be edited in Ads Manager.
          </span>
        ) : data.canManage ? (
          <button
            type="button"
            className="rp-btn-light"
            style={{ alignSelf: "flex-start" }}
            onClick={() => setEditing(true)}
            aria-label={`Edit ad ${ad.name}`}
          >
            <Pencil size={13} aria-hidden /> Edit ad
          </button>
        ) : null}
      </div>
      {editing ? <EditAdDialog ad={ad} open onOpenChange={setEditing} /> : null}
    </li>
  );
}

function Ads({ data }: { data: CampaignDetail }) {
  if (!data.ads.length)
    return <EmptyCard title="No ads" text="This campaign doesn’t have any ads yet." />;
  const names = new Map(data.adSets.map((s) => [s.id, s.name]));
  const groups = data.adSets
    .map((s) => ({
      id: s.id,
      ads: data.ads.filter((a) => a.adSetId === s.id),
      comparison: data.comparisons.find((c) => c.adSetId === s.id) ?? null,
    }))
    .filter((g) => g.ads.length);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {groups.map((g) => (
        <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groups.length > 1 ? (
            <span style={{ fontSize: 12.5, color: MUTED }}>In {names.get(g.id)}</span>
          ) : null}
          {g.comparison ? (
            <div
              role="status"
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "10px 12px",
                borderRadius: 10,
                background: g.comparison.winnerId ? "#F1F5F2" : "#FAF9F7",
                border: "1px solid #EFEDE8",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <Trophy
                size={14}
                color={g.comparison.winnerId ? "#0F6B4A" : MUTED}
                style={{ marginTop: 3, flexShrink: 0 }}
                aria-hidden
              />
              <span>
                <span style={{ fontWeight: 600 }}>
                  Comparing {g.ads.length} versions side by side.
                </span>{" "}
                {g.comparison.winnerId
                  ? `“${g.ads.find((a) => a.id === g.comparison!.winnerId)?.name ?? "One version"}” is winning so far.`
                  : null}{" "}
                {g.comparison.note ? (
                  <span style={{ color: MUTED }}>{g.comparison.note}</span>
                ) : null}
              </span>
            </div>
          ) : null}
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
              gap: 14,
            }}
          >
            {g.ads.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                data={data}
                winner={g.comparison?.winnerId === ad.id ? g.comparison : null}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Body({ id }: { id: string }) {
  const [preset, setPreset] = useState<ReportPreset>("last_7d");
  const campaign = useAdCampaign(id, preset);

  if (campaign.isPending)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Skel h={40} w="60%" />
        <Skel h={72} r={14} />
        <Skel h={180} r={14} />
      </div>
    );
  if (campaign.isError) {
    const problem = <NotConnected error={campaign.error} />;
    if (campaign.error instanceof ApiError && campaign.error.status === 404)
      return (
        <EmptyCard
          title="Campaign not found"
          text="It isn’t in your selected ad account, or it was deleted."
          action={
            <Link href="/campaigns" className="rp-btn-light">
              Back to campaigns
            </Link>
          }
        />
      );
    return (
      problem ?? (
        <Banner
          tone="error"
          title="Couldn’t load this campaign"
          action={
            <button type="button" className="rp-btn-light" onClick={() => void campaign.refetch()}>
              Try again
            </button>
          }
        >
          {errorMessage(campaign.error)}
        </Banner>
      )
    );
  }

  const data = campaign.data;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
        opacity: campaign.isPlaceholderData ? 0.7 : 1,
        transition: "opacity .2s",
      }}
    >
      <Header data={data} preset={preset} onPreset={setPreset} />
      {!data.canManage ? (
        <Banner tone="info">
          Only workspace owners and admins can pause, resume, change budgets or edit ads.
        </Banner>
      ) : null}
      <Section title="Ad sets" desc="Who sees the ads, and how much each ad set can spend.">
        <AdSets data={data} />
      </Section>
      <Section
        title="Ads"
        desc="What people see. Ads in the same ad set are compared side by side. Edits create a new version that Meta reviews again."
      >
        <Ads data={data} />
      </Section>
    </div>
  );
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Link href="/campaigns" className="rp-btn-quiet" style={{ alignSelf: "flex-start" }}>
        ← Campaigns
      </Link>
      {ID.test(id) ? (
        <Body id={id} />
      ) : (
        <EmptyCard
          title="Campaign not found"
          text="This link doesn’t point to a Meta campaign."
          action={
            <Link href="/campaigns" className="rp-btn-light">
              Back to campaigns
            </Link>
          }
        />
      )}
    </div>
  );
}
