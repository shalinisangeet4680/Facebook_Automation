"use client";

import { useEffect, useRef, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpTemplate,
  useBusinessTemplateHidden,
  useBusinessTemplates,
  useDeleteBusinessTemplate,
  useSaveBusinessTemplate,
} from "@/lib/api/business";
import { useToast } from "@/features/replyly/ui";

import { useLocationColors, useLocationFilter, useTv } from "./shell";
import { Notice, Skel, Switch } from "./ui";
import "./templates.css";

const VARS = ["user_name", "business_name", "phone", "team_name"];

interface Draft {
  id?: string;
  name: string;
  ratings: number[];
  variants: string[];
  preset: boolean;
}

const top = (t: { ratings: number[] }) => (t.ratings.length ? Math.max(...t.ratings) : 0);

function ratingLabel(ratings: number[]) {
  if (ratings.length < 2) return null;
  const sorted = [...ratings].sort((a, b) => a - b);
  const contiguous = sorted.every((r, i) => i === 0 || r === sorted[i - 1]! + 1);
  return contiguous ? `${sorted[0]}–${sorted[sorted.length - 1]}★` : `${sorted.join(", ")}★`;
}

function RatingStars({ ratings }: { ratings: number[] }) {
  const n = top({ ratings });
  const extra = ratingLabel(ratings);
  return (
    <span
      className="gb-templates-stars"
      aria-label={extra ? `${extra} reviews` : `${n} star reviews`}
    >
      <span aria-hidden>
        <span className="gb-stars-on">{"★".repeat(n)}</span>
        <span className="gb-stars-off">{"★".repeat(5 - n)}</span>
      </span>
      {extra ? (
        <span className="gb-templates-range" aria-hidden>
          {extra}
        </span>
      ) : null}
    </span>
  );
}

