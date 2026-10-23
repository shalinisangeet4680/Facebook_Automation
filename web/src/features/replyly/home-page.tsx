"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { usePlayApps } from "@/lib/api/queries";

import { AppPage } from "./app-page";
import { DashboardPage } from "./dashboard-page";
import { Skel } from "./ui";

export function ReviewsHome() {
  const router = useRouter();
  const apps = usePlayApps();
  const list = apps.data?.data;
  const empty = list?.length === 0 && !apps.isFetching;

  useEffect(() => {
    if (empty) router.replace("/reviews/connect");
  }, [empty, router]);

  if (apps.isError || (list && list.length > 1)) return <DashboardPage />;
  if (list?.length === 1) return <AppPage appId={list[0]!.id} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Skel h={52} w={260} r={14} />
      <Skel h={240} r={14} />
    </div>
  );
}
