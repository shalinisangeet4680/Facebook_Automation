import type { Metadata } from "next";
import { Suspense } from "react";

import { CalendarPage } from "@/features/autopost/calendar-page";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return (
    <Suspense>
      <CalendarPage platform="instagram" />
    </Suspense>
  );
}
