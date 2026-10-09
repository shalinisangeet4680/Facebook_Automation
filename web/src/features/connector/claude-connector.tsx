"use client";

import {
  Hand,
  MessageSquareText,
  PlugZap,
  ShieldCheck,
  Terminal,
  Unplug,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import { useConnectedApps, useConnector, useDisconnectApp, useMetaAssets } from "@/lib/api/queries";
import type { ConnectedApp } from "@/lib/api/types";
import { BRAND } from "@/lib/config";

const PROMPTS = [
  "How did my ads do in the last 7 days? What should I change?",
  "Is my Pixel tracking leads correctly?",
  "Which ad has the lowest cost per lead this month, and why?",
  "Draft a paused leads campaign for clinic owners in Patna at ₹500 a day.",
];

const APP_STEPS = [
  "Open Claude and go to Settings → Connectors.",
  "Choose Add custom connector.",
  `Name it ${BRAND.name}, paste the connector URL and select Add.`,
  `Select Connect, sign in here and choose Allow.`,
  `In a chat, open the tools menu and turn on ${BRAND.name}.`,
];

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function ClaudeConnector() {
  const connector = useConnector();
  const assets = useMetaAssets();
  const currency =
    (assets.data?.data.find((a) => a.kind === "ad_account" && a.isPrimary)?.details.currency as
      string | undefined) ?? "INR";

  return (
    <>
      <PageHeader
        title="Use with Claude"
        description={`Chat with Claude about your ads on your own Claude plan. Claude reads your results and prepares changes; nothing spends money until you say yes.`}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <PlugZap className="text-accent size-5" aria-hidden />
                <h2 className="text-[15px] font-semibold">Connector URL</h2>
              </div>
              <p className="text-small text-muted mt-1">
                Paste this into Claude when you add a custom connector.
              </p>
              {connector.isPending ? (
                <Skeleton className="mt-4 h-11 w-full" />
              ) : connector.isError ? (
                <ErrorState
                  className="mt-4"
                  message={errorMessage(connector.error)}
                  onRetry={() => void connector.refetch()}
                />
              ) : (
                <div className="border-border bg-surface-muted mt-4 flex items-center gap-2 rounded-lg border p-1.5 pl-3">
                  <code className="min-w-0 flex-1 truncate font-mono text-[13px]">
                    {connector.data.mcpUrl}
                  </code>
                  <CopyButton value={connector.data.mcpUrl} label="Copy URL" />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-2">
              <section aria-labelledby="claude-app-steps">
                <h2 id="claude-app-steps" className="text-[15px] font-semibold">
                  Claude on web, desktop or mobile
                </h2>
                <ol className="mt-3 grid gap-3">
                  {APP_STEPS.map((step, i) => (
                    <li key={step} className="flex gap-3 text-[14px]">
                      <span className="bg-accent-soft text-accent grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section aria-labelledby="claude-code-steps" className="min-w-0">
                <h2
                  id="claude-code-steps"
                  className="flex items-center gap-2 text-[15px] font-semibold"
                >
                  <Terminal className="size-4" aria-hidden /> Claude Code
                </h2>
                <p className="text-small text-muted mt-1">
                  Run this in your terminal, then type /mcp in Claude Code to sign in.
                </p>
                {connector.data ? (
                  <div className="bg-foreground text-background mt-3 grid gap-2 rounded-lg p-3">
                    <code className="font-mono text-[12px] break-all">
                      claude mcp add --transport http autopilot {connector.data.mcpUrl}
                    </code>
                    <CopyButton
                      className="justify-self-end"
                      value={`claude mcp add --transport http autopilot ${connector.data.mcpUrl}`}
                      label="Copy command"
                    />
                  </div>
                ) : (
                  <Skeleton className="mt-3 h-20 w-full" />
                )}
              </section>
            </div>
          </Card>

          <Card>
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <MessageSquareText className="text-accent size-5" aria-hidden />
                <h2 className="text-[15px] font-semibold">Try asking</h2>
              </div>
              <ul className="mt-3 grid gap-2">
                {PROMPTS.map((prompt) => (
                  <li
                    key={prompt}
                    className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  >
                    <span className="text-[14px]">{prompt}</span>
                    <CopyButton
                      value={prompt}
                      label="Copy"
                      variant="ghost"
                      aria-label={`Copy prompt: ${prompt}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <ConnectedApps />
          <Card>
            <div className="grid gap-4 p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold">Built-in safety</h2>
              <Guard icon={<Hand className="size-4" />} title="New campaigns start paused">
                Claude can build campaigns, but they stay off until you turn them on.
              </Guard>
              <Guard icon={<ShieldCheck className="size-4" />} title="You confirm every launch">
                Turning ads on or changing a budget shows you a summary in the chat first.
              </Guard>
              <Guard icon={<Wallet className="size-4" />} title="Daily budget limit">
                {connector.data
                  ? `Up to ${new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(connector.data.maxDailyBudget)} per campaign or ad set per day.`
                  : "A daily limit applies to every campaign and ad set."}
              </Guard>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Guard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="bg-success-soft text-success grid size-8 shrink-0 place-items-center rounded-full">
        {icon}
      </span>
      <div>
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-small text-muted">{children}</p>
      </div>
    </div>
  );
}

function ConnectedApps() {
  const apps = useConnectedApps();
  return (
    <Card>
      <div className="border-border border-b px-5 py-4">
        <h2 className="text-[15px] font-semibold">Connected apps</h2>
      </div>
      {apps.isPending ? (
        <div className="grid gap-3 p-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : apps.isError ? (
        <ErrorState
          className="m-5"
          message={errorMessage(apps.error)}
          onRetry={() => void apps.refetch()}
        />
      ) : apps.data.data.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={<PlugZap className="size-5" />}
          title="Nothing connected yet"
          description="After you approve Claude, it shows up here."
        />
      ) : (
        <ul className="divide-border divide-y">
          {apps.data.data.map((app) => (
            <AppRow key={app.id} app={app} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function AppRow({ app }: { app: ConnectedApp }) {
  const [open, setOpen] = useState(false);
  const disconnect = useDisconnectApp();
  const canWrite = app.scopes.includes("ads:write");
  return (
    <li className="flex items-center gap-3 px-5 py-4">
      <span className="bg-surface-muted border-border grid size-9 shrink-0 place-items-center rounded-[9px] border font-semibold">
        {app.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14px] font-medium">{app.name}</p>
          <Badge tone={canWrite ? "accent" : "neutral"}>
            {canWrite ? "Read and changes" : "Read only"}
          </Badge>
        </div>
        <p className="text-caption text-muted">
          {app.lastUsedAt
            ? `Last used ${dateTime.format(new Date(app.lastUsedAt))}`
            : `Connected ${dateTime.format(new Date(app.connectedAt))}`}
        </p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:bg-danger-soft hover:text-danger"
          >
            <Unplug /> Disconnect
          </Button>
        </DialogTrigger>
        <DialogContent
          title={`Disconnect ${app.name}?`}
          description={`${app.name} loses access right away. You can connect it again from Claude at any time.`}
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={disconnect.isPending}
              onClick={() =>
                disconnect.mutate(app.id, {
                  onSuccess: () => {
                    setOpen(false);
                    toast.success(`${app.name} disconnected`);
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Disconnect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}
