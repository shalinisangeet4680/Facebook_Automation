"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PageHead } from "@/features/replyly/ui";

import { PostsPanel } from "./posts-panel";
import { useGoogleConnected } from "./shell";

export function BusinessPostsPage() {
  const router = useRouter();
  const { connected, loading } = useGoogleConnected();

  useEffect(() => {
    if (!loading && !connected) router.replace("/business/connect");
  }, [loading, connected, router]);

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHead
        title="Posts"
        sub="Updates, offers and events on your Google profile. Schedule them ahead and TreeVook publishes on time."
      />
      <PostsPanel />
    </div>
  );
}
