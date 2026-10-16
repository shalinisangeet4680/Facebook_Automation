"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpInfoPatch,
  type GbpLocationDetail,
  type GbpOpeningPeriod,
  usePreviewInfo,
  useUpdateInfo,
} from "@/lib/api/business";
import { Select } from "@/features/replyly/select";
import { Banner, Section, Spinner, Toggle, useToast } from "@/features/replyly/ui";

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;
const MUTED = "#6C6962";
const TIMES = [
  ...Array.from(
    { length: 48 },
    (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
  ),
  "24:00",
];
const label = (t: string) => {
  if (t === "24:00") return "Midnight";
  const [h, m] = t.split(":").map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
};

interface Form {
  title: string;
  description: string;
  phone: string;
  website: string;
  hours: Record<(typeof DAYS)[number], { open: boolean; from: string; to: string }>;
}

function toForm(l: GbpLocationDetail): Form {
  const hours = Object.fromEntries(
    DAYS.map((d) => {
      const p = l.info.hours.find((h) => h.day === d);
      return [d, { open: Boolean(p), from: p?.open ?? "09:00", to: p?.close ?? "18:00" }];
    }),
  ) as Form["hours"];
  return {
    title: l.info.title,
    description: l.info.description,
    phone: l.info.phone ?? "",
    website: l.info.website ?? "",
    hours,
  };
}

function patchOf(form: Form, l: GbpLocationDetail): GbpInfoPatch {
  const hours: GbpOpeningPeriod[] = DAYS.filter((d) => form.hours[d].open).map((d) => ({
    day: d,
    open: form.hours[d].from,
    close: form.hours[d].to,
  }));
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
  const setDay = (d: (typeof DAYS)[number], v: Partial<Form["hours"][typeof d]>) => {
    setForm((f) => ({ ...f, hours: { ...f.hours, [d]: { ...f.hours[d], ...v } } }));
    setReview(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 820 }}>
      <Section
        title="Business details"
        desc="Changes go to Google right away. Google may review some edits before they show."
      >
        <div
          className="rp-card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}
        >
          <label className="rp-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="rp-label">Business name</span>
            <input
              className="rp-input"
              value={form.title}
              maxLength={100}
              onChange={(e) => set("title", e.target.value)}
            />
            <span style={{ fontSize: 12, color: MUTED }}>
              Use the name customers see on your signage. Extra keywords can get a profile
              suspended.
            </span>
          </label>
          <label className="rp-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="rp-label">Description</span>
            <textarea
              className="rp-textarea"
              rows={5}
              value={form.description}
              maxLength={750}
              onChange={(e) => set("description", e.target.value)}
              style={{ resize: "vertical" }}
            />
            <span style={{ fontSize: 12, color: MUTED }}>
              {form.description.length}/750 · No links, prices or promotions.
            </span>
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 12,
            }}
          >
            <label
              className="rp-field"
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span className="rp-label">Phone</span>
              <input
                className="rp-input"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91 …"
              />
            </label>
            <label
              className="rp-field"
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span className="rp-label">Website</span>
              <input
                className="rp-input"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://"
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 12.5, color: MUTED }}>
            <span>
              <span style={{ color: "#191917", fontWeight: 500 }}>Category</span>{" "}
              {location.info.primaryCategory ?? "—"}
              {location.info.additionalCategories.length
                ? ` · ${location.info.additionalCategories.join(", ")}`
                : ""}
            </span>
            {location.info.address ? (
              <span>
                <span style={{ color: "#191917", fontWeight: 500 }}>Address</span>{" "}
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
          <span style={{ fontSize: 12, color: MUTED }}>
            Change the category or address in Business Profile; Google re-verifies those.
          </span>
        </div>
      </Section>

      <Section
        title="Opening hours"
        desc="Regular weekly hours. Use Midnight to close at the end of the day."
      >
        <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
          {DAYS.map((d, i) => {
            const h = form.hours[d];
            return (
              <div
                key={d}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "10px 16px",
                  borderTop: i ? "1px solid #EFEDE8" : "none",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ width: 96, fontWeight: 500, fontSize: 13.5 }}>
                  {d[0]}
                  {d.slice(1).toLowerCase()}
                </span>
                <Toggle
                  on={h.open}
                  label={`Open on ${d.toLowerCase()}`}
                  onChange={() => setDay(d, { open: !h.open })}
                />
                {h.open ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Select
                      label="Opens"
                      value={h.from}
                      onChange={(v) => setDay(d, { from: v })}
                      minWidth={120}
                      align="start"
                      options={TIMES.slice(0, 48).map((t) => ({ value: t, label: label(t) }))}
                    />
                    <span style={{ color: MUTED }}>to</span>
                    <Select
                      label="Closes"
                      value={h.to}
                      onChange={(v) => setDay(d, { to: v })}
                      minWidth={120}
                      align="start"
                      options={TIMES.slice(1).map((t) => ({ value: t, label: label(t) }))}
                    />
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: MUTED }}>Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {review ? (
        review.problems.length ? (
          <Banner tone="error" title="Fix these first">
            {review.problems.join(" ")}
          </Banner>
        ) : (
          <Banner tone="info" title="These changes will go to Google">
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {review.changes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </span>
          </Banner>
        )
      ) : null}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="rp-btn-text"
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
            className="rp-btn"
            style={{ padding: "9px 16px" }}
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
            {update.isPending ? <Spinner size={11} /> : null}
            Save to Google
          </button>
        ) : (
          <button
            type="button"
            className="rp-btn"
            style={{ padding: "9px 16px" }}
            disabled={!dirty || preview.isPending}
            onClick={() =>
              preview.mutate(patch, {
                onSuccess: setReview,
                onError: (err) => toast(errorMessage(err)),
              })
            }
          >
            {preview.isPending ? <Spinner size={11} /> : null}
            Review changes
          </button>
        )}
      </div>
    </div>
  );
}
