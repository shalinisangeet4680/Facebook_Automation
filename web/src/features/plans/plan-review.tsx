"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
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
import { useMemo, useState, type CSSProperties } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  useCreatePlanInMeta,
  useDiscardPlan,
  useLaunchPlan,
  useMetaAssets,
  usePlan,
  useSavePlan,
  useSettings,
} from "@/lib/api/queries";
import type { CampaignPlan, PlanDetail } from "@/lib/api/types";
import { RpDialogClose, RpDialogContent, RpDialogRoot } from "@/features/replyly/dialog";
import { Banner, Skel, Spinner, useToast } from "@/features/replyly/ui";

import { CreativePicker } from "./creative-picker";
import { CTA_LABELS, EVENT_LABELS, GOAL_LABELS, money, privacyFrom, sourceLabel } from "./labels";
import {
  AdPreview,
  BehaviorsEditor,
  defaultLeadForm,
  Field,
  Group,
  LeadFormEditor,
  LocationsEditor,
  MUTED,
  PlanSection,
  StatusPill,
  WhoEditor,
} from "./plan-sections";

const full: CSSProperties = { width: "100%" };

function cleanPlan(plan: CampaignPlan): CampaignPlan {
  if (!plan.leadForm) return plan;
  return {
    ...plan,
    leadForm: {
      ...plan.leadForm,
      customQuestions: plan.leadForm.customQuestions.map((q) => ({
        ...q,
        options: q.type === "multiple_choice" ? q.options.map((o) => o.trim()).filter(Boolean) : [],
      })),
    },
  };
}
const row: CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap" };

export function PlanReview() {
  const { id } = useParams<{ id: string }>();
  const plan = usePlan(id);
  if (plan.isPending) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Skel h={96} r={14} />
        <Skel h={260} r={14} />
        <Skel h={260} r={14} />
      </div>
    );
  }
  if (plan.isError)
    return (
      <Banner
        tone="error"
        title="Couldn’t load this plan"
        action={
          <button type="button" className="rp-btn-light" onClick={() => void plan.refetch()}>
            Try again
          </button>
        }
      >
        {errorMessage(plan.error)}
      </Banner>
    );
  return <PlanEditor key={plan.data.updatedAt} detail={plan.data} />;
}

