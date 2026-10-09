import type { Metadata } from "next";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { ConsentScreen } from "@/features/connector/consent-screen";

export const metadata: Metadata = { title: "Connect an app", robots: { index: false } };

export default function AuthorizePage() {
  return (
    <main className="bg-background flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <Logo className="mb-8" />
      <Suspense>
        <ConsentScreen />
      </Suspense>
    </main>
  );
}
