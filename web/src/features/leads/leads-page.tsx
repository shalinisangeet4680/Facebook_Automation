"use client";

import { Download, Mail, MapPin, NotebookPen, Phone, Plus, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type CSSProperties } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  downloadLeadsCsv,
  type LeadFilters,
  useLead,
  useLeads,
  useLeadSummary,
  useSyncLeads,
  useUpdateLead,
} from "@/lib/api/queries";
import type { Lead, LeadStatus, LeadSyncState } from "@/lib/api/types";
import { EmptyCard } from "@/features/campaigns/controls";
import { NotConnected } from "@/features/campaigns/live-campaigns";
import { RpDialogClose, RpDialogContent, RpDialogRoot } from "@/features/replyly/dialog";
import { Select } from "@/features/replyly/select";
import { Banner, PageHead, Seg, Skel, Spinner, useToast } from "@/features/replyly/ui";

const MUTED = "#6C6962";

export const LEAD_STATUSES: { value: LeadStatus; label: string; dot: string }[] = [
  { value: "new", label: "New", dot: "#2B4C9A" },
  { value: "contacted", label: "Contacted", dot: "#C08A1A" },
  { value: "won", label: "Won", dot: "#0F6B4A" },
  { value: "lost", label: "Lost", dot: "#A8A49C" },
];

const STATUS_IDS = LEAD_STATUSES.map((s) => s.value);

const when = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function ago(iso: string | null): string {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return when.format(new Date(iso));
}

const line: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
  overflowWrap: "anywhere",
};

export function LeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const statusParam = params.get("status") as LeadStatus | null;
  const filters: LeadFilters = {
    status: statusParam && STATUS_IDS.includes(statusParam) ? statusParam : undefined,
    campaignId: params.get("campaignId") ?? undefined,
    q: params.get("q") ?? undefined,
  };
  const openId = params.get("lead");
  const [search, setSearch] = useState(filters.q ?? "");
  const [exporting, setExporting] = useState(false);

  const summary = useLeadSummary();
  const leads = useLeads(filters);
  const sync = useSyncLeads();

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearch = (value: string) => {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ q: value.trim() || null }), 350);
  };

  const rows = leads.data?.pages.flatMap((p) => p.data) ?? [];
  const filtered = Boolean(filters.status || filters.campaignId || filters.q);
  const campaigns = summary.data?.campaigns ?? [];

  const onSync = () =>
    sync.mutate(undefined, {
      onSuccess: (r) =>
        toast(
          r.status === "ok"
            ? r.created
              ? `${r.created} new lead${r.created === 1 ? "" : "s"}`
              : "No new leads"
            : (r.error ?? "Couldn’t sync leads"),
        ),
      onError: (err) => toast(errorMessage(err)),
    });

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadLeadsCsv(filters);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const connectionProblem = leads.isError ? <NotConnected error={leads.error} /> : null;

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Leads"
        sub={
          <>
            People who filled in your instant forms on Facebook and Instagram.
            {summary.data?.sync.lastSuccessAt ? (
              <> Synced {ago(summary.data.sync.lastSuccessAt)}.</>
            ) : null}
          </>
        }
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="rp-btn-light"
              disabled={sync.isPending}
              onClick={onSync}
            >
              {sync.isPending ? <Spinner dark /> : <RefreshCw size={14} />} Sync now
            </button>
            <button
              type="button"
              className="rp-btn-light"
              disabled={exporting || !rows.length}
              onClick={() => void onExport()}
            >
              {exporting ? <Spinner dark /> : <Download size={14} />} Export CSV
            </button>
          </div>
        }
      />

      {summary.data ? <SyncProblem sync={summary.data.sync} /> : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <Seg
            label="Lead status"
            small
            value={filters.status ?? "all"}
            onChange={(s) => update({ status: s === "all" ? null : s })}
            options={[
              { id: "all", label: "All" },
              ...LEAD_STATUSES.map((s) => ({
                id: s.value,
                label: s.label,
                n: s.value === "new" && summary.data?.new ? summary.data.new : undefined,
              })),
            ]}
          />
        </div>
        {campaigns.length ? (
          <Select
            label="Campaign"
            minWidth={200}
            align="start"
            value={filters.campaignId ?? "all"}
            onChange={(v) => update({ campaignId: v === "all" ? null : v })}
            options={[
              { value: "all", label: "All campaigns" },
              ...campaigns.map((c) => ({ value: c.id, label: c.name ?? c.id })),
              ...(filters.campaignId && !campaigns.some((c) => c.id === filters.campaignId)
                ? [{ value: filters.campaignId, label: "This campaign" }]
                : []),
            ]}
          />
        ) : null}
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 360 }}>
          <Search
            size={14}
            color={MUTED}
            aria-hidden
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            className="rp-input"
            type="search"
            aria-label="Search leads"
            placeholder="Search name, phone, email or notes"
            style={{ width: "100%", boxSizing: "border-box", paddingLeft: 30 }}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      {leads.isPending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skel h={88} r={14} />
          <Skel h={88} r={14} />
          <Skel h={88} r={14} />
        </div>
      ) : leads.isError ? (
        (connectionProblem ?? (
          <Banner
            tone="error"
            title="Couldn’t load leads"
            action={
              <button type="button" className="rp-btn-light" onClick={() => void leads.refetch()}>
                Try again
              </button>
            }
          >
            {errorMessage(leads.error)}
          </Banner>
        ))
      ) : !rows.length ? (
        filtered ? (
          <EmptyCard
            title="No leads match"
            text="Try another status, campaign or search."
            action={
              <button
                type="button"
                className="rp-btn-light"
                onClick={() => {
                  setSearch("");
                  update({ status: null, campaignId: null, q: null });
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyCard
            title="No leads yet"
            text={
              <>
                Run a campaign with the <strong>Get leads on Facebook</strong> goal. People fill a
                short instant form without leaving Facebook or Instagram, and each lead shows up
                here within 15 minutes, with a Slack alert if Slack is connected.
              </>
            }
            action={
              <Link href="/campaigns/new" className="rp-btn">
                <Plus size={14} /> New lead form campaign
              </Link>
            }
          />
        )
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            opacity: leads.isPlaceholderData ? 0.7 : 1,
            transition: "opacity .2s",
          }}
        >
          <ul
            aria-label="Leads"
            style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}
          >
            {rows.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onOpen={() => update({ lead: lead.id })} />
            ))}
          </ul>
          {leads.hasNextPage ? (
            <button
              type="button"
              className="rp-btn-light"
              style={{ alignSelf: "center" }}
              disabled={leads.isFetchingNextPage}
              onClick={() => void leads.fetchNextPage()}
            >
              {leads.isFetchingNextPage ? <Spinner dark /> : null} Show more
            </button>
          ) : null}
        </div>
      )}

      <LeadDialog id={openId} onClose={() => update({ lead: null })} />
    </div>
  );
}

