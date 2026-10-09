import type { Metadata } from "next";

import { PlansList } from "@/features/plans/plans-list";

export const metadata: Metadata = { title: "Campaigns" };

export default function CampaignsPage() {
  return <PlansList />;
}
