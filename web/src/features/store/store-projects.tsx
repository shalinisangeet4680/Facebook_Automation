"use client";

import { Smartphone } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { mediaSrc } from "@/features/creatives/creatives-page";
import { errorMessage } from "@/lib/api/errors";
import { useStoreProjects } from "@/lib/api/queries";
import type { StoreProject } from "@/lib/api/types";

import { STATUS, languageName } from "./labels";

const COMMAND = "/store-creatives:store-creatives";
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export function StoreProjects() {
  const projects = useStoreProjects();
  return (
    <>
      <PageHeader
        title="Store listing"
        description="Google Play screenshots and feature graphics made from your app. Claude Code reads your app, captures its screens and renders the images on your computer; you choose the style here."
      />
      {projects.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : projects.isError ? (
        <ErrorState
          message={errorMessage(projects.error)}
          onRetry={() => void projects.refetch()}
        />
      ) : projects.data.data.length === 0 ? (
        <GetStarted />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data.data.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </ul>
      )}
    </>
  );
}

function GetStarted() {
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <span className="bg-accent-soft text-accent grid size-12 shrink-0 place-items-center rounded-full">
          <Smartphone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold">Make your store listing images</h2>
          <ol className="text-muted mt-4 grid list-decimal gap-3 pl-5">
            <li>
              Connect Autopilot to Claude Code on the{" "}
              <Link href="/claude" className="text-accent font-medium underline underline-offset-4">
                Claude page
              </Link>
              .
            </li>
            <li>Install the store-creatives plugin in Claude Code.</li>
            <li>
              Open Claude Code in your Android app&apos;s folder and run the command below. Claude
              writes the copy, captures the screens from your emulator and sends style previews
              here.
            </li>
          </ol>
          <div className="border-border bg-surface-muted mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border px-4 py-3">
            <code className="text-[14px] break-all">{COMMAND}</code>
            <CopyButton value={COMMAND} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProjectCard({ project }: { project: StoreProject }) {
  const status = STATUS[project.status];
  const { counts } = project;
  return (
    <li>
      <Link
        href={`/store/${project.id}`}
        className="group block rounded-[var(--radius-card)] outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]"
      >
        <Card className="group-hover:border-border-strong flex h-full flex-col overflow-hidden transition-colors">
          <div className="bg-surface-muted grid h-48 place-items-center overflow-hidden">
            {project.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaSrc(project.coverUrl)}
                alt=""
                loading="lazy"
                className="h-full w-auto object-contain"
              />
            ) : (
              <Smartphone className="text-subtle size-8" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="truncate text-[15px] font-semibold">{project.name}</h2>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="text-small text-muted">
              {project.languages.map(languageName).join(", ") || "No languages yet"}
            </p>
            <p className="text-small text-muted mt-auto">
              {counts.screenshots
                ? `${counts.screenshots} screenshots`
                : `${counts.screens} screens, ${counts.previews} previews`}{" "}
              · Updated {date.format(new Date(project.updatedAt))}
            </p>
          </div>
        </Card>
      </Link>
    </li>
  );
}

export function BackToStore() {
  return (
    <Button asChild variant="link" size="sm">
      <Link href="/store">Store listing</Link>
    </Button>
  );
}
