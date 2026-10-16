"use client";

import { useMemo, useRef, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  useDeleteTemplate,
  useDuplicateTemplate,
  usePlayApps,
  usePlayTemplates,
  useSaveTemplate,
} from "@/lib/api/queries";
import type { PlayTemplate } from "@/lib/api/types";

import { fillSample, PLACEHOLDERS, PRESET_ORDER, ratingRange } from "./tokens";
import { PageHead, Skel, useToast } from "./ui";

interface Draft {
  id: string;
  name: string;
  ratings: number[];
  bodies: { language: string; variants: string[] }[];
}

const toDraft = (t: PlayTemplate): Draft => ({
  id: t.id,
  name: t.name,
  ratings: t.ratings,
  bodies: t.bodies.map((b) => ({ language: b.language, variants: [...b.variants] })),
});

export function TemplatesPage() {
  const toast = useToast();
  const templates = usePlayTemplates();
  const apps = usePlayApps();
  const saveT = useSaveTemplate();
  const dup = useDuplicateTemplate();
  const del = useDeleteTemplate();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lang, setLang] = useState(0);
  const [variant, setVariant] = useState(0);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const list = useMemo(() => templates.data?.data ?? [], [templates.data]);
  const custom = list.filter((t) => !t.builtIn);
  const builtin = list
    .filter((t) => t.builtIn)
    .sort(
      (a, b) => PRESET_ORDER.indexOf(a.presetKey ?? "") - PRESET_ORDER.indexOf(b.presetKey ?? ""),
    );
  const tpl = list.find((t) => t.id === selected) ?? builtin[0] ?? custom[0] ?? null;

  if (tpl && draft?.id !== tpl.id) {
    setDraft(toDraft(tpl));
    setLang(0);
    setVariant(0);
    setStatus("idle");
  }

  const app = apps.data?.data[0];
  const sample = {
    user_name: "Maya",
    first_name: "Maya",
    app_name: app?.title ?? "Your app",
    rating: "5",
    support_email: "help@yourapp.com",
    version: "v3.2",
    latest_version: "v3.2",
    developer_name: "Sam",
    team_name: "Sam",
  };

  const builtIn = Boolean(tpl?.builtIn);
  const body = draft?.bodies[lang]?.variants[variant] ?? "";
  const preview = fillSample(body, sample);
  const len = [...preview].length;

  function persist(next: Draft) {
    setDraft(next);
    if (builtIn) return;
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(() => {
      saveT.mutate(
        {
          id: next.id,
          body: {
            name: next.name.trim() || "Untitled template",
            ratings: next.ratings,
            bodies: next.bodies.map((b) => ({
              language: b.language,
              variants: b.variants.length ? b.variants : [""],
            })),
          },
        },
        {
          onSuccess: () => setStatus("saved"),
          onError: (err) => {
            setStatus("error");
            toast(errorMessage(err));
          },
        },
      );
    }, 600);
  }

  const readOnly = () => toast("Duplicate to edit a pre-built template");

  const setBody = (value: string) => {
    if (!draft) return;
    persist({
      ...draft,
      bodies: draft.bodies.map((b, i) =>
        i === lang ? { ...b, variants: b.variants.map((v, j) => (j === variant ? value : v)) } : b,
      ),
    });
  };

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Templates"
        sub="The skeleton of every reply. AI fills the placeholders and adapts the tone."
        actions={
          <button
            type="button"
            className="rp-btn"
            disabled={saveT.isPending && !draft}
            onClick={() =>
              saveT.mutate(
                {
                  body: {
                    name: "Untitled template",
                    ratings: [],
                    bodies: [{ language: "en", variants: [""] }],
                  },
                },
                {
                  onSuccess: (t) => {
                    setSelected(t.id);
                    setTimeout(() => ref.current?.focus(), 50);
                  },
                  onError: (err) => toast(errorMessage(err)),
                },
              )
            }
          >
            New template
          </button>
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px,280px) minmax(0,1fr)",
          gap: 20,
          alignItems: "start",
        }}
        className="rp-tpl-grid"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="rp-label" style={{ padding: "0 10px 4px" }}>
              Yours
            </span>
            {!custom.length ? (
              <span style={{ padding: "8px 10px", fontSize: 13, color: "#6C6962" }}>
                {templates.isPending ? "Loading…" : "None yet. Duplicate a pre-built one to start."}
              </span>
            ) : null}
            {custom.map((t) => (
              <TplItem key={t.id} t={t} on={t.id === tpl?.id} pick={() => setSelected(t.id)} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="rp-label" style={{ padding: "0 10px 4px" }}>
              Pre-built
            </span>
            {templates.isPending ? (
              <Skel h={120} />
            ) : (
              builtin.map((t) => (
                <TplItem key={t.id} t={t} on={t.id === tpl?.id} pick={() => setSelected(t.id)} />
              ))
            )}
          </div>
        </div>
        {tpl && draft ? (
          <div
            className="rp-card"
            style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                aria-label="Template name"
                value={draft.name}
                readOnly={builtIn}
                onChange={(e) => persist({ ...draft, name: e.target.value })}
                style={{
                  flex: 1,
                  minWidth: 180,
                  border: "none",
                  fontSize: 18,
                  fontWeight: 600,
                  outline: "none",
                  padding: 0,
                  color: "#191917",
                  background: "transparent",
                }}
              />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {!builtIn && status !== "idle" ? (
                  <span style={{ fontSize: 12, color: status === "error" ? "#B42318" : "#6C6962" }}>
                    {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Not saved"}
                  </span>
                ) : null}
                {builtIn ? (
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: 999,
                      background: "#EFEDE8",
                      color: "#55534E",
                      fontSize: 12,
                      alignSelf: "center",
                    }}
                  >
                    Read-only
                  </span>
                ) : null}
                <button
                  type="button"
                  className="rp-btn-light"
                  style={{ padding: "6px 12px", fontSize: 12.5 }}
                  disabled={dup.isPending}
                  onClick={() =>
                    dup.mutate(tpl.id, {
                      onSuccess: (t) => {
                        setSelected(t.id);
                        toast("Duplicated — now editable");
                      },
                      onError: (err) => toast(errorMessage(err)),
                    })
                  }
                >
                  Duplicate
                </button>
                {!builtIn ? (
                  <button
                    type="button"
                    className="rp-btn-light rp-btn-danger"
                    style={{ padding: "6px 12px", fontSize: 12.5 }}
                    disabled={del.isPending}
                    onClick={() =>
                      del.mutate(tpl.id, {
                        onSuccess: () => {
                          setSelected(null);
                          setDraft(null);
                          toast("Template deleted");
                        },
                        onError: (err) => toast(errorMessage(err)),
                      })
                    }
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "#6C6962" }}>Use for</span>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = draft.ratings.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    className="rp-mono"
                    onClick={() =>
                      builtIn
                        ? readOnly()
                        : persist({
                            ...draft,
                            ratings: on
                              ? draft.ratings.filter((x) => x !== n)
                              : [...draft.ratings, n],
                          })
                    }
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: `1px solid ${on ? "#191917" : "#E6E4DF"}`,
                      background: on ? "#191917" : "#fff",
                      color: on ? "#fff" : "#55534E",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {n}★
                  </button>
                );
              })}
            </div>
            <Wordings
              draft={draft}
              lang={lang}
              variant={variant}
              builtIn={builtIn}
              setLang={setLang}
              setVariant={setVariant}
              persist={persist}
              readOnly={readOnly}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                ref={ref}
                aria-label="Template text"
                value={body}
                readOnly={builtIn}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Hi {user_name}, thanks for…"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #E6E4DF",
                  background: "#FAF9F7",
                  fontFamily: "var(--rp-mono)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  resize: "vertical",
                  outline: "none",
                  color: "#191917",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PLACEHOLDERS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="rp-ph"
                      onClick={() => {
                        if (builtIn) return readOnly();
                        const el = ref.current;
                        const ph = `{${k}}`;
                        const pos = el ? el.selectionStart : body.length;
                        setBody(body.slice(0, pos) + ph + body.slice(pos));
                        requestAnimationFrame(() => {
                          el?.focus();
                          el?.setSelectionRange(pos + ph.length, pos + ph.length);
                        });
                      }}
                    >
                      {`{${k}}`}
                    </button>
                  ))}
                </div>
                <span
                  className="rp-mono"
                  style={{ fontSize: 11.5, color: len > 350 ? "#B42318" : "#6C6962" }}
                >
                  {len}/350
                </span>
              </div>
              {tpl.problems.length && !builtIn ? (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12.5,
                    color: "#8A5A00",
                    lineHeight: 1.5,
                  }}
                >
                  {tpl.problems.map((p, i) => (
                    <li key={i}>{p.problem}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="rp-label">Preview on Google Play</span>
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: "#F7F6F3",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600 }}>{sample.app_name}</span>
                  <span style={{ color: "#6C6962" }}>
                    {new Date().toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </span>
                <span
                  style={{
                    lineHeight: 1.55,
                    fontSize: 13.5,
                    color: "#33322F",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {preview || "Your reply preview appears here."}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rp-card" style={{ padding: 20 }}>
            <Skel h={200} />
          </div>
        )}
      </div>
    </div>
  );
}

