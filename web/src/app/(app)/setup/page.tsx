import type { Metadata } from "next";

import { SetupOverview } from "@/features/onboarding/setup-overview";

export const metadata: Metadata = { title: "Setup" };

export default function SetupPage() {
  return <SetupOverview />;
}
