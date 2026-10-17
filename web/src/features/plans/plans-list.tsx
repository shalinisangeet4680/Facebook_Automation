"use client";

import { Check, ChevronRight, Copy, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { usePlans } from "@/lib/api/queries";
import { Banner, PageHead, Section, Skel, copyText, useToast } from "@/features/replyly/ui";

import { GOAL_LABELS, sourceLabel } from "./labels";
import { MUTED, StatusPill } from "./plan-sections";

const PROMPT =
  "Plan a new Meta campaign for my business. Look at my account, past results and website, ask me anything you need, then propose the plan with your reasons for every setting.";

const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

function PromptCard() {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(PROMPT)) {
      setCopied(true);
      toast("Prompt copied");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast("Couldn’t copy. Select the text instead.");
    }
  };
  return (
    <div
      className="rp-card"
      style={{ padding: 20, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "#EAF3EE",
          color: "#0F6B4A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Sparkles size={18} aria-hidden />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 240px", minWidth: 0 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Plan a campaign with Claude</h2>
        <span style={{ fontSize: 13, color: "#55534E" }}>
          In Claude with the TreeVook connector on, paste this. The plan appears here for review.
        </span>
        <p
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 10,
            background: "#F7F6F3",
            border: "1px solid #EFEDE8",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {PROMPT}
        </p>
      </div>
      <button type="button" className="rp-btn-light" onClick={() => void copy()}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy prompt"}
      </button>
    </div>
  );
}

function Plans() {
  const plans = usePlans();
  if (plans.isPending)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Skel h={64} r={14} />
        <Skel h={64} r={14} />
      </div>
    );
  if (plans.isError)
    return (
      <Banner
        tone="error"
        title="Couldn’t load plans"
        action={
          <button type="button" className="rp-btn-light" onClick={() => void plans.refetch()}>
            Try again
          </button>
        }
      >
        {errorMessage(plans.error)}
      </Banner>
    );
  if (!plans.data.data.length)
    return (
      <div
        className="rp-card"
        style={{
          padding: "28px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <span className="rp-serif" style={{ fontSize: 24 }}>
          No plans yet
        </span>
        <span style={{ fontSize: 13, color: MUTED, maxWidth: 420 }}>
          Ask Claude to plan a campaign. It will show up here for you to review.
        </span>
        <Link href="/claude" className="rp-btn-light" style={{ marginTop: 8 }}>
          Set up Claude
        </Link>
      </div>
    );
  return (
    <div className="rp-card" style={{ overflow: "hidden" }}>
      {plans.data.data.map((plan, i) => (
        <Link
          key={plan.id}
          href={`/campaigns/plans/${plan.id}`}
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
          <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{plan.name}</span>
              <StatusPill status={plan.status} />
            </span>
            <span style={{ fontSize: 12.5, color: MUTED }}>
              {GOAL_LABELS[plan.goal]?.title ?? plan.goal} · {sourceLabel(plan.source)} ·{" "}
              {date.format(new Date(plan.createdAt))}
            </span>
          </span>
          <ChevronRight size={16} color={MUTED} aria-hidden style={{ flexShrink: 0 }} />
        </Link>
      ))}
    </div>
  );
}

export function PlansList() {
  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHead
        title="Campaigns"
        sub="Claude proposes every setting with its reasons. You review, adjust and launch here."
      />
      <PromptCard />
      <Section title="Plans">
        <Plans />
      </Section>
    </div>
  );
}
