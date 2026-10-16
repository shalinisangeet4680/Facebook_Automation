"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  type GbpTemplate,
  useBusinessTemplateHidden,
  useBusinessTemplates,
  useDeleteBusinessTemplate,
  useSaveBusinessTemplate,
} from "@/lib/api/business";
import { rowBorder, stars } from "@/features/replyly/tokens";
import { Banner, PageHead, Seg, Skel, Spinner, Toggle, useToast } from "@/features/replyly/ui";

const MUTED = "#6C6962";
const CHIPS = [
  "user_name",
  "business_name",
  "rating",
  "team_name",
  "phone",
  "support_email",
  "website",
];
const SAMPLE: Record<string, string> = {
  user_name: "Priya",
  first_name: "Priya",
  business_name: "Sharma Dental Clinic",
  rating: "5",
  team_name: "Dr. Sharma & team",
  phone: "+91 612 220 4455",
  support_email: "care@sharmadental.in",
  website: "https://sharmadental.in",
};

const fill = (text: string) =>
  text.replace(
    /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}|\{([a-z_]+)\}/g,
    (_, a: string, fb: string, b: string) => SAMPLE[a ?? b] ?? fb ?? "",
  );

interface Draft {
  id?: string;
  name: string;
  ratings: number[];
  variants: string[];
}

