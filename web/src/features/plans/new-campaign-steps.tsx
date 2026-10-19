"use client";

import {
  ClipboardList,
  Image as ImageIcon,
  Megaphone,
  MousePointerClick,
  ShoppingBag,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";

import type { CampaignPlan } from "@/lib/api/types";
import { Seg, Skel, Toggle } from "@/features/replyly/ui";

import { SaveAudienceButton, SavedAudiencePicker } from "./audiences";
import { CreativePicker, VideoFill, displaySrc } from "./creative-picker";
import { PREFILL_QUESTIONS, QUESTION_LABELS, money } from "./labels";
import { Field, Group, LocationsEditor, MUTED } from "./plan-sections";

export type Goal = "traffic" | "leads" | "instant_leads" | "sales" | "awareness";
export type Question = (typeof PREFILL_QUESTIONS)[number];

export interface LeadFormDraft {
  questions: Question[];
  privacyPolicyUrl: string;
  button: "website" | "call";
  callPhone: string;
  extraQuestions: boolean;
}

export type StepId = "goal" | "budget" | "audience" | "promote" | "form" | "image";
type Targeting = CampaignPlan["targeting"];
type Creative = CampaignPlan["creative"];

export interface Draft {
  goal: Goal | null;
  dailyBudget: string;
  targeting: Targeting;
  ageMin: string;
  ageMax: string;
  audienceNotes: string;
  offer: string;
  landingUrl: string;
  language: string;
  visual: Pick<Creative, "imageUrl" | "post" | "videoUrl">;
  leadForm: LeadFormDraft;
  audience: { id: string; name: string } | null;
  variants: boolean;
}

export interface Limits {
  currency: string;
  maxDailyBudget: number;
  targetCostPerResult: number | null;
}

export type Errors = Partial<
  Record<
    "goal" | "budget" | "where" | "ages" | "offer" | "url" | "questions" | "privacy" | "phone",
    string
  >
>;

export const WEBSITE_GOALS: Goal[] = ["traffic", "sales"];

export const GOALS: { id: Goal; title: string; text: string; icon: LucideIcon }[] = [
  {
    id: "traffic",
    title: "Get website visits",
    text: "Bring people to your website to look around. Good for a new site, menu or catalogue.",
    icon: MousePointerClick,
  },
  {
    id: "leads",
    title: "Get enquiries",
    text: "People leave their details or sign up on your website so you can follow up.",
    icon: UserPlus,
  },
  {
    id: "instant_leads",
    title: "Get leads on Facebook",
    text: "People fill a short form inside Facebook or Instagram, no website needed. Leads arrive in TreeVook.",
    icon: ClipboardList,
  },
  {
    id: "sales",
    title: "Get online sales",
    text: "People buy from your online shop. Works best when your site already takes orders.",
    icon: ShoppingBag,
  },
  {
    id: "awareness",
    title: "Get known nearby",
    text: "Show your ad to as many local people as possible so they remember your name.",
    icon: Megaphone,
  },
];

export const LANGUAGES = [
  { id: "", label: "Let AI choose" },
  ...[
    "English",
    "Hindi",
    "Hinglish",
    "Bengali",
    "Marathi",
    "Tamil",
    "Telugu",
    "Gujarati",
    "Kannada",
    "Malayalam",
    "Punjabi",
  ].map((l) => ({ id: l, label: l })),
];

const full: CSSProperties = { width: "100%", boxSizing: "border-box" };
const row: CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap" };

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function validate(step: StepId, draft: Draft): Errors {
  const errors: Errors = {};
  if (step === "goal" && !draft.goal) errors.goal = "Pick what you want from this campaign.";
  if (step === "budget") {
    const budget = Number(draft.dailyBudget);
    if (!draft.dailyBudget.trim() || !Number.isFinite(budget) || budget <= 0)
      errors.budget = "Enter how much you want to spend each day.";
  }
  if (step === "audience") {
    const t = draft.targeting;
    if (!t.cities.length && !t.regions.length && !t.countries.length)
      errors.where = "Add at least one city or state.";
    const min = draft.ageMin ? Number(draft.ageMin) : 18;
    const max = draft.ageMax ? Number(draft.ageMax) : 65;
    if ([min, max].some((a) => !Number.isInteger(a) || a < 18 || a > 65))
      errors.ages = "Ages must be whole numbers from 18 to 65.";
    else if (min > max) errors.ages = "The youngest age must be lower than the oldest.";
  }
  if (step === "promote") {
    if (draft.offer.trim().length < 3) errors.offer = "Tell us what you want to promote.";
    const url = draft.landingUrl.trim();
    if (url && !isHttpsUrl(url))
      errors.url = "Use the full address starting with https://, like https://example.com.";
    else if (!url && draft.goal && WEBSITE_GOALS.includes(draft.goal))
      errors.url = "Add the page people should land on. This goal needs your website.";
  }
  if (step === "form") {
    const form = draft.leadForm;
    if (!form.questions.includes("PHONE") && !form.questions.includes("EMAIL"))
      errors.questions = "Ask for a phone number or an email so you can contact the lead.";
    if (!isHttpsUrl(form.privacyPolicyUrl.trim()))
      errors.privacy = "Add your privacy policy link, starting with https://. Meta requires it.";
    if (form.button === "call" && !/^\+[1-9]\d{6,14}$/.test(form.callPhone.replace(/[\s-]/g, "")))
      errors.phone = "Use the full number with country code, like +919876543210.";
  }
  return errors;
}

export function GoalStep({
  value,
  error,
  onChange,
}: {
  value: Goal | null;
  error?: string;
  onChange: (goal: Goal) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        role="radiogroup"
        aria-label="Campaign goal"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 10,
        }}
      >
        {GOALS.map((g) => {
          const on = g.id === value;
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(g.id)}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: 16,
                borderRadius: 12,
                border: on ? "1.5px solid #0F6B4A" : "1px solid #E6E4DF",
                background: on ? "#F1F5F2" : "#fff",
                textAlign: "left",
                cursor: "pointer",
                color: "#191917",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: on ? "#0F6B4A" : "#F4F2EE",
                  color: on ? "#fff" : "#0F6B4A",
                }}
              >
                <Icon size={17} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{g.title}</span>
                <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>{g.text}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}

