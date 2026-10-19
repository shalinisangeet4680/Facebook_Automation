"use client";

import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useGeneratePlan, useSettings } from "@/lib/api/queries";
import type { CampaignBrief, Settings } from "@/lib/api/types";
import { TrackingGoalWarning } from "@/features/meta-ads/tracking";
import { Banner, Skel, Spinner } from "@/features/replyly/ui";

import {
  AudienceStep,
  BudgetStep,
  CreativeStep,
  type Draft,
  type Errors,
  GoalStep,
  LANGUAGES,
  LeadFormStep,
  type Limits,
  PromoteStep,
  type StepId,
  validate,
} from "./new-campaign-steps";
import { privacyFrom } from "./labels";
import { MUTED } from "./plan-sections";
import { StepBar } from "./step-bar";

const ALL_STEPS: { id: StepId; title: string; sub: string }[] = [
  {
    id: "goal",
    title: "What do you want?",
    sub: "Pick the one result that matters most right now.",
  },
  {
    id: "budget",
    title: "How much per day?",
    sub: "Set a daily budget. You can change it before launch.",
  },
  {
    id: "audience",
    title: "Who and where?",
    sub: "Tell us where your customers are and who they are.",
  },
  {
    id: "promote",
    title: "What are you promoting?",
    sub: "Describe your offer and where people should go.",
  },
  {
    id: "form",
    title: "Lead form",
    sub: "Choose what the instant form asks. AI writes the intro and thank-you screen.",
  },
  { id: "image", title: "Add an image", sub: "Pick what the ad shows, or skip and add it later." },
];

const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six"];

function stepsFor(goal: Draft["goal"]) {
  return ALL_STEPS.filter((s) => s.id !== "form" || goal === "instant_leads");
}

const EMPTY: Draft = {
  goal: null,
  dailyBudget: "",
  targeting: {
    countries: [],
    regions: [],
    cities: [],
    ageMin: 18,
    ageMax: 65,
    genders: "all",
    interests: [],
    workPositions: [],
    industries: [],
    behaviors: [],
  },
  ageMin: "",
  ageMax: "",
  audienceNotes: "",
  offer: "",
  landingUrl: "",
  language: "",
  visual: { imageUrl: null, post: null },
  leadForm: {
    questions: ["FULL_NAME", "PHONE", "CITY"],
    privacyPolicyUrl: "",
    button: "website",
    callPhone: "",
    extraQuestions: true,
  },
};

export function prefill(settings: Settings | undefined): Draft {
  if (!settings) return EMPTY;
  const { business, budget } = settings;
  return {
    ...EMPTY,
    goal: budget.goal ?? null,
    dailyBudget: budget.goal ? String(budget.maxDailyBudget) : "",
    offer: business.offer ?? "",
    landingUrl: business.websiteUrl ?? "",
    language: LANGUAGES.some((l) => l.id === business.language) ? (business.language ?? "") : "",
    leadForm: { ...EMPTY.leadForm, privacyPolicyUrl: privacyFrom(business.websiteUrl) },
  };
}

function toBrief(draft: Draft): CampaignBrief {
  const { targeting: t, visual } = draft;
  const post = visual.post;
  return {
    goal: draft.goal!,
    dailyBudget: Math.round(Number(draft.dailyBudget) * 100) / 100,
    locations: {
      countries: t.countries,
      regions: t.regions.map((r) => ({ key: r.key, name: r.name })),
      cities: t.cities.map((c) => ({ key: c.key, name: c.name, radiusKm: c.radiusKm ?? null })),
    },
    ageMin: draft.ageMin ? Number(draft.ageMin) : undefined,
    ageMax: draft.ageMax ? Number(draft.ageMax) : undefined,
    audienceNotes: draft.audienceNotes.trim() || undefined,
    offer: draft.offer.trim(),
    landingUrl: draft.landingUrl.trim() || undefined,
    language: draft.language || undefined,
    creative: post
      ? {
          post: {
            platform: post.platform,
            id: post.id,
            permalink: post.permalink ?? null,
            imageUrl: post.imageUrl ?? null,
            text: post.text ?? null,
          },
        }
      : visual.imageUrl
        ? { imageUrl: visual.imageUrl }
        : undefined,
    leadForm:
      draft.goal === "instant_leads"
        ? {
            questions: draft.leadForm.questions,
            privacyPolicyUrl: draft.leadForm.privacyPolicyUrl.trim(),
            callPhone:
              draft.leadForm.button === "call"
                ? draft.leadForm.callPhone.replace(/[\s-]/g, "")
                : null,
            extraQuestions: draft.leadForm.extraQuestions,
          }
        : undefined,
  };
}

export function NewCampaign() {
  const settings = useSettings();
  if (settings.isPending)
    return (
      <div
        style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 760, width: "100%" }}
      >
        <Skel h={40} w={260} />
        <Skel h={8} />
        <Skel h={320} r={14} />
      </div>
    );
  return <Builder initial={prefill(settings.data)} />;
}

