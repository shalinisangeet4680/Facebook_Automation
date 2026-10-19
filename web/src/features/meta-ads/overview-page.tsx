"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { errorMessage } from "@/lib/api/errors";
import {
  useInbox,
  useLeadSummary,
  useOnboarding,
  useRefreshInbox,
  useReport,
  useSuggestionAction,
} from "@/lib/api/queries";
import type { Suggestion } from "@/lib/api/types";
import { Banner, PageHead, Section, Skel, Spinner, useToast } from "@/features/replyly/ui";

import { useMetaConnected } from "./shell";
import { TrackingCard } from "./tracking";

const SEVERITY = {
  critical: { label: "Urgent", bg: "#FDF0EE", fg: "#B42318" },
  warning: { label: "Needs attention", bg: "#FBF3E2", fg: "#8A5A00" },
  opportunity: { label: "Opportunity", bg: "#EAF3EE", fg: "#0F6B4A" },
};

const EVIDENCE_LABELS: Record<string, string> = {
  spend: "Spend",
  results: "Results",
  target: "Target cost",
  costPerResult: "Cost per result",
  reference: "Benchmark",
  frequency: "Frequency",
  ctr: "CTR %",
  previousCtr: "Last week CTR %",
  linkClicks: "Link clicks",
  landingPageViews: "Page views",
  spendShare: "Budget used",
  eventsLast24h: "Events in 24h",
  monthSpend: "Spent this month",
  projected: "Projected",
  monthlyBudget: "Monthly budget",
};

const MONEY_KEYS = new Set([
  "spend",
  "target",
  "costPerResult",
  "reference",
  "monthSpend",
  "projected",
  "monthlyBudget",
]);

const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

