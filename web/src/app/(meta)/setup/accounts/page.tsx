import type { Metadata } from "next";

import { ChooseAccounts } from "@/features/meta/choose-accounts";

export const metadata: Metadata = { title: "Choose accounts" };

export default function AccountsPage() {
  return <ChooseAccounts />;
}
