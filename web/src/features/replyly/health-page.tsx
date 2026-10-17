"use client";

import Link from "next/link";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  useAppHealth,
  useErrorIssue,
  useErrorIssues,
  useExplainCrash,
  type AppHealth,
  type ErrorIssue,
  type HealthDays,
} from "@/lib/api/play-releases";

import { RateChart } from "./rate-chart";
import { AppPicker, LoadError, NoApps, pct, useSelectedApp } from "./releases-common";
import { rowBorder } from "./tokens";
import { Banner, PageHead, Section, Seg, Skel, Spinner, useToast } from "./ui";

const OVER = "#B42318";

export function HealthPage() {
  const { app, apps, choose } = useSelectedApp();
  const [days, setDays] = useState<HealthDays>(28);
  const health = useAppHealth(app?.id ?? null, days);

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHead
        title="Health"
        sub="Crash and ANR rates from Android vitals, against Google's bad-behaviour thresholds."
        actions={
          <>
            <Seg
              label="Period"
              small
              mono
              value={String(days)}
              onChange={(v) => setDays(Number(v) as HealthDays)}
              options={[
                { id: "7", label: "7d" },
                { id: "14", label: "14d" },
                { id: "28", label: "28d" },
              ]}
            />
            <AppPicker value={app?.id ?? null} onChange={choose} />
          </>
        }
      />
      {!apps.length ? (
        <NoApps />
      ) : health.error ? (
        <LoadError error={health.error} />
      ) : !health.data || !app ? (
        <div style={{ display: "grid", gap: 12 }}>
          <Skel h={240} r={14} />
          <Skel h={180} r={14} />
        </div>
      ) : (
        <>
          <Vitals data={health.data} />
          <Clusters appId={app.id} />
        </>
      )}
    </div>
  );
}

