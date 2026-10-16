"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import type { PlayDiscovery } from "@/lib/api/types";

const URL_PATTERN = /(https:\/\/[^\s)]+)/g;

export function Linkified({ text }: { text: string }) {
  const parts: ReactNode[] = text.split(URL_PATTERN).map((part, i) =>
    i % 2 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="text-accent font-medium break-all underline underline-offset-4"
      >
        {new URL(part).hostname === "console.cloud.google.com" ? "Open Google Cloud" : part}
      </a>
    ) : (
      part
    ),
  );
  return <>{parts}</>;
}

export function DiscoveryPanel({
  result,
  onClose,
}: {
  result: PlayDiscovery;
  onClose: () => void;
}) {
  const ok = !result.error;
  return (
    <Card role="status" className="relative grid gap-3 p-5 pr-12">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="text-muted hover:bg-surface-muted hover:text-foreground absolute top-3 right-3 grid size-8 place-items-center rounded-[var(--radius-control)]"
      >
        <X className="size-4" />
      </button>
      <p className="flex items-start gap-2 text-[15px] font-semibold">
        {ok ? (
          <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
        ) : (
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
        )}
        {ok
          ? result.found
            ? `Found ${result.found} app${result.found === 1 ? "" : "s"}: ${result.added.length} added, ${result.already.length} already here${result.failed.length ? `, ${result.failed.length} need permission` : ""}`
            : "This account can't see any apps yet"
          : "Your apps couldn't be listed automatically"}
      </p>
      {result.error ? (
        <p className="text-small text-muted">
          <Linkified text={result.error} /> You can still add apps by package name.
        </p>
      ) : !result.found ? (
        <p className="text-small text-muted">
          In Play Console, open Users and permissions and give this service account access to your
          apps, then use Find apps.
        </p>
      ) : null}
      {result.added.length ? (
        <ul className="flex flex-wrap gap-2">
          {result.added.map((a) => (
            <li key={a.id}>
              <Link
                href={`/reviews/${a.id}`}
                className="border-border hover:border-border-strong inline-flex rounded-full border px-3 py-1 text-[13px] font-medium"
              >
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {result.failed.length ? (
        <ul className="grid gap-1.5">
          {result.failed.map((f) => (
            <li key={f.packageName} className="text-small">
              <span className="font-medium">{f.title}</span>{" "}
              <span className="text-muted">
                ({f.packageName}): {f.reason}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