export function BudgetStep({
  value,
  limits,
  error,
  onChange,
}: {
  value: string;
  limits: Limits | null;
  error?: string;
  onChange: (value: string) => void;
}) {
  if (!limits) return <Skel h={120} r={12} />;
  const budget = Number(value);
  const valid = Number.isFinite(budget) && budget > 0;
  const capped = valid && budget > limits.maxDailyBudget;
  const daily = capped ? limits.maxDailyBudget : budget;
  const picks = [300, 500, 1000, 2000].filter((n) => n <= limits.maxDailyBudget);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field
        label={`Daily budget (${limits.currency})`}
        error={error}
        hint={`Your limit is ${money(limits.maxDailyBudget, limits.currency)} a day. You can change it in Settings.`}
      >
        <input
          className="rp-input"
          type="number"
          inputMode="decimal"
          min={1}
          step="any"
          style={{ ...full, fontSize: 18, padding: "10px 12px", maxWidth: 260 }}
          value={value}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
      {picks.length ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {picks.map((n) => (
            <button
              key={n}
              type="button"
              className="rp-chip"
              aria-pressed={budget === n}
              style={budget === n ? { borderColor: "#0F6B4A", background: "#F1F5F2" } : undefined}
              onClick={() => onChange(String(n))}
            >
              {money(n, limits.currency)}
            </button>
          ))}
        </div>
      ) : null}
      {capped ? (
        <p
          role="status"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#FBF3E2",
            color: "#8A5A00",
            fontSize: 13,
          }}
        >
          That’s above your limit, so the plan will use{" "}
          {money(limits.maxDailyBudget, limits.currency)} a day.
        </p>
      ) : null}
      {valid ? (
        <dl style={{ ...row, margin: 0, gap: 24 }}>
          <Stat label="About a month" value={money(Math.round(daily * 30.4), limits.currency)} />
          {limits.targetCostPerResult ? (
            <Stat
              label="Results a week at your target"
              value={`~${Math.max(1, Math.round((daily / limits.targetCostPerResult) * 7))}`}
            />
          ) : null}
        </dl>
      ) : null}
      <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
        Meta never spends more than this in a day on average. Nothing is spent until you launch the
        campaign.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <dt className="rp-label">{label}</dt>
      <dd className="rp-mono" style={{ margin: 0, fontSize: 18 }}>
        {value}
      </dd>
    </div>
  );
}

