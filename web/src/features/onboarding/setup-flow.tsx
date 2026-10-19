"use client";

import { ArrowLeft, ArrowRight, Check, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  keys,
  useMetaConnection,
  useOnboarding,
  usePlans,
  useSettings,
  useSkipOnboardingStep,
  useTracking,
  useUpdateBusinessBasics,
  useUpdateGoalBudget,
} from "@/lib/api/queries";
import type { Onboarding, OnboardingStep, Settings } from "@/lib/api/types";
import { TrackingSummary } from "@/features/meta-ads/tracking";
import { MetaConnectOptions } from "@/features/meta/facebook-connect";
import { TokenForm } from "@/features/meta/token-form";
import { MUTED, Pill } from "@/features/meta/ui";
import {
  GoalStep as GoalPicker,
  isHttpsUrl,
  LANGUAGES,
  type Goal,
} from "@/features/plans/new-campaign-steps";
import { money } from "@/features/plans/labels";
import { Field } from "@/features/plans/plan-sections";
import { StepBar } from "@/features/plans/step-bar";
import { Banner, Skel, Spinner, useToast } from "@/features/replyly/ui";

const FORM_ID = "setup-step-form";

const COPY: Record<string, { title: string; sub: string }> = {
  connect_meta: {
    title: "Connect your Meta business",
    sub: "This lets us create and manage ads on Facebook and Instagram for you.",
  },
  choose_assets: {
    title: "Choose your accounts",
    sub: "Tell us which ad account and Facebook Page to use. Instagram and the Pixel are optional.",
  },
  business_profile: {
    title: "Tell us about your business",
    sub: "A few basics so every ad plan fits what you sell and where your customers are.",
  },
  goal_budget: {
    title: "Your goal and budget",
    sub: "What you want from ads and how much you’re comfortable spending. We never go above this.",
  },
  tracking_check: {
    title: "Check your tracking",
    sub: "Your Pixel tells Meta who enquired or bought, so it can find more people like them.",
  },
  campaign_plan: {
    title: "Build your first campaign",
    sub: "Answer a few questions and AI writes a complete plan. Nothing goes live yet.",
  },
  launch: {
    title: "Review and launch",
    sub: "Check the plan, create it in Meta (paused) and launch when you’re ready.",
  },
};

const CATEGORIES = [
  "Clinic or hospital",
  "Coaching or education",
  "Restaurant or café",
  "Salon or spa",
  "Gym or fitness",
  "Real estate",
  "Online shop",
  "Clothing and fashion",
  "Home services",
  "Software or app",
  "Travel",
  "Local shop",
];

const full: CSSProperties = { width: "100%", boxSizing: "border-box" };
const stack: CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };

export function SetupFlow() {
  const onboarding = useOnboarding();
  const params = useSearchParams();
  const toast = useToast();
  const connected = params.get("connected");
  useEffect(() => {
    if (connected) toast("Meta is connected");
  }, [connected, toast]);
  if (onboarding.isPending)
    return (
      <Frame>
        <Skel h={40} w={260} />
        <Skel h={8} />
        <Skel h={320} r={14} />
      </Frame>
    );
  if (onboarding.isError)
    return (
      <Frame>
        <Banner
          tone="error"
          title="Couldn’t load your setup"
          action={
            <button
              type="button"
              className="rp-btn-light"
              onClick={() => void onboarding.refetch()}
            >
              Try again
            </button>
          }
        >
          {errorMessage(onboarding.error)}
        </Banner>
      </Frame>
    );
  return <Flow view={onboarding.data} requested={params.get("step")} />;
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      className="rp-in"
      style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 760, width: "100%" }}
    >
      {children}
    </div>
  );
}