function Editor({
  initial,
  locationId,
  onDone,
}: {
  initial: Draft;
  locationId?: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const save = useSaveBusinessTemplate();
  const remove = useDeleteBusinessTemplate();
  const [d, setD] = useState(initial);
  const area = useRef<HTMLTextAreaElement>(null);
  const text = d.variants[0] ?? "";
  const id = d.id ?? "new";
  const setText = (v: string) => setD((x) => ({ ...x, variants: [v, ...x.variants.slice(1)] }));

  const insert = (name: string) => {
    const token = `{${name}}`;
    const el = area.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const category = d.ratings.some((r) => r <= 2)
    ? "negative"
    : d.ratings.includes(3)
      ? "neutral"
      : "positive";

  const submit = () =>
    save.mutate(
      {
        id: d.id,
        name: d.name.trim(),
        category,
        ratings: d.ratings,
        bodies: [{ language: "en", variants: d.variants.filter((v) => v.trim()) }],
        ...(d.id ? {} : { locationId: locationId ?? null }),
      },
      {
        onSuccess: () => {
          toast("Template saved");
          onDone();
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );

  return (
    <div className="gb-templates-edit">
      <input
        className="gb-input gb-templates-name"
        aria-label="Template name"
        value={d.name}
        maxLength={60}
        placeholder="Thanks for visiting"
        onChange={(e) => setD({ ...d, name: e.target.value })}
      />
      <textarea
        ref={area}
        id={`tpl-text-${id}`}
        className="gb-textarea"
        aria-label="Reply text"
        rows={3}
        value={text}
        placeholder="Thank you, {user_name}! …"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="gb-templates-for" role="group" aria-label="Use for ratings">
        <span className="gb-faint">For</span>
        {[5, 4, 3, 2, 1].map((n) => {
          const on = d.ratings.includes(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              aria-label={`${n} star reviews`}
              className="gb-templates-chip"
              onClick={() =>
                setD({
                  ...d,
                  ratings: on ? d.ratings.filter((x) => x !== n) : [...d.ratings, n],
                })
              }
            >
              {n}★
            </button>
          );
        })}
        {d.variants.length > 1 ? (
          <span className="gb-faint gb-templates-note">{d.variants.length} wordings, rotated</span>
        ) : null}
      </div>
      <div className="gb-templates-actions">
        <div className="gb-templates-vars" role="group" aria-label="Insert a placeholder">
          {VARS.map((v) => (
            <button
              key={v}
              type="button"
              className="gb-templates-var"
              aria-controls={`tpl-text-${id}`}
              onClick={() => insert(v)}
            >
              {`{${v}}`}
            </button>
          ))}
        </div>
        <div className="gb-templates-save">
          {d.id && !d.preset ? (
            <button
              type="button"
              className="gb-btn gb-btn-danger gb-templates-small"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete “${d.name}”? Ratings that use it switch to AI-written replies.`,
                  )
                )
                  remove.mutate(d.id!, {
                    onSuccess: () => {
                      toast("Template deleted");
                      onDone();
                    },
                    onError: (err) => toast(errorMessage(err)),
                  });
              }}
            >
              Delete
            </button>
          ) : null}
          {!d.id ? (
            <button
              type="button"
              className="gb-btn gb-btn-ghost gb-templates-small"
              onClick={onDone}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            className="gb-btn gb-btn-dark gb-templates-small"
            disabled={save.isPending || !d.name.trim() || !text.trim()}
            onClick={submit}
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  t,
  open,
  onToggleOpen,
  locationName,
  locationId,
}: {
  t: GbpTemplate;
  open: boolean;
  onToggleOpen: () => void;
  locationName: string | null;
  locationId?: string;
}) {
  const toast = useToast();
  const hide = useBusinessTemplateHidden();
  const on = !t.hidden;
  const text = t.bodies[0]?.variants[0] ?? "";
  return (
    <div className="gb-templates-row" style={{ opacity: on ? 1 : 0.55 }}>
      <div className="gb-templates-line">
        <RatingStars ratings={t.ratings} />
        <button
          type="button"
          className="gb-templates-main"
          aria-expanded={open}
          onClick={onToggleOpen}
        >
          <span className="gb-templates-title">
            <span className="gb-templates-nm">{t.name}</span>
            {t.preset ? <span className="gb-faint gb-templates-tag">Built-in</span> : null}
            {locationName ? (
              <span className="gb-faint gb-templates-tag">{locationName}</span>
            ) : null}
          </span>
          <span className="gb-templates-text">{text}</span>
        </button>
        <Switch
          on={on}
          label={`Use ${t.name} for drafts`}
          disabled={hide.isPending}
          onChange={(v) =>
            hide.mutate(
              { id: t.id, hidden: !v },
              {
                onSuccess: () => toast(v ? `${t.name} is on` : `${t.name} is off`),
                onError: (err) => toast(errorMessage(err)),
              },
            )
          }
        />
      </div>
      {open ? (
        <Editor
          key={t.updatedAt}
          locationId={locationId}
          initial={{
            id: t.id,
            name: t.name,
            ratings: t.ratings,
            variants: t.bodies[0]?.variants.length ? t.bodies[0].variants : [""],
            preset: t.preset,
          }}
          onDone={onToggleOpen}
        />
      ) : null}
    </div>
  );
}

export function BusinessTemplatesPage() {
  const { markSeen } = useTv();
  const { locationId } = useLocationFilter();
  const { locations } = useLocationColors();
  const templates = useBusinessTemplates(locationId);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    markSeen("setup:templates");
  }, [markSeen]);

  const list = [...(templates.data?.data ?? [])].sort((a, b) => top(b) - top(a));
  const nameOf = (id: string | null) =>
    id && !locationId ? (locations.find((l) => l.id === id)?.title ?? null) : null;

  return (
    <div className="gb-narrow gb-templates">
      {templates.error ? <Notice tone="error">{errorMessage(templates.error)}</Notice> : null}
      {templates.isPending ? (
        <div className="gb-card gb-templates-card">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="gb-templates-line gb-templates-row">
              <Skel h={14} w={78} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Skel h={14} w="40%" />
                <Skel h={12} w="80%" />
              </div>
              <Skel h={20} w={36} r={10} />
            </div>
          ))}
        </div>
      ) : templates.error ? null : (
        <div className="gb-card gb-templates-card">
          {list.map((t) => (
            <Row
              key={t.id}
              t={t}
              open={open === t.id}
              locationId={locationId}
              locationName={nameOf(t.locationId)}
              onToggleOpen={() => setOpen(open === t.id ? null : t.id)}
            />
          ))}
          {open === "new" ? (
            <div className="gb-templates-row">
              <div className="gb-templates-line">
                <RatingStars ratings={[5]} />
                <span className="gb-templates-title">New template</span>
              </div>
              <Editor
                initial={{ name: "", ratings: [5], variants: [""], preset: false }}
                locationId={locationId}
                onDone={() => setOpen(null)}
              />
            </div>
          ) : (
            <button type="button" className="gb-templates-add" onClick={() => setOpen("new")}>
              <span aria-hidden style={{ fontSize: 16 }}>
                +
              </span>
              New template
            </button>
          )}
        </div>
      )}
    </div>
  );
}