export function AudienceStep({
  draft,
  errors,
  onChange,
}: {
  draft: Draft;
  errors: Errors;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const ageNumber = (value: string, fallback: number) => (value ? Number(value) : fallback);
  const current = {
    ...draft.targeting,
    ageMin: ageNumber(draft.ageMin, 18),
    ageMax: ageNumber(draft.ageMax, 65),
  };
  const hasPlace = Boolean(
    draft.targeting.cities.length ||
    draft.targeting.regions.length ||
    draft.targeting.countries.length,
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {draft.audience ? (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            padding: "10px 12px",
            borderRadius: 10,
            background: "#F1F5F2",
            color: "#0F3D2C",
            fontSize: 13,
          }}
        >
          <span style={{ flex: "1 1 220px", minWidth: 0 }}>
            Using your saved audience <span style={{ fontWeight: 600 }}>{draft.audience.name}</span>
            . Its interests and other settings are used too.
          </span>
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "4px 10px" }}
            onClick={() => onChange({ audience: null })}
          >
            Stop using it
          </button>
        </div>
      ) : (
        <SavedAudiencePicker
          onPick={(a) =>
            onChange({
              audience: { id: a.id, name: a.name },
              targeting: {
                ...draft.targeting,
                countries: a.targeting.countries,
                regions: a.targeting.regions,
                cities: a.targeting.cities,
              },
              ageMin: String(a.targeting.ageMin),
              ageMax: String(a.targeting.ageMax),
            })
          }
        />
      )}
      <Group title="Where are your customers?" desc="Search for the cities or states you serve.">
        <LocationsEditor
          targeting={draft.targeting}
          onChange={(targeting) => onChange({ targeting, audience: null })}
          disabled={false}
          emptyText="No places added yet."
        />
        {errors.where ? <ErrorText>{errors.where}</ErrorText> : null}
      </Group>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={row}>
          <Field inRow label="Youngest age">
            <input
              className="rp-input"
              type="number"
              inputMode="numeric"
              min={18}
              max={65}
              placeholder="18"
              style={full}
              value={draft.ageMin}
              onChange={(e) => onChange({ ageMin: e.target.value, audience: null })}
            />
          </Field>
          <Field inRow label="Oldest age">
            <input
              className="rp-input"
              type="number"
              inputMode="numeric"
              min={18}
              max={65}
              placeholder="65"
              style={full}
              value={draft.ageMax}
              onChange={(e) => onChange({ ageMax: e.target.value, audience: null })}
            />
          </Field>
        </div>
        {errors.ages ? (
          <ErrorText>{errors.ages}</ErrorText>
        ) : (
          <span style={{ fontSize: 12, color: MUTED }}>Leave empty to reach every adult.</span>
        )}
      </div>
      <Field
        label="Who are they? (optional)"
        hint="In your own words, e.g. “women 25–45 interested in skincare”. AI turns this into Meta interests."
      >
        <textarea
          className="rp-input rp-textarea"
          rows={3}
          maxLength={500}
          style={{ ...full, resize: "vertical", lineHeight: 1.5 }}
          value={draft.audienceNotes}
          onChange={(e) => onChange({ audienceNotes: e.target.value })}
        />
      </Field>
      {draft.audience ? null : (
        <SaveAudienceButton targeting={current} disabled={!hasPlace || Boolean(errors.ages)} />
      )}
    </div>
  );
}