function GoalPicker({
  value,
  goals,
  onChange,
}: {
  value: string;
  goals: { name: string }[];
  onChange: (goal: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Campaign goal"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
        gap: 8,
      }}
    >
      {goals.map((g) => {
        const on = g.name === value;
        return (
          <button
            key={g.name}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(g.name)}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "12px 14px",
              borderRadius: 10,
              border: on ? "1.5px solid #0F6B4A" : "1px solid #E6E4DF",
              background: on ? "#F1F5F2" : "#fff",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span
              aria-hidden
              style={{
                marginTop: 2,
                width: 14,
                height: 14,
                borderRadius: 999,
                flexShrink: 0,
                boxSizing: "border-box",
                border: on ? "4px solid #0F6B4A" : "1.5px solid #C9C5BC",
                background: "#fff",
              }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 500, fontSize: 13.5 }}>
                {GOAL_LABELS[g.name]?.title ?? g.name}
              </span>
              {GOAL_LABELS[g.name]?.description ? (
                <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
                  {GOAL_LABELS[g.name]!.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PlanEditor({ detail }: { detail: PlanDetail }) {
  const toast = useToast();
  const [draft, setDraft] = useState<CampaignPlan>(detail.plan);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasVisual = Boolean(draft.creative.imageUrl || draft.creative.post);
  const save = useSavePlan(detail.id);
  const create = useCreatePlanInMeta(detail.id);
  const launch = useLaunchPlan(detail.id);
  const discard = useDiscardPlan(detail.id);
  const assets = useMetaAssets();
  const settings = useSettings();
  const pageName =
    assets.data?.data.find((a) => a.kind === "page" && a.isPrimary)?.name ?? "Your Page";

  const { options } = detail;
  const editable = detail.status === "draft";
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(detail.plan),
    [draft, detail.plan],
  );
  const goal = options.goals.find((g) => g.name === draft.goal);
  const instant = Boolean(goal?.instantForm);
  const ctas = instant ? options.leadFormCallsToAction : options.callsToAction;
  const changeGoal = (name: string) =>
    setDraft((d) => {
      const next = options.goals.find((g) => g.name === name);
      if (!next?.instantForm) return { ...d, goal: name };
      return {
        ...d,
        goal: name,
        conversionEvent: null,
        creative: {
          ...d.creative,
          post: null,
          callToAction: options.leadFormCallsToAction.includes(d.creative.callToAction)
            ? d.creative.callToAction
            : "SIGN_UP",
        },
        leadForm: d.leadForm ?? defaultLeadForm(d, privacyFrom(settings.data?.business.websiteUrl)),
      };
    });
  const budgetError =
    draft.dailyBudget > options.maxDailyBudget
      ? `The limit is ${money(options.maxDailyBudget, options.currency)} a day.`
      : draft.dailyBudget <= 0
        ? "Enter a daily budget."
        : null;
  const busy = save.isPending || create.isPending || launch.isPending || discard.isPending;
  const monthly = money(Math.round(draft.dailyBudget * 30.4), options.currency);

  const set = <K extends keyof CampaignPlan>(key: K, value: CampaignPlan[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setCreative = (patch: Partial<CampaignPlan["creative"]>) =>
    setDraft((d) => ({ ...d, creative: { ...d.creative, ...patch } }));

  const onSave = async () => {
    try {
      await save.mutateAsync(cleanPlan(draft));
      toast("Plan saved");
    } catch (err) {
      toast(errorMessage(err));
    }
  };

  const onCreate = async () => {
    try {
      if (dirty) await save.mutateAsync(cleanPlan(draft));
      await create.mutateAsync(undefined);
      toast("Created in Meta. Everything is paused.");
    } catch (err) {
      toast(errorMessage(err));
    }
  };

  const live = detail.status === "launched";

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Link
        href="/campaigns?tab=plans"
        className="rp-btn-quiet"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
      >
        <ArrowLeft size={14} /> Campaigns
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StatusPill status={detail.status} />
          <span style={{ fontSize: 12.5, color: MUTED }}>{sourceLabel(detail.source)}</span>
        </div>
        {editable ? (
          <input
            aria-label="Campaign name"
            className="rp-serif"
            style={{
              fontSize: 36,
              lineHeight: 1.1,
              width: "calc(100% + 16px)",
              boxSizing: "border-box",
              margin: "0 -8px",
              padding: "2px 8px",
              border: "1px solid transparent",
              borderRadius: 8,
              background: "transparent",
              color: "#191917",
            }}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
          />
        ) : (
          <h1 className="rp-serif" style={{ fontSize: 36, lineHeight: 1.1 }}>
            {draft.name}
          </h1>
        )}
        <p style={{ color: "#55534E", fontSize: 14, lineHeight: 1.55, maxWidth: 720 }}>
          {draft.summary}
        </p>
        {draft.expectedResults ? (
          <p style={{ fontSize: 13.5 }}>
            <span style={{ color: MUTED }}>Expected: </span>
            <span style={{ fontWeight: 500 }}>{draft.expectedResults}</span>
          </p>
        ) : null}
      </div>

      {detail.status === "created" || live ? (
        <div
          className="rp-card"
          style={{ padding: 18, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: live ? "#EAF3EE" : "#FBF3E2",
              color: live ? "#0F6B4A" : "#8A5A00",
            }}
          >
            {live ? <CheckCircle2 size={18} /> : <Rocket size={18} />}
          </span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              flex: "1 1 220px",
              minWidth: 0,
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {live ? "This campaign is live" : "Created in Meta and paused"}
            </span>
            <span style={{ fontSize: 13, color: MUTED }}>
              {live
                ? "Meta is delivering your ads. Ask Claude how it's doing any time."
                : "Check it in Ads Manager if you like, then launch when you're ready."}
            </span>
          </div>
          {detail.meta?.leadFormId ? (
            <Link href={`/leads?campaignId=${detail.meta.campaignId}`} className="rp-btn-light">
              <ClipboardList size={14} /> View leads
            </Link>
          ) : null}
          {detail.meta ? (
            <a
              href={detail.meta.adsManagerUrl}
              target="_blank"
              rel="noreferrer"
              className="rp-btn-light"
            >
              Ads Manager <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      ) : null}

      {detail.error && editable ? (
        <Banner tone="error">Meta rejected the last attempt: {detail.error}</Banner>
      ) : null}

      <fieldset
        disabled={!editable || busy}
        style={{
          margin: 0,
          padding: 0,
          border: "none",
          minWidth: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            flex: "1.35 1 340px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <PlanSection title="Goal" icon={<Target size={18} />} reason={draft.reasons.goal}>
            <GoalPicker value={draft.goal} goals={options.goals} onChange={changeGoal} />
            {goal?.needsPixel ? (
              <Field label="Result to optimise for" hint="Must be an event your Pixel sends.">
                <select
                  className="rp-select"
                  style={full}
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
              </Field>
            ) : null}
          </PlanSection>

          <PlanSection title="Audience" icon={<Users size={18} />} reason={draft.reasons.audience}>
            <Group title="Locations">
              <LocationsEditor
                targeting={draft.targeting}
                onChange={(t) => set("targeting", t)}
                disabled={!editable}
              />
            </Group>
            <div style={row}>
              <Field inRow label="Age from">
                <input
                  className="rp-input"
                  type="number"
                  min={18}
                  max={65}
                  value={draft.targeting.ageMin}
                  onChange={(e) =>
                    set("targeting", { ...draft.targeting, ageMin: Number(e.target.value) })
                  }
                />
              </Field>
              <Field inRow label="Age to">
                <input
                  className="rp-input"
                  type="number"
                  min={18}
                  max={65}
                  value={draft.targeting.ageMax}
                  onChange={(e) =>
                    set("targeting", { ...draft.targeting, ageMax: Number(e.target.value) })
                  }
                />
              </Field>
              <Field inRow label="Gender">
                <select
                  className="rp-select"
                  style={full}
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
              </Field>
            </div>
            <Group title="Who they are" desc="People matching any of these.">
              <WhoEditor
                targeting={draft.targeting}
                onChange={(t) => set("targeting", t)}
                disabled={!editable}
              />
            </Group>
            <Group
              title="And also"
              desc="People must also match one of these, e.g. small business owners, to reach clinic owners."
            >
              <BehaviorsEditor
                targeting={draft.targeting}
                onChange={(t) => set("targeting", t)}
                disabled={!editable}
              />
            </Group>
          </PlanSection>

          <PlanSection title="Budget" icon={<Wallet size={18} />} reason={draft.reasons.budget}>
            <div style={{ maxWidth: 280 }}>
              <Field
                label={`Daily budget (${options.currency})`}
                error={budgetError}
                hint={`About ${monthly} a month`}
              >
                <input
                  className="rp-input"
                  type="number"
                  min={1}
                  step={50}
                  value={draft.dailyBudget}
                  onChange={(e) => set("dailyBudget", Number(e.target.value))}
                />
              </Field>
            </div>
          </PlanSection>
        </div>

        <div
          style={{
            flex: "1 1 300px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <PlanSection title="Ad" icon={<Megaphone size={18} />} reason={draft.reasons.creative}>
            <AdPreview pageName={pageName} creative={draft.creative} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #EFEDE8",
                background: "#FAF9F7",
              }}
            >
              <p style={{ flex: "1 1 180px", minWidth: 0, fontSize: 13, lineHeight: 1.5 }}>
                {draft.creative.post ? (
                  <>
                    Using your existing{" "}
                    <span style={{ fontWeight: 600 }}>
                      {draft.creative.post.platform === "facebook" ? "Facebook" : "Instagram"} post
                    </span>
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {draft.creative.post && !instant ? (
                    <button
                      type="button"
                      className="rp-btn-light"
                      style={{ padding: "6px 10px" }}
                      onClick={() => setCreative({ post: null })}
                    >
                      Remove post
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rp-btn-light"
                    style={{ padding: "6px 10px" }}
                    onClick={() => setPickerOpen(true)}
                  >
                    {instant ? "Choose image" : "Choose image or post"}
                  </button>
                </div>
              ) : null}
            </div>
            <CreativePicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              creative={draft.creative}
              onPick={setCreative}
              imagesOnly={instant}
            />
            <Field label="Primary text">
              <textarea
                className="rp-input rp-textarea"
                rows={4}
                style={{ width: "100%", resize: "vertical", lineHeight: 1.5 }}
                value={draft.creative.primaryText}
                onChange={(e) => setCreative({ primaryText: e.target.value })}
              />
            </Field>
            {draft.creative.alternatives.length && editable ? (
              <Group title="Other versions from Claude">
                {draft.creative.alternatives.map((alt, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      flexWrap: "wrap",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid #EFEDE8",
                    }}
                  >
                    <p
                      style={{
                        flex: "1 1 180px",
                        minWidth: 0,
                        fontSize: 13,
                        lineHeight: 1.5,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {alt}
                    </p>
                    <button
                      type="button"
                      className="rp-btn-light"
                      style={{ padding: "6px 10px" }}
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
                    </button>
                  </div>
                ))}
              </Group>
            ) : null}
            <Field label="Headline">
              <input
                className="rp-input"
                value={draft.creative.headline}
                onChange={(e) => setCreative({ headline: e.target.value })}
              />
            </Field>
            <Field label="Description" hint="Optional, shown under the headline.">
              <input
                className="rp-input"
                value={draft.creative.description ?? ""}
                onChange={(e) => setCreative({ description: e.target.value || null })}
              />
            </Field>
            <div style={row}>
              <Field inRow label={instant ? "Link shown on the ad" : "Website link"}>
                <input
                  className="rp-input"
                  type="url"
                  value={draft.creative.linkUrl}
                  onChange={(e) => setCreative({ linkUrl: e.target.value })}
                />
              </Field>
              <Field inRow label="Button">
                <select
                  className="rp-select"
                  style={full}
                  value={draft.creative.callToAction}
                  onChange={(e) => setCreative({ callToAction: e.target.value })}
                >
                  {ctas.map((c) => (
                    <option key={c} value={c}>
                      {CTA_LABELS[c] ?? c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="Image link"
              hint={
                draft.creative.imageIdea ? (
                  <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 4 }}>
                    <ImageIcon size={13} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden />
                    <span>Claude suggests: {draft.creative.imageIdea}</span>
                  </span>
                ) : (
                  "A public https link to a 1200×628 image."
                )
              }
            >
              <input
                className="rp-input"
                type="url"
                placeholder="https://…"
                value={draft.creative.imageUrl ?? ""}
                onChange={(e) => setCreative({ imageUrl: e.target.value || null })}
              />
            </Field>
          </PlanSection>
          {instant && draft.leadForm ? (
            <PlanSection
              title="Lead form"
              icon={<ClipboardList size={18} />}
              reason="People fill this in without leaving Facebook or Instagram. Meta fills in their details for them, and new leads arrive in TreeVook under Leads."
            >
              <LeadFormEditor
                form={draft.leadForm}
                locales={options.leadFormLocales}
                disabled={!editable}
                onChange={(leadForm) => set("leadForm", leadForm)}
              />
            </PlanSection>
          ) : null}
        </div>
      </fieldset>

      {detail.status === "draft" || detail.status === "created" ? (
        <div
          className="rp-card"
          style={{
            position: "sticky",
            bottom: 16,
            zIndex: 10,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            flexWrap: "wrap",
            boxShadow: "0 16px 34px -14px rgba(25,25,23,.28)",
          }}
        >
          {detail.status === "draft" ? (
            <>
              <button
                type="button"
                className="rp-btn-light rp-btn-danger"
                style={{ marginRight: "auto" }}
                disabled={busy}
                onClick={() =>
                  discard.mutate(undefined, {
                    onSuccess: () => toast("Plan discarded"),
                    onError: (err) => toast(errorMessage(err)),
                  })
                }
              >
                {discard.isPending ? <Spinner dark /> : <Trash2 size={14} />} Discard
              </button>
              <button
                type="button"
                className="rp-btn-light"
                disabled={!dirty || busy || Boolean(budgetError)}
                onClick={() => void onSave()}
              >
                {save.isPending && !create.isPending ? <Spinner dark /> : null}
                Save changes
              </button>
              <button
                type="button"
                className="rp-btn"
                disabled={busy || Boolean(budgetError) || !hasVisual}
                onClick={() => void onCreate()}
                title={!hasVisual ? "Choose an image or post first" : undefined}
              >
                {create.isPending ? <Spinner /> : null}
                Create in Meta (paused)
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rp-btn"
              onClick={() => setLaunchOpen(true)}
              disabled={busy}
            >
              <Rocket size={14} /> Launch
            </button>
          )}
        </div>
      ) : null}

      <RpDialogRoot open={launchOpen} onOpenChange={setLaunchOpen}>
        <RpDialogContent
          title="Launch this campaign?"
          description={`Meta will start spending up to ${money(draft.dailyBudget, options.currency)} a day as soon as it's approved.`}
        >
          <dl
            style={{
              margin: 0,
              display: "flex",
              flexDirection: "column",
              borderRadius: 10,
              border: "1px solid #EFEDE8",
              fontSize: 13,
            }}
          >
            {[
              ["Campaign", draft.name],
              [
                "Goal",
                `${GOAL_LABELS[draft.goal]?.title ?? draft.goal}${
                  draft.conversionEvent
                    ? ` · ${EVENT_LABELS[draft.conversionEvent] ?? draft.conversionEvent}`
                    : ""
                }`,
              ],
              [
                "Budget",
                `${money(draft.dailyBudget, options.currency)} a day (about ${monthly} a month)`,
              ],
            ].map(([k, v], i) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "10px 12px",
                  borderTop: i ? "1px solid #EFEDE8" : "none",
                }}
              >
                <dt style={{ color: MUTED, width: 72, flexShrink: 0 }}>{k}</dt>
                <dd style={{ margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>{v}</dd>
              </div>
            ))}
          </dl>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <RpDialogClose className="rp-btn-light">Not yet</RpDialogClose>
            <button
              type="button"
              className="rp-btn"
              disabled={launch.isPending}
              onClick={() =>
                launch.mutate(undefined, {
                  onSuccess: () => {
                    setLaunchOpen(false);
                    toast("Campaign launched");
                  },
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              {launch.isPending ? <Spinner /> : <Rocket size={14} />} Launch now
            </button>
          </div>
        </RpDialogContent>
      </RpDialogRoot>
    </div>
  );
}