function Flow({ view, requested }: { view: Onboarding; requested: string | null }) {
  const router = useRouter();
  const ids = view.steps.map((s) => s.id);
  const reachable = view.currentStep ? ids.indexOf(view.currentStep) : ids.length - 1;
  const [chosen, setChosen] = useState<string | null>(requested);
  const [lastRequested, setLastRequested] = useState(requested);
  if (requested !== lastRequested) {
    setLastRequested(requested);
    setChosen(requested);
  }
  const wanted = chosen ? ids.indexOf(chosen) : -1;
  const index = wanted !== -1 && wanted <= reachable ? wanted : reachable;
  const step = view.steps[index]!;
  const copy = COPY[step.id] ?? { title: step.title, sub: step.description };
  const done = step.status === "completed";
  const last = index === ids.length - 1;

  const go = (i: number) => {
    setChosen(ids[i]!);
    router.replace(`/setup/start?step=${ids[i]}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => (last ? router.push("/setup") : go(index + 1));
  const usesForm = step.id === "business_profile" || step.id === "goal_budget";

  return (
    <Frame>
      <Link
        href="/setup"
        className="rp-btn-quiet"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
      >
        <ArrowLeft size={14} /> Overview
      </Link>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 className="rp-serif" style={{ fontSize: 36, lineHeight: 1.05 }}>
          Get set up
        </h1>
        <span style={{ color: "#55534E", fontSize: 13.5 }}>
          {view.totalCount} short steps to your first campaign. Your progress is saved, so you can
          stop and come back any time.
        </span>
      </div>

      <StepBar
        steps={view.steps}
        step={index}
        onGo={go}
        canGo={(i) => i <= reachable}
        label={step.title}
      />

      {view.isComplete ? (
        <Banner tone="info" title="You’re all set">
          Every setup step is done. Your overview shows how your ads are doing.
        </Banner>
      ) : null}

      <section
        className="rp-card"
        aria-labelledby="setup-step-title"
        style={{ overflow: "visible" }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #EFEDE8",
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 260px" }}>
            <h2 id="setup-step-title" style={{ fontSize: 17, fontWeight: 600 }}>
              {copy.title}
            </h2>
            <p style={{ fontSize: 13, color: MUTED }}>{copy.sub}</p>
          </div>
          {done ? (
            <Pill tone={step.skipped ? "warn" : "success"}>
              {step.skipped ? "Skipped" : "Done"}
            </Pill>
          ) : null}
        </div>
        <div style={{ padding: 20 }}>
          <StepBody
            step={step}
            goal={view.goal}
            onSaved={() => go(Math.min(index + 1, ids.length - 1))}
            onSkipped={() => go(index + 1)}
          />
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
          disabled={index === 0}
          onClick={() => go(Math.max(0, index - 1))}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span style={{ marginLeft: "auto" }} />
        {usesForm ? (
          <SaveButton />
        ) : (
          <button
            type="button"
            className="rp-btn"
            disabled={!done}
            title={done ? undefined : "Finish this step to continue"}
            onClick={next}
          >
            {last ? "Finish" : "Next"} <ArrowRight size={14} />
          </button>
        )}
      </div>
    </Frame>
  );
}

function SaveButton() {
  return (
    <button type="submit" form={FORM_ID} className="rp-btn">
      Save and continue <ArrowRight size={14} />
    </button>
  );
}

function StepBody({
  step,
  goal,
  onSaved,
  onSkipped,
}: {
  step: OnboardingStep;
  goal: Onboarding["goal"];
  onSaved: () => void;
  onSkipped: () => void;
}) {
  switch (step.id) {
    case "connect_meta":
      return <ConnectStep />;
    case "choose_assets":
      return <AccountsStep />;
    case "business_profile":
      return (
        <WithSettings>
          {(settings) => <BasicsStep settings={settings} onSaved={onSaved} />}
        </WithSettings>
      );
    case "goal_budget":
      return (
        <WithSettings>
          {(settings) => <GoalBudgetStep settings={settings} onSaved={onSaved} />}
        </WithSettings>
      );
    case "tracking_check":
      return <TrackingStep step={step} goal={goal} onSkipped={onSkipped} />;
    case "campaign_plan":
      return <FirstCampaignStep done={step.status === "completed"} />;
    default:
      return <LaunchStep done={step.status === "completed"} />;
  }
}

function WithSettings({ children }: { children: (settings: Settings) => ReactNode }) {
  const settings = useSettings();
  if (settings.isPending) return <Skel h={260} r={12} />;
  if (settings.isError)
    return (
      <Banner
        tone="error"
        title="Couldn’t load your settings"
        action={
          <button type="button" className="rp-btn-light" onClick={() => void settings.refetch()}>
            Try again
          </button>
        }
      >
        {errorMessage(settings.error)}
      </Banner>
    );
  return <>{children(settings.data)}</>;
}

function Done({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 14,
        borderRadius: 12,
        background: "#F1F5F2",
        color: "#0F3D2C",
      }}
    >
      <CheckCircle2 size={20} color="#0F6B4A" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
      <div
        style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, lineHeight: 1.5 }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        {children}
      </div>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol
      style={{
        margin: 0,
        paddingLeft: 18,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 13,
        color: "#55534E",
        lineHeight: 1.5,
      }}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

function ConnectStep() {
  const connection = useMetaConnection();
  const client = useQueryClient();
  const params = useSearchParams();
  const error = params.get("error");
  if (connection.isPending) return <Skel h={120} r={12} />;
  if (connection.data?.status === "active")
    return (
      <div style={stack}>
        <Done title="Meta is connected">
          {connection.data.method === "facebook_login"
            ? "Connected with Facebook"
            : "Connected with a system user token"}{" "}
          as {connection.data.systemUser?.name ?? "your system user"}.
        </Done>
        <Link
          href="/setup/connect-meta"
          className="rp-btn-quiet"
          style={{ alignSelf: "flex-start" }}
        >
          Manage connection
        </Link>
      </div>
    );
  return (
    <div style={stack}>
      {error ? (
        <Banner tone="error" title="Facebook sign-in didn’t finish">
          {error}
        </Banner>
      ) : connection.data?.status === "invalid" ? (
        <Banner tone="warn" title="Your Meta connection stopped working">
          Connect again to keep going.
        </Banner>
      ) : null}
      <MetaConnectOptions
        bare
        advanced={
          <div style={stack}>
            <Steps
              items={[
                "Open Meta Business settings and create a system user. Our guide shows every click.",
                "Give it your ad account, Facebook Page and Pixel.",
                "Create a token and paste it here. It takes about five minutes.",
              ]}
            />
            <Link
              href="/setup/connect-meta"
              className="rp-btn-light"
              style={{ alignSelf: "flex-start" }}
            >
              Open the step-by-step guide <ArrowRight size={14} />
            </Link>
            <TokenForm onConnected={(next) => client.setQueryData(keys.connection, next)} />
          </div>
        }
      />
    </div>
  );
}

function AccountsStep() {
  const connection = useMetaConnection();
  if (connection.isPending) return <Skel h={160} r={12} />;
  const data = connection.data;
  if (data?.status !== "active")
    return (
      <Banner tone="warn" title="Connect Meta first">
        Once Meta is connected, your ad accounts and Pages show up here.
      </Banner>
    );
  const primary = (kind: string) =>
    data.assets.find((a) => a.kind === kind && a.isPrimary)?.name ?? null;
  const rows: [string, string | null, boolean][] = [
    ["Ad account", primary("ad_account"), true],
    ["Facebook Page", primary("page"), true],
    ["Instagram", primary("instagram"), false],
    ["Pixel", primary("dataset"), false],
  ];
  const ready = rows.every(([, value, required]) => !required || value);
  return (
    <div style={stack}>
      <dl
        style={{
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
          gap: 10,
        }}
      >
        {rows.map(([label, value, required]) => (
          <div
            key={label}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #E6E4DF",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
            }}
          >
            <dt className="rp-label">{label}</dt>
            <dd
              style={{
                margin: 0,
                fontSize: 13.5,
                fontWeight: 500,
                overflowWrap: "anywhere",
                color: value ? "#191917" : required ? "#B42318" : MUTED,
              }}
            >
              {value ?? (required ? "Not chosen" : "None")}
            </dd>
          </div>
        ))}
      </dl>
      <Link
        href="/setup/accounts"
        className={ready ? "rp-btn-light" : "rp-btn"}
        style={{ alignSelf: "flex-start" }}
      >
        {ready ? "Change accounts" : "Choose accounts"} <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function withHttps(value: string) {
  const v = value.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v.replace(/^http:\/\//i, "https://") : `https://${v}`;
}

function BasicsStep({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const toast = useToast();
  const save = useUpdateBusinessBasics();
  const b = settings.business;
  const [form, setForm] = useState({
    websiteUrl: b.websiteUrl ?? "",
    offer: b.offer ?? "",
    area: b.area ?? "",
    category: b.category ?? "",
    language: b.language ?? "English",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const url = withHttps(form.websiteUrl);
    const found: Record<string, string> = {};
    if (url && !isHttpsUrl(url)) found.websiteUrl = "That doesn’t look like a website address.";
    if (form.offer.trim().length < 3) found.offer = "Tell us in a line what you sell.";
    if (form.area.trim().length < 2) found.area = "Add the main city or area you serve.";
    if (form.category.trim().length < 2) found.category = "Pick or type your type of business.";
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate(
      {
        websiteUrl: url || null,
        offer: form.offer.trim(),
        area: form.area.trim(),
        category: form.category.trim(),
        language: form.language,
      },
      {
        onSuccess: () => {
          toast("Business basics saved");
          onSaved();
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate style={{ ...stack, gap: 18 }}>
      <Field
        label="Website (optional)"
        error={errors.websiteUrl}
        hint="Where people can learn more or buy. Leave empty if you don’t have one."
      >
        <input
          className="rp-input"
          type="url"
          inputMode="url"
          placeholder="https://"
          autoComplete="url"
          style={full}
          value={form.websiteUrl}
          aria-invalid={Boolean(errors.websiteUrl)}
          onChange={(e) => set({ websiteUrl: e.target.value })}
        />
      </Field>
      <Field
        label="What do you sell?"
        error={errors.offer}
        hint="One or two lines, e.g. “Skin and hair treatments for women in Patna”."
      >
        <textarea
          className="rp-input rp-textarea"
          rows={2}
          maxLength={300}
          style={{ ...full, resize: "vertical", lineHeight: 1.5 }}
          value={form.offer}
          aria-invalid={Boolean(errors.offer)}
          onChange={(e) => set({ offer: e.target.value })}
        />
      </Field>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Field inRow label="Main city or area" error={errors.area}>
          <input
            className="rp-input"
            placeholder="e.g. Patna"
            maxLength={120}
            style={full}
            value={form.area}
            aria-invalid={Boolean(errors.area)}
            onChange={(e) => set({ area: e.target.value })}
          />
        </Field>
        <Field inRow label="Type of business" error={errors.category}>
          <input
            className="rp-input"
            list="setup-categories"
            placeholder="e.g. Clinic or hospital"
            maxLength={80}
            style={full}
            value={form.category}
            aria-invalid={Boolean(errors.category)}
            onChange={(e) => set({ category: e.target.value })}
          />
        </Field>
        <datalist id="setup-categories">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <Field label="Language for your ads" hint="AI writes your ad text in this language.">
        <select
          className="rp-select"
          style={{ ...full, maxWidth: 260 }}
          value={form.language}
          onChange={(e) => set({ language: e.target.value })}
        >
          {LANGUAGES.filter((l) => l.id).map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </Field>
      {save.isPending ? (
        <span style={{ display: "inline-flex", gap: 8, fontSize: 13, color: MUTED }}>
          <Spinner dark /> Saving…
        </span>
      ) : null}
    </form>
  );
}

function GoalBudgetStep({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const toast = useToast();
  const save = useUpdateGoalBudget();
  const budget = settings.budget;
  const [goal, setGoal] = useState<Goal | null>(budget.goal);
  const [daily, setDaily] = useState(budget.goal ? String(budget.maxDailyBudget) : "");
  const [monthly, setMonthly] = useState(budget.monthlyBudget ? String(budget.monthlyBudget) : "");
  const [target, setTarget] = useState(
    budget.targetCostPerResult ? String(budget.targetCostPerResult) : "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const currency = budget.currency;
  const dailyN = Number(daily);
  const picks = [300, 500, 1000, 2000].filter((n) => n <= budget.platformMaxDailyBudget);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    const monthlyN = monthly.trim() ? Number(monthly) : null;
    const targetN = target.trim() ? Number(target) : null;
    if (!goal) found.goal = "Pick what you want most from your ads.";
    if (!daily.trim() || !Number.isFinite(dailyN) || dailyN <= 0)
      found.daily = "Enter how much you’re comfortable spending a day.";
    else if (dailyN > budget.platformMaxDailyBudget)
      found.daily = `The most you can set is ${money(budget.platformMaxDailyBudget, currency)} a day.`;
    if (monthlyN !== null && (!Number.isFinite(monthlyN) || monthlyN <= 0))
      found.monthly = "Enter a monthly amount above zero, or leave it empty.";
    else if (monthlyN !== null && !found.daily && monthlyN < dailyN)
      found.monthly = "The monthly cap should be at least your daily budget.";
    if (targetN !== null && (!Number.isFinite(targetN) || targetN <= 0))
      found.target = "Enter an amount above zero, or leave it empty.";
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate(
      {
        goal: goal!,
        dailyBudget: Math.round(dailyN * 100) / 100,
        monthlyBudget: monthlyN,
        targetCostPerResult: targetN,
      },
      {
        onSuccess: () => {
          toast("Goal and budget saved");
          onSaved();
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate style={{ ...stack, gap: 22 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="rp-label">What do you want most from your ads?</span>
        <GoalPicker value={goal} error={errors.goal} onChange={setGoal} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field
          label={`Comfortable daily budget (${currency})`}
          error={errors.daily}
          hint="Your daily limit. Campaigns can’t be set above it without changing Settings."
        >
          <input
            className="rp-input"
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            style={{ ...full, fontSize: 18, padding: "10px 12px", maxWidth: 260 }}
            value={daily}
            aria-invalid={Boolean(errors.daily)}
            onChange={(e) => setDaily(e.target.value)}
          />
        </Field>
        {picks.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {picks.map((n) => (
              <button
                key={n}
                type="button"
                className="rp-chip"
                aria-pressed={dailyN === n}
                style={dailyN === n ? { borderColor: "#0F6B4A", background: "#F1F5F2" } : undefined}
                onClick={() => setDaily(String(n))}
              >
                {money(n, currency)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Field
          inRow
          label={`Monthly cap (${currency}, optional)`}
          error={errors.monthly}
          hint={
            dailyN > 0
              ? `At your daily budget a month is about ${money(Math.round(dailyN * 30.4), currency)}.`
              : "We warn you before a change would go over it."
          }
        >
          <input
            className="rp-input"
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            style={full}
            value={monthly}
            aria-invalid={Boolean(errors.monthly)}
            onChange={(e) => setMonthly(e.target.value)}
          />
        </Field>
        <Field
          inRow
          label={`Target cost per result (${currency}, optional)`}
          error={errors.target}
          hint="What one enquiry or sale is worth to you. Used for suggestions."
        >
          <input
            className="rp-input"
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            style={full}
            value={target}
            aria-invalid={Boolean(errors.target)}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
      </div>
      {save.isPending ? (
        <span style={{ display: "inline-flex", gap: 8, fontSize: 13, color: MUTED }}>
          <Spinner dark /> Saving…
        </span>
      ) : null}
    </form>
  );
}

function TrackingStep({
  step,
  goal,
  onSkipped,
}: {
  step: OnboardingStep;
  goal: Onboarding["goal"];
  onSkipped: () => void;
}) {
  const toast = useToast();
  const onboarding = useOnboarding();
  const connection = useMetaConnection();
  const connected = connection.data?.status === "active";
  const tracking = useTracking(connected);
  const skip = useSkipOnboardingStep();
  const needs = goal === "leads" || goal === "sales";

  if (!goal)
    return (
      <Banner tone="warn" title="Choose your goal first">
        Tracking depends on what you want from your ads. Go back one step to pick a goal.
      </Banner>
    );

  const checkAgain = () => {
    void tracking.refetch();
    void onboarding.refetch();
  };

  return (
    <div style={{ ...stack, gap: 18 }}>
      {!needs ? (
        <Done title="Your goal doesn’t need Pixel tracking">
          Website visits and reach are counted by Meta on its own. You can set up a Pixel later for
          enquiries or sales.
        </Done>
      ) : step.status === "completed" && !step.skipped ? (
        <Done title="Tracking is ready">
          Your Pixel records the results this goal needs, so Meta can find more people like your
          customers.
        </Done>
      ) : null}
      {!connected ? (
        <Banner tone="warn" title="Connect Meta first">
          We check your Pixel through your Meta connection.
        </Banner>
      ) : tracking.isPending ? (
        <Skel h={200} r={12} />
      ) : tracking.isError ? (
        <Banner tone="error" title="Couldn’t check your Pixel">
          {errorMessage(tracking.error)}
        </Banner>
      ) : (
        <TrackingSummary report={tracking.data} goal={goal} limit={6} />
      )}
      {needs && step.status !== "completed" ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="rp-btn-light"
            disabled={tracking.isFetching || onboarding.isFetching}
            onClick={checkAgain}
          >
            {tracking.isFetching ? <Spinner dark /> : <RefreshCw size={14} />}
            Check again
          </button>
          <button
            type="button"
            className="rp-btn-quiet"
            disabled={skip.isPending}
            onClick={() =>
              skip.mutate("tracking_check", {
                onSuccess: () => {
                  toast("Skipped for now. Fix tracking any time from the overview.");
                  onSkipped();
                },
                onError: (err) => toast(errorMessage(err)),
              })
            }
          >
            {skip.isPending ? <Spinner dark /> : null}
            Skip for now
          </button>
          <span style={{ fontSize: 12.5, color: MUTED, flex: "1 1 220px" }}>
            Changes can take up to an hour to show here after you fix your website.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function FirstCampaignStep({ done }: { done: boolean }) {
  const settings = useSettings();
  const budget = settings.data?.budget;
  return (
    <div style={stack}>
      {done ? (
        <Done title="Your first plan is ready">You can build more plans any time.</Done>
      ) : (
        <Steps
          items={[
            "Your goal, budget and business basics are already filled in.",
            "Add where your customers are and pick an image.",
            "AI writes the ad and explains every choice. You check it before anything goes live.",
          ]}
        />
      )}
      {budget?.goal ? (
        <span style={{ fontSize: 13, color: MUTED }}>
          Starting with {money(budget.maxDailyBudget, budget.currency)} a day.
        </span>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/campaigns/new" className={done ? "rp-btn-light" : "rp-btn"}>
          {done ? "Build another plan" : "Build my first campaign"} <ArrowRight size={14} />
        </Link>
        {done ? (
          <Link href="/campaigns?tab=plans" className="rp-btn-quiet">
            See your plans
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function LaunchStep({ done }: { done: boolean }) {
  const plans = usePlans();
  const draft = plans.data?.data.find((p) => p.status === "draft");
  const live = plans.data?.data.find((p) => p.status === "created" || p.status === "launched");
  if (done)
    return (
      <div style={stack}>
        <Done title="Your campaign is in Meta">
          {live
            ? `“${live.name}” is ${live.status === "launched" ? "live" : "created and paused"}.`
            : null}{" "}
          Watch results on the overview; suggestions arrive every morning.
        </Done>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {live ? (
            <Link href={`/campaigns/plans/${live.id}`} className="rp-btn-light">
              Open the plan
            </Link>
          ) : null}
          <Link href="/setup" className="rp-btn">
            <Check size={14} /> Go to overview
          </Link>
        </div>
      </div>
    );
  return (
    <div style={stack}>
      <Steps
        items={[
          "Open your plan and check the ad preview, audience and budget.",
          "Press Create in Meta. Everything is created paused, so nothing spends yet.",
          "Launch when you’re happy. You can pause any time.",
        ]}
      />
      {plans.isPending ? (
        <Skel h={40} w={200} r={10} />
      ) : draft ? (
        <Link
          href={`/campaigns/plans/${draft.id}`}
          className="rp-btn"
          style={{ alignSelf: "flex-start" }}
        >
          Review “{draft.name}” <ArrowRight size={14} />
        </Link>
      ) : (
        <Link href="/campaigns?tab=plans" className="rp-btn" style={{ alignSelf: "flex-start" }}>
          See your plans <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
