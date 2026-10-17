import type { Metadata } from "next";
import { Suspense } from "react";

import { CommentsPage } from "@/features/autopost/comments-page";

export const metadata: Metadata = { title: "Comments" };

export default function Page() {
  return (
    <Suspense>
      <CommentsPage platform="facebook" />
    </Suspense>
  );
}