function TplItem({ t, on, pick }: { t: PlayTemplate; on: boolean; pick: () => void }) {
  return (
    <button
      type="button"
      className={`rp-tpl-item${on ? "rp-tpl-on" : ""}`}
      aria-current={on || undefined}
      onClick={pick}
    >
      <span>{t.name}</span>
      <span className="rp-mono" style={{ fontSize: 11.5, color: "#6C6962" }}>
        {ratingRange(t.ratings)}
      </span>
    </button>
  );
}

function Wordings({
  draft,
  lang,
  variant,
  builtIn,
  setLang,
  setVariant,
  persist,
  readOnly,
}: {
  draft: Draft;
  lang: number;
  variant: number;
  builtIn: boolean;
  setLang: (n: number) => void;
  setVariant: (n: number) => void;
  persist: (d: Draft) => void;
  readOnly: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const body = draft.bodies[lang];
  if (builtIn && draft.bodies.length === 1 && (body?.variants.length ?? 0) <= 1) return null;
  const chip = (on: boolean) => ({
    padding: "3px 9px",
    borderRadius: 999,
    border: `1px solid ${on ? "#191917" : "#E6E4DF"}`,
    background: on ? "#EFEDE8" : "#fff",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "var(--rp-mono)",
    color: "#191917",
  });
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        alignItems: "center",
        fontSize: 12.5,
        color: "#6C6962",
      }}
    >
      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        Language
        {draft.bodies.map((b, i) => (
          <button
            key={b.language}
            type="button"
            style={chip(i === lang)}
            onClick={() => {
              setLang(i);
              setVariant(0);
            }}
          >
            {b.language}
          </button>
        ))}
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim();
              if (!c || draft.bodies.some((b) => b.language === c)) return setAdding(false);
              persist({ ...draft, bodies: [...draft.bodies, { language: c, variants: [""] }] });
              setLang(draft.bodies.length);
              setVariant(0);
              setAdding(false);
              setCode("");
            }}
          >
            <input
              autoFocus
              className="rp-input rp-mono"
              aria-label="Language code"
              placeholder="es"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onBlur={() => setAdding(false)}
              style={{ width: 70, padding: "3px 8px" }}
            />
          </form>
        ) : (
          <button
            type="button"
            style={chip(false)}
            onClick={() => (builtIn ? readOnly() : setAdding(true))}
          >
            +
          </button>
        )}
      </span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        Wording
        {(body?.variants ?? []).map((_, i) => (
          <button key={i} type="button" style={chip(i === variant)} onClick={() => setVariant(i)}>
            {i + 1}
          </button>
        ))}
        <button
          type="button"
          style={chip(false)}
          onClick={() => {
            if (builtIn) return readOnly();
            persist({
              ...draft,
              bodies: draft.bodies.map((b, i) =>
                i === lang ? { ...b, variants: [...b.variants, ""] } : b,
              ),
            });
            setVariant(body?.variants.length ?? 0);
          }}
        >
          +
        </button>
        {!builtIn && (body?.variants.length ?? 0) > 1 ? (
          <button
            type="button"
            className="rp-btn-quiet"
            style={{ fontSize: 12 }}
            onClick={() => {
              persist({
                ...draft,
                bodies: draft.bodies.map((b, i) =>
                  i === lang ? { ...b, variants: b.variants.filter((_, j) => j !== variant) } : b,
                ),
              });
              setVariant(0);
            }}
          >
            Remove wording
          </button>
        ) : null}
        {!builtIn && draft.bodies.length > 1 ? (
          <button
            type="button"
            className="rp-btn-quiet"
            style={{ fontSize: 12 }}
            onClick={() => {
              persist({ ...draft, bodies: draft.bodies.filter((_, i) => i !== lang) });
              setLang(0);
              setVariant(0);
            }}
          >
            Remove language
          </button>
        ) : null}
      </span>
    </div>
  );
}