function Builder({ initial }: { initial: Draft }) {
  const router = useRouter();
  const settings = useSettings();
  const generate = useGeneratePlan();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initial);
  const [tried, setTried] = useState<Partial<Record<StepId, boolean>>>({});
  const [done, setDone] = useState(false);

  const limits: Limits | null = settings.data
    ? {
        currency: settings.data.budget.currency,
        maxDailyBudget: settings.data.budget.maxDailyBudget,
        targetCostPerResult: settings.data.budget.targetCostPerResult,
      }
    : null;
  const steps = stepsFor(draft.goal);
  const current = steps[Math.min(step, steps.length - 1)]!;
  const errors: Errors = tried[current.id] ? validate(current.id, draft) : {};
  const last = step === steps.length - 1;
  const working = generate.isPending || done;

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const firstInvalid = () => steps.findIndex((s) => Object.keys(validate(s.id, draft)).length > 0);

  const next = () => {
    if (Object.keys(validate(current.id, draft)).length) {
      setTried((t) => ({ ...t, [current.id]: true }));
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const submit = () => {
    const invalid = firstInvalid();
    if (invalid !== -1) {
      setTried((t) => ({ ...t, [steps[invalid]!.id]: true }));
      setStep(invalid);
      return;
    }
    generate.mutate(toBrief(draft), {
      onSuccess: (plan) => {
        setDone(true);
        router.push(`/campaigns/plans/${plan.id}`);
      },
    });
  };

  if (working) return <Generating />;

  return (
    <div
      className="rp-in"
      style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 760, width: "100%" }}
    >
      <Link
        href="/campaigns?tab=plans"
        className="rp-btn-quiet"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
      >
        <ArrowLeft size={14} /> Campaigns
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 className="rp-serif" style={{ fontSize: 36, lineHeight: 1.05 }}>
          New campaign
        </h1>
        <span style={{ color: "#55534E", fontSize: 13.5 }}>
          Answer {COUNT_WORDS[steps.length]} quick questions. AI builds the full plan, and you check
          it before anything goes live.
        </span>
      </div>

      <StepBar steps={steps} step={step} onGo={(i) => setStep(i)} />

      {generate.isError ? (
        <Banner
          tone="error"
          title="We couldn’t build your plan"
          action={
            <button type="button" className="rp-btn-light" onClick={submit}>
              Try again
            </button>
          }
        >
          {errorMessage(generate.error)} Your answers are still here.
        </Banner>
      ) : null}

      <section className="rp-card" aria-labelledby="step-title" style={{ overflow: "visible" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #EFEDE8" }}>
          <h2 id="step-title" style={{ fontSize: 17, fontWeight: 600 }}>
            {current.title}
          </h2>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{current.sub}</p>
        </div>
        <div style={{ padding: 20 }}>
          {current.id === "goal" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <GoalStep
                value={draft.goal}
                error={errors.goal}
                onChange={(goal) =>
                  update({
                    goal,
                    ...(goal === "instant_leads" && draft.visual.post
                      ? { visual: { imageUrl: null, post: null } }
                      : {}),
                  })
                }
              />
              <TrackingGoalWarning goal={draft.goal} />
            </div>
          ) : current.id === "budget" ? (
            settings.isError ? (
              <Banner
                tone="error"
                title="Couldn’t load your budget limit"
                action={
                  <button
                    type="button"
                    className="rp-btn-light"
                    onClick={() => void settings.refetch()}
                  >
                    Try again
                  </button>
                }
              >
                {errorMessage(settings.error)}
              </Banner>
            ) : (
              <BudgetStep
                value={draft.dailyBudget}
                limits={limits}
                error={errors.budget}
                onChange={(dailyBudget) => update({ dailyBudget })}
              />
            )
          ) : current.id === "audience" ? (
            <AudienceStep draft={draft} errors={errors} onChange={update} />
          ) : current.id === "promote" ? (
            <PromoteStep draft={draft} errors={errors} onChange={update} />
          ) : current.id === "form" ? (
            <LeadFormStep
              form={draft.leadForm}
              errors={errors}
              onChange={(leadForm) => update({ leadForm })}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <CreativeStep
                visual={draft.visual}
                imagesOnly={draft.goal === "instant_leads"}
                onChange={(visual) => update({ visual })}
              />
              <TrackingGoalWarning goal={draft.goal} />
            </div>
          )}
        </div>
      </section>

      <div
        className="rp-card"
        style={{
          position: "sticky",
          bottom: 16,
          zIndex: 10,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 16px 34px -14px rgba(25,25,23,.28)",
        }}
      >
        <button
          type="button"
          className="rp-btn-light"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span style={{ marginLeft: "auto" }} />
        {last ? (
          <button type="button" className="rp-btn" onClick={submit}>
            <Sparkles size={14} /> Generate plan
          </button>
        ) : (
          <button type="button" className="rp-btn" onClick={next}>
            Next <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function Generating() {
  const lines = [
    "Reading your business and past results",
    "Choosing the audience and interests",
    "Writing the ad and checking your budget limit",
  ];
  return (
    <div
      className="rp-in rp-card"
      role="status"
      aria-live="polite"
      style={{
        maxWidth: 560,
        width: "100%",
        margin: "40px auto 0",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      <Spinner size={22} dark />
      <span className="rp-serif" style={{ fontSize: 26 }}>
        Building your plan…
      </span>
      <span style={{ fontSize: 13, color: MUTED }}>This can take up to a minute.</span>
      <ul
        style={{
          listStyle: "none",
          margin: "6px 0 0",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          textAlign: "left",
        }}
      >
        {lines.map((line) => (
          <li
            key={line}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 13,
              color: "#55534E",
            }}
          >
            <Sparkles size={13} color="#0F6B4A" aria-hidden /> {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
