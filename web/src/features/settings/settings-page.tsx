"use client";

import {
  ArrowRight,
  Bot,
  Building2,
  LogOut,
  PlugZap,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import {
  useAutomationSettings,
  useConnectedApps,
  useMetaConnection,
  useSettings,
  useSignOutEverywhere,
  useUpdateAutomationSettings,
  useUpdateProfile,
  useUpdateWorkspace,
} from "@/lib/api/queries";
import type { AutomationSettings, AutomationSettingsUpdate, Settings } from "@/lib/api/types";

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

export function SettingsPage() {
  const settings = useSettings();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Your workspace, spending guardrails, AI, profile and connections."
      />
      {settings.isPending ? (
        <div className="grid gap-6">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : settings.isError ? (
        <ErrorState
          message={errorMessage(settings.error)}
          onRetry={() => void settings.refetch()}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <WorkspaceForm
              key={JSON.stringify([settings.data.workspace, settings.data.budget])}
              settings={settings.data}
            />
            <AutomationSection />
            <ProfileForm key={JSON.stringify(settings.data.profile)} settings={settings.data} />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <Connections />
            <Security />
          </div>
        </div>
      )}
    </>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="grid grid-cols-1 gap-5 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <span className="text-accent">{icon}</span>
            {title}
          </h2>
          {description ? <p className="text-small text-muted mt-1">{description}</p> : null}
        </div>
        {children}
      </div>
    </Card>
  );
}

function WorkspaceForm({ settings }: { settings: Settings }) {
  const update = useUpdateWorkspace();
  const { budget } = settings;
  const [name, setName] = useState(settings.workspace.name);
  const [maxDaily, setMaxDaily] = useState(String(budget.maxDailyBudget));
  const [monthly, setMonthly] = useState(
    budget.monthlyBudget === null ? "" : String(budget.monthlyBudget),
  );
  const [target, setTarget] = useState(
    budget.targetCostPerResult === null ? "" : String(budget.targetCostPerResult),
  );

  const maxDailyValue = Number(maxDaily);
  const monthlyValue = optionalNumber(monthly);
  const targetValue = optionalNumber(target);
  const errors = {
    name: name.trim().length < 2 ? "Use at least 2 characters." : null,
    maxDaily:
      !Number.isFinite(maxDailyValue) || maxDailyValue <= 0
        ? "Enter an amount."
        : maxDailyValue > budget.platformMaxDailyBudget
          ? `The most allowed is ${money(budget.platformMaxDailyBudget, budget.currency)}.`
          : null,
    monthly:
      monthlyValue === null
        ? null
        : Number.isNaN(monthlyValue) || monthlyValue <= 0
          ? "Enter an amount or leave it empty."
          : monthlyValue < maxDailyValue
            ? "Should be at least the daily limit."
            : null,
    target:
      targetValue === null
        ? null
        : Number.isNaN(targetValue) || targetValue <= 0
          ? "Enter an amount or leave it empty."
          : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const dirty =
    name !== settings.workspace.name ||
    maxDailyValue !== budget.maxDailyBudget ||
    monthlyValue !== budget.monthlyBudget ||
    targetValue !== budget.targetCostPerResult;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    update.mutate(
      {
        name: name.trim(),
        maxDailyBudget: maxDailyValue,
        monthlyBudget: monthlyValue,
        targetCostPerResult: targetValue,
      },
      {
        onSuccess: () => toast.success("Settings saved"),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <SectionCard
        icon={<Building2 className="size-5" />}
        title="Workspace and budget"
        description="These limits apply everywhere: in TreeVook, in Claude and in suggestions."
      >
        <Field label="Workspace name" error={errors.name}>
          {(p) => (
            <Input
              {...p}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="organization"
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={`Daily limit per campaign (${budget.currency})`}
            error={errors.maxDaily}
            hint={`Nothing can be set above this. Platform maximum ${money(budget.platformMaxDailyBudget, budget.currency)}.`}
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="decimal"
                min={1}
                value={maxDaily}
                onChange={(e) => setMaxDaily(e.target.value)}
              />
            )}
          </Field>
          <Field
            label={`Monthly ad budget (${budget.currency})`}
            error={errors.monthly}
            hint="Optional. Used for pacing alerts."
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="decimal"
                min={1}
                placeholder="No monthly budget"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field
          label={`Target cost per result (${budget.currency})`}
          error={errors.target}
          hint="Optional. What a lead or sign-up is worth paying. Suggestions compare against it."
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="decimal"
              min={1}
              placeholder="Use account average"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="sm:max-w-xs"
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || invalid} loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </SectionCard>
    </form>
  );
}

const AI_MODES: [AutomationSettings["aiMode"], string, string][] = [
  ["platform", "TreeVook AI", "Included, with a daily limit"],
  ["own", "My Anthropic key", "Billed to your Anthropic account"],
  ["off", "Off", "Templates as written"],
];

function aiSummary(a: AutomationSettings) {
  if (a.aiMode === "off")
    return "Drafts use your templates as written. AI-written ratings wait for Claude through the connector.";
  if (a.aiMode === "own")
    return a.aiKeyHint
      ? `Drafts use your Anthropic key (${a.aiKeyHint}) with ${a.model}.`
      : "Add your Anthropic key below to start drafting with AI.";
  if (!a.platformAi)
    return "TreeVook AI isn’t set up on this server. Use your own key, or draft through the connector.";
  return `${a.draftsToday} of ${a.dailyDrafts} AI drafts used in the last 24 hours, across Play Reviews and Google Business, with ${a.model}.`;
}

function AutomationSection() {
  const automation = useAutomationSettings();
  if (automation.isPending) return <Skeleton className="h-72 w-full" />;
  if (automation.isError)
    return (
      <ErrorState
        message={errorMessage(automation.error)}
        onRetry={() => void automation.refetch()}
      />
    );
  return <AutomationForm key={automation.data.slackChannel ?? ""} settings={automation.data} />;
}

function AutomationForm({ settings }: { settings: AutomationSettings }) {
  const update = useUpdateAutomationSettings();
  const [key, setKey] = useState("");
  const [hook, setHook] = useState("");
  const [channel, setChannel] = useState(settings.slackChannel ?? "");

  const save = (body: AutomationSettingsUpdate, message: string, after?: () => void) =>
    update.mutate(body, {
      onSuccess: () => {
        toast.success(message);
        after?.();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <section id="ai" className="scroll-mt-24">
      <SectionCard
        icon={<Bot className="size-5" />}
        title="AI & automation"
        description="Shared by Play Reviews, Google Business and every agent connected to this workspace."
      >
        <div className="grid gap-3">
          <p className="text-small text-foreground font-medium" id="ai-mode">
            AI drafting
          </p>
          <RadioCardGroup
            aria-labelledby="ai-mode"
            value={settings.aiMode}
            disabled={update.isPending}
            onValueChange={(v) =>
              save({ aiMode: v as AutomationSettings["aiMode"] }, "AI drafting updated")
            }
            className="sm:grid-cols-3"
          >
            {AI_MODES.map(([mode, title, description]) => (
              <RadioCard key={mode} value={mode} title={title} description={description} />
            ))}
          </RadioCardGroup>
          <p className="text-small text-muted">{aiSummary(settings)}</p>
        </div>
        {settings.aiMode === "own" ? (
          <form
            noValidate
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
            onSubmit={(e) => {
              e.preventDefault();
              if (key.trim()) save({ aiKey: key.trim() }, "API key saved", () => setKey(""));
            }}
          >
            <Field
              label="Anthropic API key"
              hint="Stored encrypted. Only the last four characters are shown."
              className="min-w-0 flex-1"
            >
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  autoComplete="off"
                  placeholder={settings.aiKeyHint ?? "sk-ant-…"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              )}
            </Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={!key.trim()}
              className="sm:mt-[1.6rem] sm:h-11"
            >
              Save key
            </Button>
          </form>
        ) : null}
        <form
          noValidate
          className="border-border grid gap-4 border-t pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            save(
              {
                ...(hook.trim() ? { slackWebhook: hook.trim() } : {}),
                slackChannel: channel.trim() || null,
              },
              "Slack saved",
              () => setHook(""),
            );
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-small text-foreground font-medium">Slack escalation</p>
              <p className="text-small text-muted mt-0.5">
                {settings.slackConnected
                  ? `Low ratings post to ${settings.slackChannel ?? "your Slack channel"} when escalation is on for an app or business.`
                  : "Add an incoming webhook so low ratings reach your team."}
              </p>
            </div>
            <Badge tone={settings.slackConnected ? "success" : "neutral"}>
              {settings.slackConnected ? "Connected" : "Off"}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field label="Incoming webhook URL">
              {(p) => (
                <Input
                  {...p}
                  autoComplete="off"
                  placeholder={
                    settings.slackConnected
                      ? "Saved · paste a new one to replace"
                      : "https://hooks.slack.com/services/…"
                  }
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                />
              )}
            </Field>
            <Field label="Channel">
              {(p) => (
                <Input
                  {...p}
                  autoComplete="off"
                  placeholder="#support"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {settings.slackConnected ? (
              <Button
                type="button"
                variant="ghost"
                disabled={update.isPending}
                onClick={() => save({ slackWebhook: null }, "Slack disconnected")}
              >
                Disconnect
              </Button>
            ) : null}
            <Button
              type="submit"
              variant="secondary"
              disabled={!hook.trim() && channel.trim() === (settings.slackChannel ?? "")}
            >
              Save Slack
            </Button>
          </div>
        </form>
        <div className="border-border flex items-start justify-between gap-4 border-t pt-5">
          <div className="min-w-0">
            <p className="text-small text-foreground font-medium" id="agents-can-post">
              Allow agents to post replies
            </p>
            <p className="text-small text-muted mt-0.5">
              Off: Claude and other MCP agents can only create drafts that wait in your inbox.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.agentsCanPost}
            aria-labelledby="agents-can-post"
            disabled={update.isPending}
            onClick={() =>
              save(
                { agentsCanPost: !settings.agentsCanPost },
                settings.agentsCanPost ? "Agents can only draft" : "Agents can post replies",
              )
            }
            className="border-border bg-surface-muted aria-checked:border-accent aria-checked:bg-accent relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] disabled:opacity-60"
          >
            <span
              aria-hidden
              className={`bg-surface size-[18px] rounded-full shadow-[var(--shadow-raised)] transition-transform ${settings.agentsCanPost ? "translate-x-[22px]" : "translate-x-[2px]"}`}
            />
          </button>
        </div>
      </SectionCard>
    </section>
  );
}

function ProfileForm({ settings }: { settings: Settings }) {
  const update = useUpdateProfile();
  const [name, setName] = useState(settings.profile.name ?? "");
  const [email, setEmail] = useState(settings.profile.email ?? "");
  const emailError =
    email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? "Enter a valid email."
      : null;
  const dirty = name !== (settings.profile.name ?? "") || email !== (settings.profile.email ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (emailError) return;
    update.mutate(
      { name: name.trim() || null, email: email.trim() || null },
      {
        onSuccess: () => toast.success("Profile saved"),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <SectionCard icon={<UserRound className="size-5" />} title="Your profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            {(p) => (
              <Input
                {...p}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}
          </Field>
          <Field label="Email" error={emailError} hint="For alerts and reports later.">
            {(p) => (
              <Input
                {...p}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            )}
          </Field>
        </div>
        <Field label="Mobile number" hint="Used to sign in. Can't be changed here.">
          {(p) => (
            <Input
              {...p}
              value={settings.profile.phone}
              readOnly
              disabled
              className="sm:max-w-xs"
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || Boolean(emailError)} loading={update.isPending}>
            Save profile
          </Button>
        </div>
      </SectionCard>
    </form>
  );
}

function Connections() {
  const meta = useMetaConnection();
  const apps = useConnectedApps();
  const metaState = meta.data?.status;
  return (
    <SectionCard icon={<PlugZap className="size-5" />} title="Connections">
      <ul className="divide-border border-border divide-y rounded-lg border">
        <li className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">Meta</p>
            <p className="text-caption text-muted truncate">
              {metaState === "active"
                ? `Connected as ${meta.data?.systemUser?.name ?? "system user"}`
                : metaState === "invalid"
                  ? "Token stopped working"
                  : "Not connected"}
            </p>
          </div>
          {meta.data ? (
            <Badge
              tone={
                metaState === "active" ? "success" : metaState === "invalid" ? "danger" : "neutral"
              }
            >
              {metaState === "active"
                ? "Active"
                : metaState === "invalid"
                  ? "Needs attention"
                  : "Off"}
            </Badge>
          ) : null}
          <Button asChild variant="ghost" size="sm" aria-label="Manage Meta connection">
            <Link href="/setup/connect-meta">
              <ArrowRight />
            </Link>
          </Button>
        </li>
        <li className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[14px] font-medium">
              <Sparkles className="text-accent size-4" aria-hidden /> Claude
            </p>
            <p className="text-caption text-muted">
              {apps.data
                ? `${apps.data.data.length} connected app${apps.data.data.length === 1 ? "" : "s"}`
                : "Checking…"}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" aria-label="Manage Claude connection">
            <Link href="/claude">
              <ArrowRight />
            </Link>
          </Button>
        </li>
      </ul>
    </SectionCard>
  );
}

function Security() {
  const router = useRouter();
  const signOut = useSignOutEverywhere();
  const [open, setOpen] = useState(false);
  return (
    <SectionCard
      icon={<ShieldCheck className="size-5" />}
      title="Security"
      description="Sign out of TreeVook on every phone and computer, including this one. Claude connections are not affected."
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" className="justify-self-start">
            <LogOut /> Sign out everywhere
          </Button>
        </DialogTrigger>
        <DialogContent
          title="Sign out everywhere?"
          description="You'll need your mobile number and a code to sign in again."
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={signOut.isPending}
              onClick={() =>
                signOut.mutate(undefined, {
                  onSuccess: () => router.replace("/login"),
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Sign out everywhere
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <p className="text-caption text-muted flex items-center gap-1.5">
        <Wallet className="size-3.5" aria-hidden /> Budget limits above protect you even if someone
        gets access.
      </p>
    </SectionCard>
  );
}
