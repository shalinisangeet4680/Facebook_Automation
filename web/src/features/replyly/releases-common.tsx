"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { errorMessage } from "@/lib/api/errors";

import { Select } from "./select";
import { useAppColors, useConnected } from "./shell";
import { Banner, Linked } from "./ui";

export function useSelectedApp() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { connected, loading } = useConnected();
  const { apps, color } = useAppColors();
  const wanted = params.get("app");
  const app = apps.find((a) => a.id === wanted) ?? apps[0] ?? null;

  useEffect(() => {
    if (!loading && !connected) router.replace("/reviews/connect");
  }, [loading, connected, router]);

  return {
    app,
    apps,
    color,
    choose: (id: string) => router.replace(`${pathname}?app=${id}`, { scroll: false }),
  };
}

export function AppPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const { apps, color } = useAppColors();
  if (!apps.length || !value) return null;
  return (
    <Select
      label="App"
      value={value}
      onChange={onChange}
      minWidth={200}
      options={apps.map((a) => ({ value: a.id, label: a.title, dot: color(a.id) }))}
    />
  );
}

export function NoApps() {
  return (
    <Banner tone="info" title="No apps yet">
      Add an app on the{" "}
      <Link href="/reviews/apps" style={{ color: "inherit", fontWeight: 500 }}>
        Apps page
      </Link>{" "}
      first. Releases and health use the same Google Play connection as reviews.
    </Banner>
  );
}

export function LoadError({ error }: { error: unknown }) {
  return (
    <Banner tone="error" title="Google Play didn't answer">
      <Linked text={errorMessage(error)} />
    </Banner>
  );
}

export const pct = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "—" : `${Number(n.toFixed(digits))}%`;

export const STATUS_STYLE: Record<string, [string, string, string]> = {
  inProgress: ["#EAF3EE", "#0F6B4A", "Rolling out"],
  halted: ["#FDF0EE", "#B42318", "Halted"],
  completed: ["#EFEDE8", "#55534E", "Live"],
  draft: ["#ECEFF6", "#3B4A6B", "Draft"],
};

export function StatusPill({ status }: { status: string }) {
  const [bg, fg, label] = STATUS_STYLE[status] ?? ["#EFEDE8", "#55534E", status];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 11.5,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
