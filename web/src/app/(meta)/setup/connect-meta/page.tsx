import type { Metadata } from "next";
import { Suspense } from "react";

import { ConnectMeta } from "@/features/meta/connect-meta";

export const metadata: Metadata = { title: "Connect Meta" };

export default function ConnectMetaPage() {
  return (
    <Suspense>
      <ConnectMeta />
    </Suspense>
  );
}
