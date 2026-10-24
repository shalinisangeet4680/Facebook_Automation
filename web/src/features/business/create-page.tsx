"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type CreateProfileInput,
  type GbpCategory,
  type GoogleMatch,
  type ProfileValidation,
  useBusinessAccounts,
  useCreateBusinessGroup,
  useCreateProfile,
  useSearchGoogle,
  useValidateProfile,
} from "@/lib/api/business";
import { Select } from "@/features/replyly/select";
import { useToast } from "@/features/replyly/ui";

import { CategoryPicker } from "./category-picker";
import { HoursEditor, type HoursForm, hoursForm, hoursPeriods } from "./hours-editor";
import { Field, Section, Spin } from "./location-ui";
import { useGoogleConnected } from "./shell";
import { Notice, Seg, Skel } from "./ui";
import { VerifyPanel } from "./verify-panel";

const STEPS = ["Find", "Details", "Review", "Verify"] as const;
const COUNTRIES = [
  ["IN", "India"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["AE", "United Arab Emirates"],
  ["SG", "Singapore"],
  ["AU", "Australia"],
  ["CA", "Canada"],
  ["NP", "Nepal"],
  ["BD", "Bangladesh"],
  ["LK", "Sri Lanka"],
] as const;
const DEFAULT_HOURS = hoursForm(
  ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].map((day) => ({
    day: day as "MONDAY",
    open: "09:00",
    close: "18:00",
  })),
);

interface Draft {
  owner: string;
  title: string;
  category: GbpCategory | null;
  extra: GbpCategory[];
  kind: "storefront" | "area";
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  areas: string[];
  phone: string;
  website: string;
  description: string;
  hours: HoursForm;
}

const EMPTY: Draft = {
  owner: "",
  title: "",
  category: null,
  extra: [],
  kind: "storefront",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "IN",
  areas: [],
  phone: "",
  website: "https://",
  description: "",
  hours: DEFAULT_HOURS,
};

function toInput(d: Draft): CreateProfileInput {
  const [connectionId, account] = d.owner ? d.owner.split("|") : [undefined, undefined];
  const website = d.website.trim() === "https://" ? "" : d.website.trim();
  return {
    connectionId,
    account,
    business: {
      title: d.title,
      primaryCategory: d.category,
      additionalCategories: d.extra,
      phone: d.phone.trim() || null,
      website: website || null,
      description: d.description,
      address:
        d.kind === "storefront"
          ? {
              lines: [d.line1, d.line2].filter((l) => l.trim()),
              locality: d.city,
              region: d.state,
              postalCode: d.postalCode,
              country: d.country,
            }
          : null,
      serviceArea: d.kind === "area" ? { regionCode: d.country, places: d.areas } : null,
      hours: hoursPeriods(d.hours),
    },
  };
}