function moneyFormat(currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

function formatEvidence(key: string, value: unknown, money: Intl.NumberFormat) {
  const n = Number(value);
  if (key === "spendShare") return `${Math.round(n * 100)}%`;
  if (MONEY_KEYS.has(key) && Number.isFinite(n)) return money.format(n);
  return String(value);
}

function actionLabel(action: Suggestion["action"], money: Intl.NumberFormat) {
  if (action.type === "pause") return "Pause ad";
  if (action.type === "set_daily_budget") return `Set budget to ${money.format(Number(action.to))}`;
  return null;
}

function SetupCard() {
  const onboarding = useOnboarding();
  if (onboarding.isPending) return <Skel h={180} r={14} />;
  if (!onboarding.data || onboarding.data.isComplete) return null;
  const { steps, completedCount, totalCount, currentStep } = onboarding.data;
  return (
    <section className="rp-card" aria-labelledby="setup-title" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid #EFEDE8",
        }}
      >
        <span id="setup-title" style={{ fontWeight: 600 }}>
          Get set up
        </span>
        <span className="rp-mono" style={{ fontSize: 12, color: "#6C6962" }}>
          {completedCount}/{totalCount}
        </span>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((s, i) => {
          const done = s.status === "completed";
          const next = s.id === currentStep;
          return (
            <li
              key={s.id}
              aria-current={next ? "step" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 20px",
                borderTop: i ? "1px solid #EFEDE8" : "none",
                background: next ? "#FAF9F7" : undefined,
                flexWrap: "wrap",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontFamily: "var(--rp-mono)",
                  background: done ? "#0F6B4A" : next ? "#191917" : "#EFEDE8",
                  color: done || next ? "#fff" : "#6C6962",
                }}
              >
                {done ? <Check size={14} strokeWidth={3} /> : s.order}
              </span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  flex: "1 1 200px",
                  minWidth: 0,
                }}
              >
                <span style={{ fontWeight: 500, color: done ? "#6C6962" : "#191917" }}>
                  {s.title}
                  {s.skipped ? (
                    <span style={{ fontWeight: 400, fontSize: 12, color: "#8A5A00" }}>
                      {" "}
                      · skipped
                    </span>
                  ) : null}
                </span>
                <span style={{ fontSize: 12.5, color: "#6C6962" }}>{s.description}</span>
              </span>
              {next ? (
                <Link href={`/setup/start?step=${s.id}`} className="rp-btn">
                  {completedCount === 0 ? "Start" : "Continue"} <ArrowRight size={14} />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Snapshot() {
  const report = useReport("last_7d");
  const leads = useLeadSummary();
  if (report.isPending) return <Skel h={92} r={14} />;
  if (!report.data) return null;
  const { kpis, currency, targetCostPerResult } = report.data;
  const money = moneyFormat(currency);
  const tiles: [string, string, string?][] = [
    ["Spend", money.format(kpis.spend)],
    ["Results", String(kpis.results)],
    [
      "Cost per result",
      kpis.costPerResult === null ? "—" : money.format(kpis.costPerResult),
      targetCostPerResult ? `Target ${money.format(targetCostPerResult)}` : undefined,
    ],
    ["Link CTR", kpis.ctr === null ? "—" : `${kpis.ctr.toFixed(2)}%`],
  ];
  const lead = leads.data;
  if (lead && (lead.total > 0 || lead.sync.forms > 0))
    tiles.push([
      "New leads today",
      String(lead.today),
      lead.new ? `${lead.new} not contacted yet` : undefined,
    ]);
  return (
    <Section
      title="Last 7 days"
      action={
        <span style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/campaigns" className="rp-btn-quiet">
            Manage campaigns →
          </Link>
          {lead && lead.total > 0 ? (
            <Link href="/leads" className="rp-btn-quiet">
              View leads →
            </Link>
          ) : null}
          <Link href="/reports" className="rp-btn-quiet">
            Open reports →
          </Link>
        </span>
      }
    >
      <div
        className="rp-card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        {tiles.map(([label, value, hint], i) => (
          <div
            key={label}
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              borderLeft: i ? "1px solid #EFEDE8" : "none",
            }}
          >
            <span style={{ fontSize: 12.5, color: "#6C6962" }}>{label}</span>
            <span className="rp-serif" style={{ fontSize: 28, lineHeight: 1.1 }}>
              {value}
            </span>
            {hint ? <span style={{ fontSize: 11.5, color: "#8A5A00" }}>{hint}</span> : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const act = useSuggestionAction();
  const toast = useToast();
  const severity = SEVERITY[suggestion.severity];
  const currency =
    typeof suggestion.evidence.currency === "string" ? suggestion.evidence.currency : "INR";
  const money = moneyFormat(currency);
  const label = actionLabel(suggestion.action, money);
  const evidence = Object.entries(suggestion.evidence).filter(
    ([k, v]) => k !== "currency" && v !== null && v !== undefined,
  );
  const run = (action: "apply" | "dismiss" | "snooze", done: string) =>
    act.mutate(
      { id: suggestion.id, action },
      { onSuccess: () => toast(done), onError: (err) => toast(errorMessage(err)) },
    );
  return (
    <div
      className="rp-card"
      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 500,
            background: severity.bg,
            color: severity.fg,
          }}
        >
          {severity.label}
        </span>
        <span style={{ fontSize: 12.5, color: "#6C6962" }}>{suggestion.entityName}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3 style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>{suggestion.title}</h3>
        <span style={{ fontSize: 13, color: "#55534E", lineHeight: 1.5 }}>{suggestion.body}</span>
      </div>
      {evidence.length ? (
        <dl style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", margin: 0 }}>
          {evidence.map(([key, value]) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <dt style={{ fontSize: 11.5, color: "#6C6962" }}>{EVIDENCE_LABELS[key] ?? key}</dt>
              <dd className="rp-mono" style={{ margin: 0, fontSize: 13.5 }}>
                {formatEvidence(key, value, money)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        {label ? (
          <button
            type="button"
            className="rp-btn"
            disabled={act.isPending}
            onClick={() => run("apply", "Done")}
          >
            {act.isPending && act.variables?.action === "apply" ? <Spinner /> : null}
            {label}
          </button>
        ) : null}
        <button
          type="button"
          className="rp-btn-light"
          disabled={act.isPending}
          onClick={() => run("snooze", "Snoozed for 7 days")}
        >
          Snooze 7 days
        </button>
        <button
          type="button"
          className="rp-btn-light"
          disabled={act.isPending}
          onClick={() => run("dismiss", "Dismissed")}
        >
          {label ? "Dismiss" : "Done"}
        </button>
      </div>
    </div>
  );
}

function Inbox() {
  const inbox = useInbox();
  if (inbox.isPending)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skel h={120} r={14} />
        <Skel h={120} r={14} />
      </div>
    );
  if (inbox.isError)
    return (
      <Banner
        tone="error"
        title="Couldn’t load suggestions"
        action={
          <button type="button" className="rp-btn-light" onClick={() => void inbox.refetch()}>
            Try again
          </button>
        }
      >
        {errorMessage(inbox.error)}
      </Banner>
    );
  const { plansToReview, failedPosts, suggestions } = inbox.data;
  return (
    <>
      {plansToReview.length || failedPosts.length ? (
        <Section title="Waiting for you">
          <div className="rp-card" style={{ overflow: "hidden" }}>
            {plansToReview.map((p, i) => (
              <Link
                key={p.id}
                href={`/campaigns/plans/${p.id}`}
                className="rp-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 18px",
                  color: "inherit",
                  borderTop: i ? "1px solid #EFEDE8" : "none",
                }}
              >
                <span
                  style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}
                >
                  <span style={{ fontWeight: 500 }}>Review plan: {p.name}</span>
                  <span style={{ fontSize: 12.5, color: "#6C6962" }}>
                    {p.source.startsWith("mcp:") ? `From ${p.source.slice(4)}` : "From TreeVook"} ·{" "}
                    {date.format(new Date(p.createdAt))}
                  </span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Review →</span>
              </Link>
            ))}
            {failedPosts.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  padding: "14px 18px",
                  borderTop: i || plansToReview.length ? "1px solid #EFEDE8" : "none",
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  Post {p.status === "failed" ? "failed" : "partly failed"}: {p.caption}
                </span>
                <span style={{ fontSize: 12.5, color: "#B42318" }}>
                  {p.instagramError ?? p.facebookError}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
      <Section
        title="Suggestions"
        desc="Your last 7 days compared with the 7 before. Checked every morning at 7:30."
      >
        {suggestions.length ? (
          suggestions.map((s) => <SuggestionCard key={s.id} suggestion={s} />)
        ) : (
          <div
            className="rp-card"
            style={{
              padding: "28px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <span className="rp-serif" style={{ fontSize: 24 }}>
              All clear
            </span>
            <span style={{ fontSize: 13, color: "#6C6962", maxWidth: 420 }}>
              Nothing needs changing right now. Set a target cost per result in{" "}
              <Link href="/settings" style={{ textDecoration: "underline" }}>
                Settings
              </Link>{" "}
              for sharper suggestions.
            </span>
          </div>
        )}
      </Section>
    </>
  );
}

export function OverviewPage() {
  const { connected, loading } = useMetaConnected();
  const refresh = useRefreshInbox();
  const toast = useToast();
  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHead
        title="Overview"
        sub="Your ads at a glance and what needs you today. Nothing spends until you approve."
        actions={
          connected ? (
            <button
              type="button"
              className="rp-btn-light"
              disabled={refresh.isPending}
              onClick={() =>
                refresh.mutate(undefined, {
                  onSuccess: (r) =>
                    toast(
                      r.created
                        ? `${r.created} new suggestion${r.created === 1 ? "" : "s"}`
                        : "Checked. Nothing new.",
                    ),
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              {refresh.isPending ? <Spinner /> : null}
              Check now
            </button>
          ) : null
        }
      />
      <SetupCard />
      {loading ? null : connected ? (
        <>
          <Snapshot />
          <TrackingCard />
          <Inbox />
        </>
      ) : null}
    </div>
  );
}