export function PromoteStep({
  draft,
  errors,
  onChange,
}: {
  draft: Draft;
  errors: Errors;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const needsUrl = Boolean(draft.goal && WEBSITE_GOALS.includes(draft.goal));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Field
        label="What do you want to promote?"
        error={errors.offer}
        hint="A product, service or offer, e.g. “Free first consultation for new patients”."
      >
        <textarea
          className="rp-input rp-textarea"
          rows={3}
          maxLength={500}
          style={{ ...full, resize: "vertical", lineHeight: 1.5 }}
          value={draft.offer}
          aria-invalid={Boolean(errors.offer)}
          onChange={(e) => onChange({ offer: e.target.value })}
        />
      </Field>
      <Field
        label={needsUrl ? "Web page to send people to" : "Web page to send people to (optional)"}
        error={errors.url}
        hint={
          needsUrl
            ? "The page where people can find out more or buy."
            : "Leave empty to send people to your Facebook Page."
        }
      >
        <input
          className="rp-input"
          type="url"
          inputMode="url"
          placeholder="https://"
          style={full}
          value={draft.landingUrl}
          aria-invalid={Boolean(errors.url)}
          onChange={(e) => onChange({ landingUrl: e.target.value })}
        />
      </Field>
      <Field label="Language of the ad">
        <select
          className="rp-select"
          style={{ ...full, maxWidth: 260 }}
          value={draft.language}
          onChange={(e) => onChange({ language: e.target.value })}
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function LeadFormStep({
  form,
  errors,
  onChange,
}: {
  form: LeadFormDraft;
  errors: Errors;
  onChange: (form: LeadFormDraft) => void;
}) {
  const set = (patch: Partial<LeadFormDraft>) => onChange({ ...form, ...patch });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Group
        title="What should the form ask?"
        desc="Meta fills these in from the person’s profile, so the form takes seconds."
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PREFILL_QUESTIONS.map((q) => {
            const on = form.questions.includes(q);
            return (
              <button
                key={q}
                type="button"
                className="rp-chip"
                aria-pressed={on}
                style={on ? { borderColor: "#0F6B4A", background: "#F1F5F2" } : undefined}
                onClick={() =>
                  set({
                    questions: on
                      ? form.questions.filter((x) => x !== q)
                      : PREFILL_QUESTIONS.filter((x) => x === q || form.questions.includes(x)),
                  })
                }
              >
                {QUESTION_LABELS[q]}
              </button>
            );
          })}
        </div>
        {errors.questions ? <ErrorText>{errors.questions}</ErrorText> : null}
      </Group>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid #EFEDE8",
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 500, fontSize: 13.5 }}>Suggest extra questions</span>
          <span style={{ fontSize: 12.5, color: MUTED }}>
            AI adds up to two short questions that help you qualify each lead. You can edit them on
            the review screen.
          </span>
        </span>
        <Toggle
          on={form.extraQuestions}
          label="Suggest extra questions"
          onChange={() => set({ extraQuestions: !form.extraQuestions })}
        />
      </div>
      <Field
        label="Privacy policy link"
        error={errors.privacy}
        hint="Meta shows this on every instant form. Use your website’s privacy page."
      >
        <input
          className="rp-input"
          type="url"
          inputMode="url"
          placeholder="https://"
          style={full}
          value={form.privacyPolicyUrl}
          aria-invalid={Boolean(errors.privacy)}
          onChange={(e) => set({ privacyPolicyUrl: e.target.value })}
        />
      </Field>
      <Group title="After they send the form" desc="The thank-you screen shows one button.">
        <div style={{ alignSelf: "flex-start" }}>
          <Seg
            label="Thank-you button"
            value={form.button}
            onChange={(button) => set({ button })}
            small
            options={[
              { id: "website", label: "Visit website" },
              { id: "call", label: "Call business" },
            ]}
          />
        </div>
        {form.button === "call" ? (
          <Field label="Phone number to call" error={errors.phone}>
            <input
              className="rp-input"
              type="tel"
              inputMode="tel"
              placeholder="+919876543210"
              style={{ ...full, maxWidth: 260 }}
              value={form.callPhone}
              aria-invalid={Boolean(errors.phone)}
              onChange={(e) => set({ callPhone: e.target.value })}
            />
          </Field>
        ) : (
          <span style={{ fontSize: 12.5, color: MUTED }}>
            Opens the web page from the previous step, or your Facebook Page.
          </span>
        )}
      </Group>
    </div>
  );
}