function SyncProblem({ sync }: { sync: LeadSyncState }) {
  if (sync.errorCode === "permission_missing" || (!sync.permissionGranted && sync.forms > 0))
    return (
      <Banner
        tone="error"
        title="TreeVook can’t read your leads yet"
        action={
          <Link href="/setup/connect-meta" className="rp-btn-light">
            Fix Meta connection
          </Link>
        }
      >
        Your Meta connection is missing the leads_retrieval permission. {sync.fixes.join(" ")}
      </Banner>
    );
  if (sync.errorCode === "not_connected" || sync.errorCode === "no_page")
    return (
      <Banner
        tone="warn"
        title="Leads aren’t syncing"
        action={
          <Link href="/setup/connect-meta" className="rp-btn-light">
            Open Meta setup
          </Link>
        }
      >
        {sync.error}
      </Banner>
    );
  if (sync.errorCode === "failed")
    return (
      <Banner tone="warn" title="The last sync didn’t finish">
        {sync.error} We’ll try again in 15 minutes, or select Sync now.
      </Banner>
    );
  return null;
}

function StatusPicker({ lead }: { lead: Lead }) {
  const updateLead = useUpdateLead();
  const toast = useToast();
  return (
    <Select
      label={`Status for ${lead.name ?? "this lead"}`}
      minWidth={140}
      value={lead.status}
      options={LEAD_STATUSES}
      onChange={(status) =>
        updateLead.mutate(
          { id: lead.id, body: { status: status as LeadStatus } },
          { onError: (err) => toast(errorMessage(err)) },
        )
      }
    />
  );
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  return (
    <li
      className="rp-card"
      style={{
        padding: "14px 16px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
        gap: "10px 16px",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
          {lead.name ?? "No name given"}
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>
          <time dateTime={lead.createdTime}>{when.format(new Date(lead.createdTime))}</time>
          {lead.campaign ? ` · ${lead.campaign.name ?? lead.campaign.id}` : ""}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, minWidth: 0 }}>
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} style={{ ...line, color: "#0F6B4A", fontWeight: 500 }}>
            <Phone size={13} aria-hidden /> {lead.phone}
          </a>
        ) : null}
        {lead.email ? (
          <a href={`mailto:${lead.email}`} style={{ ...line, color: "inherit" }}>
            <Mail size={13} color={MUTED} aria-hidden /> {lead.email}
          </a>
        ) : null}
        {lead.city ? (
          <span style={line}>
            <MapPin size={13} color={MUTED} aria-hidden /> {lead.city}
          </span>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <StatusPicker lead={lead} />
        <button
          type="button"
          className="rp-btn-light"
          aria-label={`Notes and details for ${lead.name ?? "this lead"}`}
          onClick={onOpen}
          style={{ padding: "7px 10px" }}
        >
          <NotebookPen size={14} /> {lead.notes ? "Notes" : "Details"}
        </button>
      </div>
    </li>
  );
}

function LeadDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const lead = useLead(id);
  return (
    <RpDialogRoot open={Boolean(id)} onOpenChange={(open) => (open ? undefined : onClose())}>
      {id ? (
        <RpDialogContent
          width={520}
          title={lead.data?.name ?? (lead.isPending ? "Lead" : "Lead details")}
          description={
            lead.data
              ? `${when.format(new Date(lead.data.createdTime))}${
                  lead.data.form.name ? ` · ${lead.data.form.name}` : ""
                }`
              : undefined
          }
        >
          {lead.isPending ? (
            <Skel h={160} r={10} />
          ) : lead.isError ? (
            <Banner tone="error">{errorMessage(lead.error)}</Banner>
          ) : (
            <LeadDetails
              key={`${lead.data.id}:${lead.data.notes ?? ""}`}
              lead={lead.data}
              onClose={onClose}
            />
          )}
        </RpDialogContent>
      ) : null}
    </RpDialogRoot>
  );
}

function LeadDetails({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const toast = useToast();
  const updateLead = useUpdateLead();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const rows: [string, string | null][] = [
    ["Phone", lead.phone],
    ["Email", lead.email],
    ["City", lead.city],
    ...lead.answers.map((a): [string, string] => [a.label, a.value]),
    ["Campaign", lead.campaign ? (lead.campaign.name ?? lead.campaign.id) : null],
    ["Ad set", lead.adSet ? (lead.adSet.name ?? lead.adSet.id) : null],
    ["Ad", lead.ad ? (lead.ad.name ?? lead.ad.id) : null],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <dl
        style={{
          margin: 0,
          display: "flex",
          flexDirection: "column",
          borderRadius: 10,
          border: "1px solid #EFEDE8",
          fontSize: 13,
        }}
      >
        {rows
          .filter(([, v]) => v)
          .map(([k, v], i) => (
            <div
              key={`${k}${i}`}
              style={{
                display: "flex",
                gap: 12,
                padding: "10px 12px",
                borderTop: i ? "1px solid #EFEDE8" : "none",
              }}
            >
              <dt style={{ color: MUTED, width: 110, flexShrink: 0 }}>{k}</dt>
              <dd style={{ margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>
                {k === "Phone" ? (
                  <a href={`tel:${v}`} style={{ color: "#0F6B4A", fontWeight: 500 }}>
                    {v}
                  </a>
                ) : k === "Email" ? (
                  <a href={`mailto:${v}`} style={{ color: "inherit" }}>
                    {v}
                  </a>
                ) : (
                  v
                )}
              </dd>
            </div>
          ))}
      </dl>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="rp-label">Status</span>
        <StatusPicker lead={lead} />
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="rp-label">Notes</span>
        <textarea
          className="rp-input rp-textarea"
          rows={4}
          maxLength={2000}
          placeholder="Called on Monday, wants a demo next week…"
          style={{ width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <RpDialogClose className="rp-btn-light">Close</RpDialogClose>
        <button
          type="button"
          className="rp-btn"
          disabled={updateLead.isPending || notes === (lead.notes ?? "")}
          onClick={() =>
            updateLead.mutate(
              { id: lead.id, body: { notes: notes.trim() || null } },
              {
                onSuccess: () => {
                  toast("Notes saved");
                  onClose();
                },
                onError: (err) => toast(errorMessage(err)),
              },
            )
          }
        >
          {updateLead.isPending ? <Spinner /> : null} Save notes
        </button>
      </div>
    </div>
  );
}
