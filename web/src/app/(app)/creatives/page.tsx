import type { Metadata } from "next";

import { CreativesPage } from "@/features/creatives/creatives-page";

export const metadata: Metadata = { title: "Creatives" };

export default function Page() {
  return <CreativesPage />;
}
