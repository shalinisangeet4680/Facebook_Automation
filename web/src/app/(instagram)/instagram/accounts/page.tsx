import type { Metadata } from "next";
import { Suspense } from "react";

import { AccountsPage } from "@/features/autopost/accounts-page";

export const metadata: Metadata = { title: "Accounts" };

export default function Page() {
  return (
    <Suspense>
      <AccountsPage platform="instagram" />
    </Suspense>
  );
}
