import type { Metadata } from "next";
import { Suspense } from "react";

import { CampaignsPage } from "@/features/campaigns/campaigns-page";

export const metadata: Metadata = { title: "Campaigns" };

export default function Page() {
  return (
    <Suspense>
      <CampaignsPage />
    </Suspense>
  );
}