function Steps({ step }: { step: number }) {
  return (
    <ol aria-label="Steps" className="gb-lp-steps">
      {STEPS.map((label, i) => {
        const done = i < step;
        const on = i === step;
        return (
          <li
            key={label}
            aria-current={on ? "step" : undefined}
            className="gb-lp-step"
            data-state={on ? "on" : done ? "done" : undefined}
          >
            <span className="gb-lp-step-pill">
              <span aria-hidden className="gb-lp-step-n">
                {done ? "✓" : i + 1}
              </span>
              {label}
            </span>
            {i < STEPS.length - 1 ? <span aria-hidden className="gb-lp-step-line" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function MatchRow({ m }: { m: GoogleMatch }) {
  return (
    <div className="gb-lp-match gb-row">
      <span
        style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 240px", minWidth: 0 }}
      >
        <span style={{ fontWeight: 500 }}>{m.title}</span>
        <span className="gb-faint">
          {[m.category, m.address, m.phone].filter(Boolean).join(" · ")}
        </span>
      </span>
      {m.mapsUri ? (
        <a
          href={m.mapsUri}
          target="_blank"
          rel="noreferrer"
          style={{ whiteSpace: "nowrap", fontSize: 13, fontWeight: 500 }}
        >
          Maps ↗
        </a>
      ) : null}
      {m.locationId ? (
        <Link href={`/business/${m.locationId}`} className="gb-btn">
          Already in TreeVook
        </Link>
      ) : m.requestAdminRightsUri ? (
        <a
          href={m.requestAdminRightsUri}
          target="_blank"
          rel="noreferrer"
          className="gb-btn gb-btn-dark"
        >
          Claim this business ↗
        </a>
      ) : (
        <span className="gb-faint">Managed by this Google account</span>
      )}
    </div>
  );
}

export function CreateProfilePage() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { connected, loading } = useGoogleConnected();
  const accounts = useBusinessAccounts(connected);
  const search = useSearchGoogle();
  const validate = useValidateProfile();
  const create = useCreateProfile();
  const group = useCreateBusinessGroup();
  const requestId = useRef<string | null>(null);

  const [step, setStep] = useState(0);
  const [find, setFind] = useState({ name: params.get("name") ?? "", where: "", phone: "" });
  const [matches, setMatches] = useState<GoogleMatch[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [area, setArea] = useState("");
  const [review, setReview] = useState<ProfileValidation | null>(null);
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);

  const accountList = accounts.data?.data ?? [];
  const ownerOptions = accountList.map((a) => ({
    value: `${a.connectionId}|${a.account}`,
    label: `${a.name} · ${a.email}`,
  }));
  const owner = draft.owner || (ownerOptions.length === 1 ? ownerOptions[0]!.value : "");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setReview(null);
    requestId.current = null;
  };

  function runSearch() {
    search.mutate(
      {
        query: find.name,
        address: find.where || undefined,
        phone: find.phone || undefined,
        regionCode: "IN",
      },
      {
        onSuccess: (r) => setMatches(r.data),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  }

  function toDetails() {
    setDraft((d) => ({
      ...d,
      title: d.title || find.name.trim(),
      phone: d.phone || find.phone.trim(),
    }));
    setStep(1);
  }

  function toReview() {
    validate.mutate(toInput({ ...draft, owner }), {
      onSuccess: (r) => {
        setReview(r);
        setStep(2);
      },
      onError: (err) => toast(errorMessage(err)),
    });
  }

  function submit() {
    requestId.current ??= crypto.randomUUID();
    create.mutate(
      { ...toInput({ ...draft, owner }), requestId: requestId.current },
      {
        onSuccess: (l) => {
          setCreated({ id: l.id, title: l.title });
          setStep(3);
          toast("Created on Google");
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  }

  const header = (
    <div className="gb-lp-col">
      <Link href="/business/locations" className="gb-link gb-lp-back">
        ← Locations
      </Link>
      <h1 className="sr-only">Create a Business Profile</h1>
      <Steps step={step} />
    </div>
  );

  if (loading)
    return (
      <div className="gb-lp gb-narrow">
        {header}
        <Skel h={200} r={14} />
      </div>
    );

  if (!connected)
    return (
      <div className="gb-lp gb-narrow">
        {header}
        <Notice
          tone="ok"
          action={
            <Link href="/business/connect" className="gb-btn gb-btn-dark">
              Connect Google
            </Link>
          }
        >
          <span className="gb-lp-notice-title">Sign in with Google first</span>
          The new profile belongs to the Google account you sign in with. Use the account that
          should own the business.
        </Notice>
      </div>
    );

  return (
    <div className="gb-lp gb-narrow">
      {header}

      {step === 0 ? (
        <Section
          title="Is your business already on Google?"
          desc="Many businesses are already on Maps, added by customers or a previous owner. Claim it instead of creating a new one."
        >
          <form
            className="gb-card gb-card-pad gb-lp-col"
            style={{ gap: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
          >
            <div
              className="gb-lp-grid"
              style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}
            >
              <Field label="Business name">
                <input
                  className="gb-input"
                  value={find.name}
                  maxLength={100}
                  placeholder="Sharma Dental Clinic"
                  onChange={(e) => setFind({ ...find, name: e.target.value })}
                />
              </Field>
              <Field label="City or address (optional)">
                <input
                  className="gb-input"
                  value={find.where}
                  maxLength={200}
                  placeholder="Patna"
                  onChange={(e) => setFind({ ...find, where: e.target.value })}
                />
              </Field>
              <Field label="Phone (optional)">
                <input
                  className="gb-input"
                  value={find.phone}
                  maxLength={40}
                  placeholder="+91 …"
                  onChange={(e) => setFind({ ...find, phone: e.target.value })}
                />
              </Field>
            </div>
            <div>
              <button
                type="submit"
                className="gb-btn gb-btn-dark"
                disabled={find.name.trim().length < 2 || search.isPending}
              >
                {search.isPending ? <Spin /> : null}
                Search Google
              </button>
            </div>
          </form>
          {matches ? (
            matches.length ? (
              <div className="gb-card">
                <div className="gb-card-head gb-sub" style={{ display: "block" }}>
                  {matches.length} match{matches.length === 1 ? "" : "es"} on Google. If one is
                  yours, claim it: Google asks the current owner, or lets you verify it yourself.
                </div>
                {matches.map((m) => (
                  <MatchRow key={m.name} m={m} />
                ))}
              </div>
            ) : (
              <Notice tone="ok">
                <span className="gb-lp-notice-title">Not on Google yet</span>
                Nothing matched “{find.name}”. You can create it.
              </Notice>
            )
          ) : null}
          {matches ? (
            <div className="gb-lp-actions">
              <button type="button" className="gb-btn gb-btn-dark" onClick={toDetails}>
                {matches.length ? "None of these is mine, continue" : "Continue"}
              </button>
            </div>
          ) : null}
        </Section>
      ) : null}

      {step === 1 ? (
        <>
          <Section title="Business details" desc="Use the real name customers see on your signage.">
            <div className="gb-card gb-card-pad gb-lp-col" style={{ gap: 14 }}>
              {ownerOptions.length > 1 || groupName !== null ? (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <Field label="Owner on Google">
                    <Select
                      label="Owner on Google"
                      value={owner}
                      onChange={(v) => set("owner", v)}
                      options={ownerOptions}
                      block
                      align="start"
                    />
                  </Field>
                  {groupName === null ? (
                    <button
                      type="button"
                      className="gb-btn gb-btn-ghost"
                      onClick={() => setGroupName("")}
                    >
                      New business group
                    </button>
                  ) : null}
                </div>
              ) : (
                <span className="gb-sub">
                  Owner on Google: {accountList[0]?.name ?? "…"}
                  {accountList[0] ? ` · ${accountList[0].email}` : ""}{" "}
                  <button
                    type="button"
                    className="gb-link"
                    style={{ color: "var(--gb-green)", fontWeight: 500 }}
                    onClick={() => setGroupName("")}
                  >
                    Use a new business group
                  </button>
                </span>
              )}
              {groupName !== null ? (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <Field
                    label="Group name"
                    hint="Groups keep each client’s profiles apart, for agencies and chains."
                  >
                    <input
                      className="gb-input"
                      value={groupName}
                      maxLength={80}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </Field>
                  <button
                    type="button"
                    className="gb-btn"
                    disabled={!groupName.trim() || group.isPending || !accountList[0]}
                    onClick={() => {
                      const connectionId = (owner || ownerOptions[0]?.value || "").split("|")[0]!;
                      group.mutate(
                        { connectionId, name: groupName.trim() },
                        {
                          onSuccess: (g) => {
                            set("owner", `${g.connectionId}|${g.account}`);
                            setGroupName(null);
                            toast(`Created ${g.name}`);
                          },
                          onError: (err) => toast(errorMessage(err)),
                        },
                      );
                    }}
                  >
                    {group.isPending ? <Spin light /> : null}
                    Create group
                  </button>
                  <button
                    type="button"
                    className="gb-btn gb-btn-ghost"
                    onClick={() => setGroupName(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              <Field label="Business name">
                <input
                  className="gb-input"
                  value={draft.title}
                  maxLength={100}
                  onChange={(e) => set("title", e.target.value)}
                />
              </Field>
              <div
                className="gb-lp-grid"
                style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}
              >
                <Field label="Main category" hint="Pick the closest match from Google’s list.">
                  <CategoryPicker
                    label="Main category"
                    value={draft.category}
                    region={draft.country}
                    onChange={(c) => set("category", c)}
                  />
                </Field>
                <Field label="More categories (optional)">
                  <CategoryPicker
                    key={draft.extra.length}
                    label="Add a category"
                    placeholder="Add another category"
                    value={null}
                    region={draft.country}
                    exclude={[draft.category?.name ?? "", ...draft.extra.map((c) => c.name)]}
                    onChange={(c) => {
                      if (c && draft.extra.length < 9) set("extra", [...draft.extra, c]);
                    }}
                  />
                </Field>
              </div>
              {draft.extra.length ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {draft.extra.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className="gb-chip"
                      aria-label={`Remove ${c.displayName}`}
                      onClick={() =>
                        set(
                          "extra",
                          draft.extra.filter((x) => x.name !== c.name),
                        )
                      }
                    >
                      {c.displayName} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Section>

          <Section title="Where customers find you">
            <div className="gb-card gb-card-pad gb-lp-col" style={{ gap: 14 }}>
              <div className="gb-lp-scroll" style={{ alignSelf: "flex-start" }}>
                <Seg
                  label="Location type"
                  value={draft.kind}
                  onChange={(k) => set("kind", k)}
                  options={[
                    { id: "storefront", label: "Customers visit us" },
                    { id: "area", label: "We go to customers" },
                  ]}
                />
              </div>
              <div
                className="gb-lp-grid"
                style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}
              >
                <Field label="Country">
                  <Select
                    label="Country"
                    value={draft.country}
                    onChange={(v) => set("country", v)}
                    options={COUNTRIES.map(([value, label]) => ({ value, label }))}
                    block
                    align="start"
                  />
                </Field>
              </div>
              {draft.kind === "storefront" ? (
                <>
                  <Field label="Street address">
                    <input
                      className="gb-input"
                      value={draft.line1}
                      maxLength={120}
                      onChange={(e) => set("line1", e.target.value)}
                    />
                  </Field>
                  <Field label="Area, building or landmark (optional)">
                    <input
                      className="gb-input"
                      value={draft.line2}
                      maxLength={120}
                      onChange={(e) => set("line2", e.target.value)}
                    />
                  </Field>
                  <div
                    className="gb-lp-grid"
                    style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}
                  >
                    <Field label="City">
                      <input
                        className="gb-input"
                        value={draft.city}
                        maxLength={80}
                        onChange={(e) => set("city", e.target.value)}
                      />
                    </Field>
                    <Field label="State">
                      <input
                        className="gb-input"
                        value={draft.state}
                        maxLength={80}
                        onChange={(e) => set("state", e.target.value)}
                      />
                    </Field>
                    <Field label={draft.country === "IN" ? "PIN code" : "Postal code"}>
                      <input
                        className="gb-input"
                        value={draft.postalCode}
                        maxLength={20}
                        inputMode={draft.country === "IN" ? "numeric" : undefined}
                        onChange={(e) => set("postalCode", e.target.value)}
                      />
                    </Field>
                  </div>
                  <span className="gb-faint">
                    Google may mail a postcard with a code to this address.
                  </span>
                </>
              ) : (
                <>
                  <form
                    style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = area.trim();
                      if (v && !draft.areas.includes(v) && draft.areas.length < 20)
                        set("areas", [...draft.areas, v]);
                      setArea("");
                    }}
                  >
                    <Field
                      label="Cities or areas you serve"
                      hint="Your address stays hidden on Google."
                    >
                      <input
                        className="gb-input"
                        value={area}
                        maxLength={120}
                        placeholder="Kankarbagh, Patna"
                        onChange={(e) => setArea(e.target.value)}
                      />
                    </Field>
                    <button type="submit" className="gb-btn" disabled={!area.trim()}>
                      Add
                    </button>
                  </form>
                  {draft.areas.length ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {draft.areas.map((a) => (
                        <button
                          key={a}
                          type="button"
                          className="gb-chip"
                          aria-label={`Remove ${a}`}
                          onClick={() =>
                            set(
                              "areas",
                              draft.areas.filter((x) => x !== a),
                            )
                          }
                        >
                          {a} ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Section>

          <Section title="Contact">
            <div className="gb-card gb-card-pad gb-lp-col" style={{ gap: 14 }}>
              <div
                className="gb-lp-grid"
                style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}
              >
                <Field label="Phone" hint="Google may text or call this number with a code.">
                  <input
                    className="gb-input"
                    type="tel"
                    value={draft.phone}
                    maxLength={40}
                    placeholder="+91 98765 43210"
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </Field>
                <Field label="Website (optional)" hint="Must start with https://">
                  <input
                    className="gb-input"
                    type="url"
                    value={draft.website}
                    maxLength={500}
                    onChange={(e) => set("website", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Description (optional)">
                <textarea
                  className="gb-textarea"
                  rows={4}
                  value={draft.description}
                  maxLength={750}
                  onChange={(e) => set("description", e.target.value)}
                />
                <span className="gb-faint">
                  {draft.description.length}/750 · No links, prices or promotions.
                </span>
              </Field>
            </div>
          </Section>

          <Section
            title="Opening hours"
            desc="Regular weekly hours. Use Midnight to close at the end of the day."
          >
            <HoursEditor value={draft.hours} onChange={(hours) => set("hours", hours)} />
          </Section>

          <div className="gb-lp-actions gb-lp-actions-split">
            <button type="button" className="gb-btn gb-btn-ghost" onClick={() => setStep(0)}>
              ← Back to search
            </button>
            <button
              type="button"
              className="gb-btn gb-btn-dark"
              disabled={!draft.title.trim() || validate.isPending}
              onClick={toReview}
            >
              {validate.isPending ? <Spin /> : null}
              Review
            </button>
          </div>
        </>
      ) : null}

      {step === 2 && review ? (
        <Section
          title="Review and create"
          desc="Google checked these details without creating anything yet."
        >
          {review.problems.length ? (
            <Notice tone="error">
              <span className="gb-lp-notice-title">Fix these first</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {review.problems.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </span>
            </Notice>
          ) : (
            <Notice tone="ok">
              <span className="gb-lp-notice-title">Google accepted these details</span>
              The profile stays hidden on Google until you verify it in the next step.
            </Notice>
          )}
          <div className="gb-card">
            {review.summary.map((line) => {
              const at = line.indexOf(": ");
              return (
                <div key={line} className="gb-lp-kv gb-row">
                  <span className="gb-lp-kv-key">{line.slice(0, at)}</span>
                  <span className="gb-lp-kv-val">{line.slice(at + 2)}</span>
                </div>
              );
            })}
          </div>
          <div className="gb-lp-actions gb-lp-actions-split">
            <button type="button" className="gb-btn gb-btn-ghost" onClick={() => setStep(1)}>
              ← Edit details
            </button>
            <button
              type="button"
              className="gb-btn gb-btn-dark"
              disabled={!review.valid || create.isPending}
              onClick={submit}
            >
              {create.isPending ? <Spin /> : null}
              Create on Google
            </button>
          </div>
        </Section>
      ) : null}

      {step === 3 && created ? (
        <Section
          title={`Verify ${created.title}`}
          desc="Google shows the profile, your replies and posts once you prove you run the business."
          action={
            <button
              type="button"
              className="gb-btn"
              onClick={() => router.push(`/business/${created.id}`)}
            >
              Open location
            </button>
          }
        >
          <VerifyPanel locationId={created.id} />
        </Section>
      ) : null}
    </div>
  );
}
