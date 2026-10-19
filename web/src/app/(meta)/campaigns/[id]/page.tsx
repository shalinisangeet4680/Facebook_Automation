import type { Metadata } from "next";
import { Suspense } from "react";

import { CampaignDetailPage } from "@/features/campaigns/campaign-detail";

export const metadata: Metadata = { title: "Campaign" };

export default function Page() {
  return (
    <Suspense>
      <CampaignDetailPage />
    </Suspense>
  );
}