function Editor({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const toast = useToast();
  const save = useSaveBusinessTemplate();
  const [d, setD] = useState(initial);
  const [active, setActive] = useState(0);
  const text = d.variants[active] ?? "";
  const category = d.ratings.some((r) => r <= 2)
    ? "negative"
    : d.ratings.includes(3)
      ? "neutral"
      : "positive";

  return (
    <div
      className="rp-card"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))",
      }}
    >
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <label className="rp-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="rp-label">Name</span>
          <input
            className="rp-input"
            value={d.name}
            maxLength={60}
            onChange={(e) => setD({ ...d, name: e.target.value })}
            placeholder="Thanks for visiting"
          />
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="rp-label">For ratings</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[5, 4, 3, 2, 1].map((n) => {
              const on = d.ratings.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  className="rp-chip"
                  style={{ background: on ? "#191917" : undefined, color: on ? "#fff" : undefined }}
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
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className="rp-label">Wording</span>
            <Seg
              label="Wordings"
              value={String(active)}
              small
              onChange={(v) => setActive(Number(v))}
              options={d.variants.map((_, i) => ({ id: String(i), label: `#${i + 1}` }))}
            />
          </div>
          <textarea
            className="rp-textarea"
            rows={6}
            value={text}
            onChange={(e) =>
              setD({
                ...d,
                variants: d.variants.map((v, i) => (i === active ? e.target.value : v)),
              })
            }
            style={{ resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className="rp-chip rp-mono"
                style={{ fontSize: 11.5 }}
                onClick={() =>
                  setD({
                    ...d,
                    variants: d.variants.map((v, i) => (i === active ? `${v}{${c}}` : v)),
                  })
                }
              >
                {`{${c}}`}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: MUTED }}>
            Add more wordings so replies don’t repeat; TreeVook rotates them. Use{" "}
            {"{{phone|the clinic}}"} for a fallback.
          </span>
          {d.variants.length < 10 ? (
            <button
              type="button"
              className="rp-btn-text"
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                setD({ ...d, variants: [...d.variants, ""] });
                setActive(d.variants.length);
              }}
            >
              + Add wording
            </button>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="rp-btn-text" onClick={onDone}>
            Cancel
          </button>
          <button
            type="button"
            className="rp-btn"
            style={{ padding: "8px 14px" }}
            disabled={save.isPending || !d.name.trim() || !d.variants.some((v) => v.trim())}
            onClick={() =>
              save.mutate(
                {
                  id: d.id,
                  name: d.name,
                  category,
                  ratings: d.ratings,
                  bodies: [{ language: "en", variants: d.variants.filter((v) => v.trim()) }],
                },
                {
                  onSuccess: () => {
                    toast("Template saved");
                    onDone();
                  },
                  onError: (err) => toast(errorMessage(err)),
                },
              )
            }
          >
            {save.isPending ? <Spinner size={11} /> : null}
            Save template
          </button>
        </div>
      </div>
      <div
        style={{
          padding: 18,
          background: "#F7F6F3",
          borderLeft: "1px solid #EFEDE8",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <span className="rp-label">Preview</span>
        <div
          style={{
            background: "#fff",
            border: "1px solid #E6E4DF",
            borderRadius: 12,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, color: MUTED }}>Response from the owner</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {fill(text) || <span style={{ color: MUTED }}>Your reply appears here.</span>}
          </span>
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>
          AI personalizes the wording for each review when Personalize is on.
        </span>
      </div>
    </div>
  );
}

export function BusinessTemplatesPage() {
  const toast = useToast();
  const templates = useBusinessTemplates();
  const hide = useBusinessTemplateHidden();
  const remove = useDeleteBusinessTemplate();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const all = templates.data?.data ?? [];
  const hiddenCount = all.filter((t) => t.hidden).length;
  const list = all.filter((t) => showHidden || !t.hidden);
  const open = (t: GbpTemplate) =>
    setEditing({
      id: t.id,
      name: t.name,
      ratings: t.ratings,
      variants: t.bodies[0]?.variants ?? [""],
    });

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHead
        title="Templates"
        sub="Starting points for review replies. Pick one per star rating in each location’s Settings."
        actions={
          <button
            type="button"
            className="rp-btn"
            style={{ padding: "8px 14px" }}
            onClick={() => setEditing({ name: "", ratings: [5], variants: [""] })}
          >
            New template
          </button>
        }
      />
      {templates.error ? <Banner tone="error">{errorMessage(templates.error)}</Banner> : null}
      {editing ? (
        <Editor key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} />
      ) : null}
      {templates.isPending ? (
        <Skel h={200} />
      ) : (
        <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
          {list.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                gap: 14,
                padding: "14px 16px",
                borderTop: rowBorder(i),
                alignItems: "flex-start",
                flexWrap: "wrap",
                opacity: t.hidden ? 0.6 : 1,
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 240 }}
              >
                <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 500 }}>{t.name}</span>
                  {t.preset ? (
                    <span
                      style={{
                        fontSize: 11.5,
                        color: MUTED,
                        padding: "1px 7px",
                        borderRadius: 999,
                        background: "#EFEDE8",
                      }}
                    >
                      Built-in
                    </span>
                  ) : null}
                  <span style={{ color: "#C9A227", fontSize: 12 }}>
                    {t.ratings
                      .map((r) => stars(r).slice(0, r))
                      .map((s, j) => (
                        <span key={j} style={{ marginRight: 6 }}>
                          {s}
                        </span>
                      ))}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "#33322F",
                    lineHeight: 1.5,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {fill(t.bodies[0]?.variants[0] ?? "")}
                </span>
                <span style={{ fontSize: 12, color: MUTED }}>
                  {t.bodies[0]?.variants.length ?? 0} wording
                  {t.bodies[0]?.variants.length === 1 ? "" : "s"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 12,
                    color: MUTED,
                  }}
                >
                  Show
                  <Toggle
                    on={!t.hidden}
                    label={`Show ${t.name}`}
                    onChange={() =>
                      hide.mutate(
                        { id: t.id, hidden: !t.hidden },
                        { onError: (err) => toast(errorMessage(err)) },
                      )
                    }
                  />
                </span>
                <button type="button" className="rp-btn-text" onClick={() => open(t)}>
                  Edit
                </button>
                {!t.preset ? (
                  <button
                    type="button"
                    className="rp-btn-text"
                    style={{ color: "#B42318" }}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete “${t.name}”? Ratings that use it switch to AI-written replies.`,
                        )
                      )
                        remove.mutate(t.id, {
                          onSuccess: () => toast("Template deleted"),
                          onError: (err) => toast(errorMessage(err)),
                        });
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {hiddenCount ? (
        <button
          type="button"
          className="rp-btn-text"
          style={{ alignSelf: "flex-start" }}
          onClick={() => setShowHidden(!showHidden)}
        >
          {showHidden ? "Hide hidden templates" : `Show hidden (${hiddenCount})`}
        </button>
      ) : null}
    </div>
  );
}
