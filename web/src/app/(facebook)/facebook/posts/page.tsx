import type { Metadata } from "next";
import { Suspense } from "react";

import { PostsPage } from "@/features/autopost/posts-page";

export const metadata: Metadata = { title: "Posts" };

export default function Page() {
  return (
    <Suspense>
      <PostsPage platform="facebook" />
    </Suspense>
  );
}
