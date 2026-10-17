import type { Metadata } from "next";
import { Suspense } from "react";

import { PlanReview } from "@/features/plans/plan-review";

export const metadata: Metadata = { title: "Review plan" };

export default function PlanPage() {
  return (
    <Suspense>
      <PlanReview />
    </Suspense>
  );
}
