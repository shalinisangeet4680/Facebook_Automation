import type { Metadata } from "next";

import { NewCampaign } from "@/features/plans/new-campaign";

export const metadata: Metadata = { title: "New campaign" };

export default function NewCampaignPage() {
  return <NewCampaign />;
}
