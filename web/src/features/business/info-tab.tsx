"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpInfoPatch,
  type GbpLocationDetail,
  usePreviewInfo,
  useUpdateInfo,
} from "@/lib/api/business";
import { useToast } from "@/features/replyly/ui";

import { DAYS, HoursEditor, type HoursForm, hoursForm, hoursPeriods } from "./hours-editor";
import { Field, Section, Spin } from "./location-ui";
import { Notice } from "./ui";

interface Form {
  title: string;
  description: string;
  phone: string;
  website: string;
  hours: HoursForm;
}

function toForm(l: GbpLocationDetail): Form {
  const hours = hoursForm(l.info.hours);
  return {
    title: l.info.title,
    description: l.info.description,
    phone: l.info.phone ?? "",
    website: l.info.website ?? "",
    hours,
  };
}

function patchOf(form: Form, l: GbpLocationDetail): GbpInfoPatch {
  const hours = hoursPeriods(form.hours);
  const patch: GbpInfoPatch = {};
  if (form.title !== l.info.title) patch.title = form.title;
  if (form.description !== l.info.description) patch.description = form.description;
  if (form.phone !== (l.info.phone ?? "")) patch.phone = form.phone;
  if (form.website !== (l.info.website ?? "")) patch.website = form.website;
  const sameHours =
    JSON.stringify(hours) ===
    JSON.stringify(
      DAYS.flatMap((d) => l.info.hours.filter((h) => h.day === d).slice(0, 1)).map((h) => ({
        day: h.day,
        open: h.open,
        close: h.close,
      })),
    );
  if (!sameHours) patch.hours = hours;
  return patch;
}

export function InfoTab({ location }: { location: GbpLocationDetail }) {
  const toast = useToast();
  const [form, setForm] = useState(() => toForm(location));
  const [base, setBase] = useState(location.info);
  const preview = usePreviewInfo(location.id);
  const update = useUpdateInfo(location.id);
  const [review, setReview] = useState<{ changes: string[]; problems: string[] } | null>(null);

  if (base !== location.info) {
    setBase(location.info);
    setForm(toForm(location));
    setReview(null);
  }

  const patch = patchOf(form, location);
  const dirty = Object.keys(patch).length > 0;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setReview(null);
  };

  return (
    <div className="gb-lp-col gb-narrow" style={{ gap: 24 }}>
      <Section
        title="Business details"
        desc="Changes go to Google right away. Google may review some edits before they show."
      >
        <div className="gb-card gb-card-pad gb-lp-col" style={{ gap: 14 }}>
          <Field
            label="Business name"
            hint="Use the name customers see on your signage. Extra keywords can get a profile suspended."
          >
            <input
              className="gb-input"
              value={form.title}
              maxLength={100}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
          <Field
            label="Description"
            hint={`${form.description.length}/750 · No links, prices or promotions.`}
          >
            <textarea
              className="gb-textarea"
              rows={5}
              value={form.description}
              maxLength={750}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <div className="gb-lp-grid">
            <Field label="Phone">
              <input
                className="gb-input"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91 …"
              />
            </Field>
            <Field label="Website">
              <input
                className="gb-input"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://"
              />
            </Field>
          </div>
          <div className="gb-sub" style={{ display: "flex", gap: "6px 24px", flexWrap: "wrap" }}>
            <span>
              <span style={{ color: "var(--gb-ink)", fontWeight: 500 }}>Category</span>{" "}
              {location.info.primaryCategory ?? "—"}
              {location.info.additionalCategories.length
                ? ` · ${location.info.additionalCategories.join(", ")}`
                : ""}
            </span>
            {location.info.address ? (
              <span>
                <span style={{ color: "var(--gb-ink)", fontWeight: 500 }}>Address</span>{" "}
                {[
                  ...location.info.address.lines,
                  location.info.address.locality,
                  location.info.address.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            ) : null}
          </div>
          <span className="gb-faint">
            Change the category or address in Business Profile; Google re-verifies those.
          </span>
        </div>
      </Section>

      <Section
        title="Opening hours"
        desc="Regular weekly hours. Use Midnight to close at the end of the day."
      >
        <HoursEditor value={form.hours} onChange={(hours) => set("hours", hours)} />
      </Section>

      {review ? (
        review.problems.length ? (
          <Notice tone="error">
            <span className="gb-lp-notice-title">Fix these first</span>
            {review.problems.join(" ")}
          </Notice>
        ) : (
          <Notice tone="ok">
            <span className="gb-lp-notice-title">These changes will go to Google</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {review.changes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </span>
          </Notice>
        )
      ) : null}

      <div className="gb-lp-actions">
        <button
          type="button"
          className="gb-btn gb-btn-ghost"
          disabled={!dirty}
          onClick={() => {
            setForm(toForm(location));
            setReview(null);
          }}
        >
          Reset
        </button>
        {review && !review.problems.length ? (
          <button
            type="button"
            className="gb-btn gb-btn-green"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(patch, {
                onSuccess: () => {
                  toast("Saved to Google");
                  setReview(null);
                },
                onError: (err) => toast(errorMessage(err)),
              })
            }
          >
            {update.isPending ? <Spin /> : null}
            Save to Google
          </button>
        ) : (
          <button
            type="button"
            className="gb-btn gb-btn-dark"
            disabled={!dirty || preview.isPending}
            onClick={() =>
              preview.mutate(patch, {
                onSuccess: setReview,
                onError: (err) => toast(errorMessage(err)),
              })
            }
          >
            {preview.isPending ? <Spin /> : null}
            Review changes
          </button>
        )}
      </div>
    </div>
  );
}
