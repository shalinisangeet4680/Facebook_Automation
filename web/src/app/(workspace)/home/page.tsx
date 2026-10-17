import type { Metadata } from "next";

import { HomePage } from "@/features/workspace/home-page";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return <HomePage />;
}
