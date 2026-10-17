import type { Metadata } from "next";
import { Suspense } from "react";

import { CreateProfilePage } from "@/features/business/create-page";

export const metadata: Metadata = { title: "Create a Business Profile" };

export default function Page() {
  return (
    <Suspense>
      <CreateProfilePage />
    </Suspense>
  );
}
