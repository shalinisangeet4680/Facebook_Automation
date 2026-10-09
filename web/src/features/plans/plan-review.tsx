"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Megaphone,
  Rocket,
  Target,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea, inputClass } from "@/components/ui/input";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import {
  useCreatePlanInMeta,
  useDiscardPlan,
  useLaunchPlan,
  useMetaAssets,
  usePlan,
  useSavePlan,
} from "@/lib/api/queries";
import type { CampaignPlan, PlanDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { CTA_LABELS, EVENT_LABELS, GOAL_LABELS, STATUS_LABELS, money, sourceLabel } from "./labels";
import { CreativePicker } from "./creative-picker";
import { AdPreview, InterestsEditor, LocationsEditor, Section } from "./plan-sections";

export function PlanReview() {
  const { id } = useParams<{ id: string }>();
  const plan = usePlan(id);
  if (plan.isPending) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (plan.isError)
    return <ErrorState message={errorMessage(plan.error)} onRetry={() => void plan.refetch()} />;
  return <PlanEditor key={plan.data.updatedAt} detail={plan.data} />;
}

function PlanEditor({ detail }: { detail: PlanDetail }) {
  const [draft, setDraft] = useState<CampaignPlan>(detail.plan);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasVisual = Boolean(draft.creative.imageUrl || draft.creative.post);
  const save = useSavePlan(detail.id);
  const create = useCreatePlanInMeta(detail.id);
  const launch = useLaunchPlan(detail.id);
  const discard = useDiscardPlan(detail.id);
  const assets = useMetaAssets();
  const pageName =
    assets.data?.data.find((a) => a.kind === "page" && a.isPrimary)?.name ?? "Your Page";

  const { options } = detail;
  const editable = detail.status === "draft";
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(detail.plan),
    [draft, detail.plan],
  );
  const goal = options.goals.find((g) => g.name === draft.goal);
  const budgetError =
    draft.dailyBudget > options.maxDailyBudget
      ? `The limit is ${money(options.maxDailyBudget, options.currency)} a day.`
      : draft.dailyBudget <= 0
        ? "Enter a daily budget."
        : null;
  const busy = save.isPending || create.isPending || launch.isPending || discard.isPending;
  const status = STATUS_LABELS[detail.status];

  const set = <K extends keyof CampaignPlan>(key: K, value: CampaignPlan[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setCreative = (patch: Partial<CampaignPlan["creative"]>) =>
    setDraft((d) => ({ ...d, creative: { ...d.creative, ...patch } }));

  const onSave = async () => {
    try {
      await save.mutateAsync(draft);
      toast.success("Plan saved");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onCreate = async () => {
    try {
      if (dirty) await save.mutateAsync(draft);
      await create.mutateAsync(undefined);
      toast.success("Created in Meta. Everything is paused.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="pb-28">
      <Link
        href="/campaigns"
        className="text-small text-muted hover:text-foreground mb-4 inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-4" /> Campaigns
      </Link>

      <div className="mb-6 grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className="text-caption text-muted">{sourceLabel(detail.source)}</span>
        </div>
        {editable ? (
          <input
            aria-label="Campaign name"
            className="text-title hover:bg-surface-muted focus:bg-surface -mx-2 w-full rounded-md bg-transparent px-2 font-semibold tracking-tight outline-none focus:ring-4 focus:ring-[var(--ring)]"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
          />
        ) : (
          <h1 className="text-title font-semibold tracking-tight">{draft.name}</h1>
        )}
        <p className="text-muted max-w-3xl">{draft.summary}</p>
        {draft.expectedResults ? (
          <p className="text-small">
            <span className="text-muted">Expected: </span>
            <strong className="font-medium">{draft.expectedResults}</strong>
          </p>
        ) : null}
      </div>

      {detail.status === "created" || detail.status === "launched" ? (
        <Card className="mb-6">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full",
                detail.status === "launched"
                  ? "bg-success-soft text-success"
                  : "bg-warning-soft text-warning",
              )}
            >
              {detail.status === "launched" ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <Rocket className="size-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {detail.status === "launched"
                  ? "This campaign is live"
                  : "Created in Meta and paused"}
              </p>
              <p className="text-small text-muted">
                {detail.status === "launched"
                  ? "Meta is delivering your ads. Ask Claude how it's doing any time."
                  : "Check it in Ads Manager if you like, then launch when you're ready."}
              </p>
            </div>
            {detail.meta ? (
              <Button asChild variant="secondary">
                <a href={detail.meta.adsManagerUrl} target="_blank" rel="noreferrer">
                  Ads Manager <ExternalLink />
                </a>
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {detail.error && editable ? (
        <div
          role="alert"
          className="border-danger/30 bg-danger-soft text-danger mb-6 rounded-lg border px-4 py-3 text-[14px]"
        >
          Meta rejected the last attempt: {detail.error}
        </div>
      ) : null}

      <fieldset
        disabled={!editable || busy}
        className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Goal" icon={<Target className="size-5" />} reason={draft.reasons.goal}>
            <RadioCardGroup
              value={draft.goal}
              onValueChange={(v) => set("goal", v)}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              aria-label="Campaign goal"
            >
              {options.goals.map((g) => (
                <RadioCard
                  key={g.name}
                  value={g.name}
                  title={GOAL_LABELS[g.name]?.title ?? g.name}
                  description={GOAL_LABELS[g.name]?.description}
                  disabled={!editable}
                />
              ))}
            </RadioCardGroup>
            {goal?.needsPixel ? (
              <Field label="Result to optimise for" hint="Must be an event your Pixel sends.">
                {(p) => (
                  <select
                    {...p}
                    className={inputClass}
                    value={draft.conversionEvent ?? ""}
                    onChange={(e) => set("conversionEvent", e.target.value || null)}
                  >
                    <option value="">Choose an event</option>
                    {options.conversionEvents.map((e) => (
                      <option key={e} value={e}>
                        {EVENT_LABELS[e] ?? e}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            ) : null}
          </Section>

          <Section
            title="Audience"
            icon={<Users className="size-5" />}
            reason={draft.reasons.audience}
          >
            <div className="grid gap-2">
              <p className="text-[14px] font-medium">Locations</p>
              <LocationsEditor
                targeting={draft.targeting}
                onChange={(t) => set("targeting", t)}
                disabled={!editable}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1.4fr]">
              <Field label="Age from">
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min={18}
                    max={65}
                    value={draft.targeting.ageMin}
                    onChange={(e) =>
                      set("targeting", { ...draft.targeting, ageMin: Number(e.target.value) })
                    }
                  />
                )}
              </Field>
              <Field label="Age to">
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min={18}
                    max={65}
                    value={draft.targeting.ageMax}
                    onChange={(e) =>
                      set("targeting", { ...draft.targeting, ageMax: Number(e.target.value) })
                    }
                  />
                )}
              </Field>
              <Field label="Gender">
                {(p) => (
                  <select
                    {...p}
                    className={inputClass}
                    value={draft.targeting.genders}
                    onChange={(e) =>
                      set("targeting", {
                        ...draft.targeting,
                        genders: e.target.value as CampaignPlan["targeting"]["genders"],
                      })
                    }
                  >
                    <option value="all">Everyone</option>
                    <option value="female">Women</option>
                    <option value="male">Men</option>
                  </select>
                )}
              </Field>
            </div>
            <div className="grid gap-2">
              <p className="text-[14px] font-medium">Interests</p>
              <InterestsEditor
                targeting={draft.targeting}
                onChange={(t) => set("targeting", t)}
                disabled={!editable}
              />
            </div>
          </Section>

          <Section
            title="Budget"
            icon={<Wallet className="size-5" />}
            reason={draft.reasons.budget}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={`Daily budget (${options.currency})`}
                error={budgetError}
                hint={`About ${money(Math.round(draft.dailyBudget * 30.4), options.currency)} a month`}
              >
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min={1}
                    step={50}
                    value={draft.dailyBudget}
                    onChange={(e) => set("dailyBudget", Number(e.target.value))}
                  />
                )}
              </Field>
            </div>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section
            title="Ad"
            icon={<Megaphone className="size-5" />}
            reason={draft.reasons.creative}
          >
            <AdPreview pageName={pageName} creative={draft.creative} />
            <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <p className="text-small min-w-0 flex-1">
                {draft.creative.post ? (
                  <>
                    Using your existing{" "}
                    <strong className="font-medium">
                      {draft.creative.post.platform === "facebook" ? "Facebook" : "Instagram"} post
                    </strong>
                    {draft.creative.post.platform === "facebook"
                      ? ". Its own text and image are used."
                      : ". Its image and caption are used, with the link and button below."}
                  </>
                ) : draft.creative.imageUrl ? (
                  "Using an image from your library or link."
                ) : (
                  "No image yet. Pick one from your library or use a post."
                )}
              </p>
              {editable ? (
                <div className="flex gap-2">
                  {draft.creative.post ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setCreative({ post: null })}
                    >
                      Remove post
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setPickerOpen(true)}
                  >
                    Choose image or post
                  </Button>
                </div>
              ) : null}
            </div>
            <CreativePicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              creative={draft.creative}
              onPick={setCreative}
            />
            <Field label="Primary text">
              {(p) => (
                <Textarea
                  {...p}
                  rows={4}
                  value={draft.creative.primaryText}
                  onChange={(e) => setCreative({ primaryText: e.target.value })}
                />
              )}
            </Field>
            {draft.creative.alternatives.length && editable ? (
              <div className="grid gap-2">
                <p className="text-[14px] font-medium">Other versions from Claude</p>
                {draft.creative.alternatives.map((alt, i) => (
                  <div
                    key={i}
                    className="border-border flex items-start gap-3 rounded-lg border p-3"
                  >
                    <p className="flex-1 text-[13px] whitespace-pre-line">{alt}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setCreative({
                          primaryText: alt,
                          alternatives: draft.creative.alternatives.map((a, j) =>
                            j === i ? draft.creative.primaryText : a,
                          ),
                        })
                      }
                    >
                      Use this
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <Field label="Headline">
              {(p) => (
                <Input
                  {...p}
                  value={draft.creative.headline}
                  onChange={(e) => setCreative({ headline: e.target.value })}
                />
              )}
            </Field>
            <Field label="Description" hint="Optional, shown under the headline.">
              {(p) => (
                <Input
                  {...p}
                  value={draft.creative.description ?? ""}
                  onChange={(e) => setCreative({ description: e.target.value || null })}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Website link">
                {(p) => (
                  <Input
                    {...p}
                    type="url"
                    value={draft.creative.linkUrl}
                    onChange={(e) => setCreative({ linkUrl: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Button">
                {(p) => (
                  <select
                    {...p}
                    className={inputClass}
                    value={draft.creative.callToAction}
                    onChange={(e) => setCreative({ callToAction: e.target.value })}
                  >
                    {options.callsToAction.map((c) => (
                      <option key={c} value={c}>
                        {CTA_LABELS[c] ?? c}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <Field
              label="Image link"
              hint={
                draft.creative.imageIdea ? (
                  <span className="inline-flex items-start gap-1">
                    <ImageIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Claude suggests:{" "}
                    {draft.creative.imageIdea}
                  </span>
                ) : (
                  "A public https link to a 1200×628 image."
                )
              }
            >
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  placeholder="https://…"
                  value={draft.creative.imageUrl ?? ""}
                  onChange={(e) => setCreative({ imageUrl: e.target.value || null })}
                />
              )}
            </Field>
          </Section>
        </div>
      </fieldset>

      {detail.status === "draft" || detail.status === "created" ? (
        <div className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:left-[264px]">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-8">
            {detail.status === "draft" ? (
              <>
                <Button
                  variant="ghost"
                  className="text-danger hover:bg-danger-soft hover:text-danger mr-auto"
                  disabled={busy}
                  onClick={() =>
                    discard.mutate(undefined, {
                      onSuccess: () => toast.success("Plan discarded"),
                      onError: (err) => toast.error(errorMessage(err)),
                    })
                  }
                >
                  <Trash2 /> Discard
                </Button>
                <Button
                  variant="secondary"
                  disabled={!dirty || busy || Boolean(budgetError)}
                  loading={save.isPending && !create.isPending}
                  onClick={onSave}
                >
                  Save changes
                </Button>
                <Button
                  disabled={busy || Boolean(budgetError) || !hasVisual}
                  loading={create.isPending}
                  onClick={onCreate}
                  title={!hasVisual ? "Choose an image or post first" : undefined}
                >
                  Create in Meta (paused)
                </Button>
              </>
            ) : (
              <Button onClick={() => setLaunchOpen(true)} disabled={busy}>
                <Rocket /> Launch
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
        <DialogContent
          title="Launch this campaign?"
          description={`Meta will start spending up to ${money(draft.dailyBudget, options.currency)} a day as soon as it's approved.`}
        >
          <ul className="text-small mb-5 grid gap-1.5">
            <li>
              <span className="text-muted">Campaign: </span>
              {draft.name}
            </li>
            <li>
              <span className="text-muted">Goal: </span>
              {GOAL_LABELS[draft.goal]?.title ?? draft.goal}
              {draft.conversionEvent
                ? ` · ${EVENT_LABELS[draft.conversionEvent] ?? draft.conversionEvent}`
                : ""}
            </li>
            <li>
              <span className="text-muted">Budget: </span>
              {money(draft.dailyBudget, options.currency)} a day (about{" "}
              {money(Math.round(draft.dailyBudget * 30.4), options.currency)} a month)
            </li>
          </ul>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Not yet</Button>
            </DialogClose>
            <Button
              loading={launch.isPending}
              onClick={() =>
                launch.mutate(undefined, {
                  onSuccess: () => {
                    setLaunchOpen(false);
                    toast.success("Campaign launched");
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              <Rocket /> Launch now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
