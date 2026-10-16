import type { Metadata } from "next";

import { StoreProjects } from "@/features/store/store-projects";

export const metadata: Metadata = { title: "Play Store" };

export default function Page() {
  return <StoreProjects />;
}