export function CreativeStep({
  visual,
  onChange,
  imagesOnly,
  variants,
  onVariants,
}: {
  visual: Draft["visual"];
  onChange: (visual: Draft["visual"]) => void;
  imagesOnly?: boolean;
  variants: boolean;
  onVariants: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const video = visual.post ? null : displaySrc(visual.videoUrl);
  const src = displaySrc(visual.post?.imageUrl ?? visual.imageUrl);
  const chosen = Boolean(visual.post || visual.imageUrl || visual.videoUrl);
  const creative = {
    primaryText: "",
    alternatives: [],
    headline: "",
    linkUrl: "",
    callToAction: "LEARN_MORE",
    imageUrl: visual.imageUrl ?? null,
    videoUrl: visual.videoUrl ?? null,
    post: visual.post ?? null,
  } as Creative;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          background: "#F1F5F2",
          color: "#0F3D2C",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        This step is optional. AI will write the ad text, and you can add an image or video later on
        the review screen.
      </p>
      {chosen ? (
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #E6E4DF",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              position: "relative",
              width: 72,
              height: 72,
              borderRadius: 10,
              overflow: "hidden",
              background: "#F4F2EE",
              flexShrink: 0,
            }}
          >
            {video ? (
              <VideoFill src={video} />
            ) : src ? (
              <Image
                unoptimized
                fill
                src={src}
                alt=""
                sizes="72px"
                style={{ objectFit: "cover" }}
              />
            ) : null}
          </span>
          <span style={{ flex: "1 1 160px", minWidth: 0, fontSize: 13 }}>
            {visual.post
              ? `Using your existing ${visual.post.platform === "instagram" ? "Instagram" : "Facebook"} post`
              : video
                ? "Using a video from your library"
                : "Using an image from your library"}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" className="rp-btn-light" onClick={() => setOpen(true)}>
              Change
            </button>
            <button
              type="button"
              className="rp-btn-light"
              aria-label={video ? "Remove video" : "Remove image"}
              onClick={() => onChange({ imageUrl: null, videoUrl: null, post: null })}
            >
              <X size={14} />
            </button>
          </span>
        </div>
      ) : (
        <button type="button" className="rp-drop" onClick={() => setOpen(true)}>
          <ImageIcon size={20} color={MUTED} aria-hidden />
          <span style={{ fontWeight: 500 }}>
            {imagesOnly ? "Choose an image or video" : "Choose an image, video or post"}
          </span>
          <span style={{ fontSize: 12.5, color: MUTED }}>
            {imagesOnly
              ? "From your library of images and MP4 videos"
              : "From your library, your Facebook Page or Instagram"}
          </span>
        </button>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid #EFEDE8",
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 500, fontSize: 13.5 }}>Test 3 versions of your ad</span>
          <span style={{ fontSize: 12.5, color: MUTED }}>
            {visual.post
              ? "Not available for an existing post, which always runs as it is."
              : "AI writes two more versions with a different message and headline. Meta shows all three and you keep the one that works best."}
          </span>
        </span>
        <Toggle
          on={variants && !visual.post}
          disabled={Boolean(visual.post)}
          label="Test 3 versions of your ad"
          onChange={() => onVariants(!variants)}
        />
      </div>
      <CreativePicker
        open={open}
        onOpenChange={setOpen}
        creative={creative}
        imagesOnly={imagesOnly}
        onPick={(patch) =>
          onChange({
            imageUrl: patch.imageUrl ?? null,
            videoUrl: patch.videoUrl ?? null,
            post: patch.post ?? null,
          })
        }
      />
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <span role="alert" style={{ fontSize: 12, color: "#B42318" }}>
      {children}
    </span>
  );
}