function Vitals({ data }: { data: AppHealth }) {
  const over = data.versions.filter((v) => v.overCrash || v.overAnr);
  return (
    <>
      {data.rollouts.length ? (
        <Banner
          tone={data.rollouts.some((r) => r.status === "halted") ? "warn" : "info"}
          title="Staged rollouts"
          action={
            <Link href={`/reviews/releases?app=${data.app.id}`} className="rp-btn-light">
              Open releases
            </Link>
          }
        >
          {data.rollouts
            .map(
              (r) =>
                `${r.name ?? r.versionCodes.join(", ")} on ${r.label}: ${r.rolloutPercent}%${r.status === "halted" ? " (halted)" : ""}`,
            )
            .join(" · ")}
          {data.guardian.enabled ? " · guardian on" : " · guardian off"}
        </Banner>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          gap: 16,
        }}
      >
        <div className="rp-card" style={{ padding: 18, minWidth: 0 }}>
          <RateChart
            title="User-perceived crash rate"
            series={data.crash}
            threshold={data.thresholds.crash}
          />
        </div>
        <div className="rp-card" style={{ padding: 18, minWidth: 0 }}>
          <RateChart
            title="User-perceived ANR rate"
            series={data.anr}
            threshold={data.thresholds.anr}
          />
        </div>
      </div>
      <Section
        title="By version"
        desc={
          over.length
            ? `${over.length} version${over.length === 1 ? " is" : "s are"} over your limits.`
            : "Every version is within your limits."
        }
      >
        <div className="rp-card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6C6962", fontSize: 12 }}>
                <th style={{ padding: "10px 16px", fontWeight: 500 }}>Version</th>
                <th style={{ padding: "10px 16px", fontWeight: 500, textAlign: "right" }}>Users</th>
                <th style={{ padding: "10px 16px", fontWeight: 500, textAlign: "right" }}>
                  Crashes
                </th>
                <th style={{ padding: "10px 16px", fontWeight: 500, textAlign: "right" }}>ANRs</th>
              </tr>
            </thead>
            <tbody className="rp-mono">
              {data.versions.map((v) => (
                <tr key={v.versionCode} style={{ borderTop: "1px solid #EFEDE8" }}>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontFamily: "var(--rp-sans)", fontWeight: 500 }}>
                      {v.name ?? v.versionCode}
                    </span>{" "}
                    <span style={{ color: "#6C6962", fontSize: 11.5 }}>{v.versionCode}</span>
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    {v.users.toLocaleString()}
                  </td>
                  <td
                    style={{
                      padding: "10px 16px",
                      textAlign: "right",
                      color: v.overCrash ? OVER : undefined,
                      fontWeight: v.overCrash ? 600 : undefined,
                    }}
                  >
                    {pct(v.crashRate)}
                    {v.overCrash ? " ▲" : ""}
                  </td>
                  <td
                    style={{
                      padding: "10px 16px",
                      textAlign: "right",
                      color: v.overAnr ? OVER : undefined,
                      fontWeight: v.overAnr ? 600 : undefined,
                    }}
                  >
                    {pct(v.anrRate)}
                    {v.overAnr ? " ▲" : ""}
                  </td>
                </tr>
              ))}
              {!data.versions.length ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: 16, color: "#6C6962", fontFamily: "var(--rp-sans)" }}
                  >
                    Google has no vitals for this period yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function Clusters({ appId }: { appId: string }) {
  const [type, setType] = useState<"all" | "CRASH" | "ANR">("all");
  const [open, setOpen] = useState<string | null>(null);
  const issues = useErrorIssues(appId, type === "all" ? null : type);
  const list = issues.data?.data ?? [];
  return (
    <Section
      title="Top crash clusters"
      desc="Grouped by Google Play over the last 30 days. Open one for stack traces and an AI explanation."
      action={
        <Seg
          label="Cluster type"
          small
          value={type}
          onChange={(v) => {
            setType(v);
            setOpen(null);
          }}
          options={[
            { id: "all", label: "All" },
            { id: "CRASH", label: "Crashes" },
            { id: "ANR", label: "ANRs" },
          ]}
        />
      }
    >
      {issues.error ? (
        <LoadError error={issues.error} />
      ) : (
        <div className="rp-card" style={{ overflow: "hidden" }}>
          {issues.isPending ? (
            <div style={{ padding: 16 }}>
              <Skel h={60} />
            </div>
          ) : list.length ? (
            list.map((issue, i) => (
              <ClusterRow
                key={issue.id}
                appId={appId}
                issue={issue}
                first={i === 0}
                open={open === issue.id}
                onToggle={() => setOpen(open === issue.id ? null : issue.id)}
              />
            ))
          ) : (
            <div style={{ padding: 16, fontSize: 13, color: "#6C6962" }}>
              No clusters in this period.
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function ClusterRow({
  appId,
  issue,
  first,
  open,
  onToggle,
}: {
  appId: string;
  issue: ErrorIssue;
  first: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ borderTop: rowBorder(first ? 0 : 1) }}>
      <button
        type="button"
        className="rp-row"
        aria-expanded={open}
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          gap: 12,
          padding: "12px 16px",
          border: "none",
          background: "none",
          textAlign: "left",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span
          className="rp-mono"
          style={{
            fontSize: 11,
            padding: "2px 7px",
            borderRadius: 6,
            background: issue.type === "ANR" ? "#FBF3E2" : "#FDF0EE",
            color: issue.type === "ANR" ? "#8A5A00" : OVER,
          }}
        >
          {issue.type}
        </span>
        <span
          style={{
            flex: "1 1 260px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 13, overflowWrap: "anywhere" }}>
            {issue.cause}
          </span>
          <span
            className="rp-mono"
            style={{ fontSize: 11.5, color: "#6C6962", overflowWrap: "anywhere" }}
          >
            {issue.location}
          </span>
        </span>
        <span className="rp-mono" style={{ fontSize: 12, color: "#55534E", whiteSpace: "nowrap" }}>
          {issue.users.toLocaleString()} users · {issue.reports.toLocaleString()} reports
        </span>
      </button>
      {open ? <ClusterDetail appId={appId} issue={issue} /> : null}
    </div>
  );
}

function ClusterDetail({ appId, issue }: { appId: string; issue: ErrorIssue }) {
  const toast = useToast();
  const detail = useErrorIssue(appId, issue.id);
  const explain = useExplainCrash(appId);
  const d = detail.data;
  return (
    <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
      {detail.error ? <LoadError error={detail.error} /> : null}
      {!d && !detail.error ? <Skel h={120} /> : null}
      {d ? (
        <>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 12.5 }}>
            <Facts
              title="Versions"
              items={[`${issue.firstVersionCode ?? "?"} → ${issue.lastVersionCode ?? "?"}`]}
            />
            <Facts title="Devices" items={d.devices.slice(0, 4).map((x) => x.value)} />
            <Facts title="Android API" items={d.androidVersions.slice(0, 4).map((x) => x.value)} />
          </div>
          {d.files.length ? <Facts title="Files likely involved" items={d.files} mono /> : null}
          {d.reports[0] ? (
            <pre
              className="rp-mono"
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 10,
                background: "#191917",
                color: "#F4F2EE",
                fontSize: 11.5,
                lineHeight: 1.6,
                maxHeight: 220,
                overflow: "auto",
                whiteSpace: "pre",
              }}
            >
              {d.reports[0].reportText}
            </pre>
          ) : null}
          {explain.data ? (
            <div
              role="region"
              aria-label="AI explanation"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: 14,
                borderRadius: 10,
                background: "#F1F5F2",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <span style={{ fontWeight: 600 }}>{explain.data.summary}</span>
              <span>
                <span className="rp-label">Likely cause</span>
                <br />
                {explain.data.cause}
              </span>
              <span>
                <span className="rp-label">Suggested fix</span>
                <br />
                {explain.data.fix}
              </span>
              {explain.data.files.length ? (
                <span className="rp-mono" style={{ fontSize: 12 }}>
                  {explain.data.files.join("  ·  ")}
                </span>
              ) : null}
              <span style={{ fontSize: 12, color: "#55534E" }}>
                With the TreeVook connector, ask Claude Code to &quot;explain_crash {issue.id}&quot;
                and it reads these files in your repository to write the fix.
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="rp-btn"
              style={{ alignSelf: "flex-start" }}
              disabled={explain.isPending}
              onClick={() =>
                explain.mutate(issue.id, { onError: (err) => toast(errorMessage(err)) })
              }
            >
              {explain.isPending ? <Spinner /> : null} Explain with AI
            </button>
          )}
          {issue.issueUri ? (
            <a
              href={issue.issueUri}
              target="_blank"
              rel="noreferrer"
              className="rp-btn-text"
              style={{ alignSelf: "flex-start" }}
            >
              Open in Play Console ↗
            </a>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Facts({ title, items, mono }: { title: string; items: string[]; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span className="rp-label">{title}</span>
      {items.length ? (
        items.map((item) => (
          <span
            key={item}
            className={mono ? "rp-mono" : undefined}
            style={{ fontSize: mono ? 12 : 12.5, overflowWrap: "anywhere" }}
          >
            {item}
          </span>
        ))
      ) : (
        <span style={{ color: "#6C6962" }}>—</span>
      )}
    </div>
  );
}
