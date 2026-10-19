"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { CampaignStatusFilter, ReportPreset } from "@/lib/api/types";
import { PlansTab } from "@/features/plans/plans-list";
import { AdAccountSwitcher } from "@/features/meta-ads/account-switcher";
import { PageHead, Seg } from "@/features/replyly/ui";

import { PRESETS } from "./labels";
import { LiveCampaigns } from "./live-campaigns";

type Tab = "live" | "plans";
const STATUSES: CampaignStatusFilter[] = ["all", "active", "paused"];

export function CampaignsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "plans" ? "plans" : "live";
  const presetParam = params.get("period") as ReportPreset | null;
  const preset: ReportPreset = PRESETS.some((p) => p.id === presetParam) ? presetParam! : "last_7d";
  const statusParam = params.get("status") as CampaignStatusFilter | null;
  const status: CampaignStatusFilter =
    statusParam && STATUSES.includes(statusParam) ? statusParam : "all";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHead
        title="Campaigns"
        sub={
          <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>
              {tab === "live"
                ? "What’s running in your Meta ad account. Pause, resume and adjust budgets here."
                : "Plans drafted here or by Claude, waiting for your review."}
            </span>
            <AdAccountSwitcher inline />
          </span>
        }
        actions={
          <Link href="/campaigns/new" className="rp-btn">
            <Plus size={14} /> New campaign
          </Link>
        }
      />
      <div style={{ alignSelf: "flex-start" }}>
        <Seg
          label="Campaign views"
          value={tab}
          onChange={(t) => update({ tab: t === "live" ? null : t })}
          options={[
            { id: "live", label: "Live campaigns" },
            { id: "plans", label: "Plans" },
          ]}
        />
      </div>
      {tab === "live" ? (
        <LiveCampaigns
          preset={preset}
          status={status}
          onPreset={(p) => update({ period: p === "last_7d" ? null : p })}
          onStatus={(s) => update({ status: s === "all" ? null : s })}
        />
      ) : (
        <PlansTab />
      )}
    </div>
  );
}
