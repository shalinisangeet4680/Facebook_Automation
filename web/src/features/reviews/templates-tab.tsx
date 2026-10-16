"use client";

import { AlertTriangle, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea, inputClass } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import {
  useCheckTemplate,
  useDeleteTemplate,
  usePlayTemplates,
  useRestorePresets,
  useSaveTemplate,
} from "@/lib/api/queries";
import type {
  PlayAppDetail,
  PlayTemplate,
  PlayTemplateBody,
  PlayTemplateCheck,
  PlayTemplateInput,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { CATEGORY, LANGUAGES, REPLY_MAX, languageLabel } from "./labels";

export function TemplatesTab({ app }: { app: PlayAppDetail }) {
  const templates = usePlayTemplates(app.id);
  const restore = useRestorePresets();
  const [editing, setEditing] = useState<PlayTemplate | "new" | null>(null);

  if (templates.isPending) return <Skeleton className="h-64" />;
  if (templates.isError)
    return (
      <ErrorState
        message={errorMessage(templates.error)}
        onRetry={() => void templates.refetch()}
      />
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-muted max-w-2xl text-[14px]">
          Templates fill in placeholders like {"{{first_name}}"} and {"{{support_email}}"} for each
          review and pick the wording in the reviewer&apos;s language. Several wordings rotate so
          replies don&apos;t look copy-pasted.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={restore.isPending}
            onClick={() =>
              restore.mutate(undefined, {
                onSuccess: (r) =>
                  toast.success(
                    r.restored
                      ? `${r.restored} preset templates restored`
                      : "All presets are already here",
                  ),
              })
            }
          >
            <RotateCcw /> Restore presets
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> New template
          </Button>
        </div>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {templates.data.data.map((t) => (
          <TemplateCard key={t.id} template={t} onEdit={() => setEditing(t)} />
        ))}
      </ul>
      {editing ? (
        <TemplateEditor
          key={editing === "new" ? "new" : editing.id}
          app={app}
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function TemplateCard({ template, onEdit }: { template: PlayTemplate; onEdit: () => void }) {
  const remove = useDeleteTemplate();
  const first = template.bodies[0]?.variants[0] ?? "";
  return (
    <li>
      <Card className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold">{template.name}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone="accent">{CATEGORY[template.category]}</Badge>
              <Badge tone="outline">{template.appId ? "This app only" : "All apps"}</Badge>
              {template.presetKey ? <Badge>Preset</Badge> : null}
              {template.bodies.map((b) => (
                <Badge key={b.language} tone="outline">
                  {languageLabel(b.language)}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <p className="text-muted line-clamp-3 text-[14px] leading-6">{first}</p>
        {template.problems.length ? (
          <p className="text-small text-warning flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {template.problems[0]!.problem}
            {template.problems.length > 1 ? ` (+${template.problems.length - 1} more)` : ""}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-caption text-muted">
            {template.bodies.reduce((n, b) => n + b.variants.length, 0)} wordings
            {template.usedBy.length
              ? ` · used by ${template.usedBy.length} rule${template.usedBy.length > 1 ? "s" : ""}`
              : ""}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-danger hover:bg-danger-soft hover:text-danger size-8"
              aria-label={`Delete ${template.name}`}
              disabled={template.usedBy.length > 0}
              title={template.usedBy.length ? "Rules use this template" : undefined}
              onClick={() =>
                remove.mutate(template.id, {
                  onSuccess: () => toast.success("Template deleted"),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </Card>
    </li>
  );
}

const EMPTY: PlayTemplateInput = {
  name: "",
  category: "custom",
  bodies: [{ language: "en", variants: [""] }],
};

function TemplateEditor({
  app,
  template,
  onClose,
}: {
  app: PlayAppDetail;
  template: PlayTemplate | null;
  onClose: () => void;
}) {
  const save = useSaveTemplate();
  const check = useCheckTemplate();
  const [draft, setDraft] = useState<PlayTemplateInput>(
    template
      ? {
          name: template.name,
          category: template.category,
          bodies: template.bodies,
          appId: template.appId,
        }
      : { ...EMPTY, appId: null },
  );
  const [lang, setLang] = useState(0);
  const [result, setResult] = useState<PlayTemplateCheck | null>(null);
  const focus = useRef<{ variant: number; el: HTMLTextAreaElement | null }>({
    variant: 0,
    el: null,
  });
  const body = draft.bodies[lang] ?? draft.bodies[0]!;
  const checkMutate = check.mutate;

  useEffect(() => {
    const t = window.setTimeout(
      () => checkMutate({ bodies: draft.bodies, appId: app.id }, { onSuccess: setResult }),
      400,
    );
    return () => window.clearTimeout(t);
  }, [draft.bodies, app.id, checkMutate]);

  const setBody = (next: PlayTemplateBody) =>
    setDraft({ ...draft, bodies: draft.bodies.map((b, i) => (i === lang ? next : b)) });

  const insert = (token: string) => {
    const { variant, el } = focus.current;
    const current = body.variants[variant] ?? "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    setBody({ ...body, variants: body.variants.map((v, i) => (i === variant ? next : v)) });
    window.requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const values = Object.keys(app.variables);
  const chips = [
    ...app.builtInVariables.map((v) => ({ name: v, filled: true })),
    ...[...new Set([...values, ...app.suggestedVariables])].map((v) => ({
      name: v,
      filled: values.includes(v),
    })),
  ];
  const unusedLanguages = Object.keys(LANGUAGES).filter(
    (l) => !draft.bodies.some((b) => b.language === l),
  );
  const samples = result?.samples.filter((s) => s.language === body.language) ?? [];
  const problems = result?.problems ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={template ? `Edit “${template.name}”` : "New template"}
        className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto"
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                id: template?.id,
                body: {
                  ...draft,
                  bodies: draft.bodies.map((b) => ({
                    ...b,
                    variants: b.variants.filter((v) => v.trim()),
                  })),
                },
              },
              {
                onSuccess: () => {
                  toast.success("Template saved");
                  onClose();
                },
              },
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" className="sm:col-span-1">
              {(p) => (
                <Input
                  {...p}
                  required
                  maxLength={60}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              )}
            </Field>
            <Field label="Category">
              {(p) => (
                <select
                  {...p}
                  className={inputClass}
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      category: e.target.value as PlayTemplateInput["category"],
                    })
                  }
                >
                  {Object.entries(CATEGORY).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Use for">
              {(p) => (
                <select
                  {...p}
                  className={inputClass}
                  value={draft.appId ? "app" : "all"}
                  onChange={(e) =>
                    setDraft({ ...draft, appId: e.target.value === "app" ? app.id : null })
                  }
                >
                  <option value="all">All apps</option>
                  <option value="app">{app.title} only</option>
                </select>
              )}
            </Field>
          </div>

          <div role="tablist" aria-label="Languages" className="flex flex-wrap items-center gap-2">
            {draft.bodies.map((b, i) => (
              <span key={b.language} className="inline-flex items-center">
                <button
                  type="button"
                  role="tab"
                  aria-selected={i === lang}
                  onClick={() => setLang(i)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[13px] font-medium",
                    i === lang
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-muted hover:text-foreground",
                  )}
                >
                  {languageLabel(b.language)}
                  {i === 0 ? " · default" : ""}
                </button>
                {draft.bodies.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove ${languageLabel(b.language)}`}
                    className="text-muted hover:text-danger ml-0.5 grid size-6 place-items-center rounded-full"
                    onClick={() => {
                      setDraft({ ...draft, bodies: draft.bodies.filter((_, j) => j !== i) });
                      setLang(0);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </span>
            ))}
            {unusedLanguages.length ? (
              <select
                aria-label="Add a language"
                className={cn(inputClass, "h-8 w-auto text-[13px]")}
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDraft({
                    ...draft,
                    bodies: [...draft.bodies, { language: e.target.value, variants: [""] }],
                  });
                  setLang(draft.bodies.length);
                }}
              >
                <option value="">+ Language</option>
                {unusedLanguages.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGES[l]}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <p className="text-caption text-muted -mt-2">
            Reviews in a language you haven&apos;t added get the default (first) language.
          </p>

          <div>
            <p className="text-small mb-2 font-medium">Insert a placeholder</p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => insert(c.filled ? `{{${c.name}}}` : `{{${c.name}|}}`)}
                  title={
                    c.filled
                      ? "Filled automatically or from Settings"
                      : "No value in Settings yet; inserted with an empty fallback"
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[12px]",
                    c.filled
                      ? "border-accent/40 bg-accent-soft/40 text-accent"
                      : "border-border text-muted border-dashed",
                  )}
                >
                  {`{{${c.name}}}`}
                </button>
              ))}
            </div>
            <p className="text-caption text-muted mt-1.5">
              Add a fallback after a bar for when a value is missing: {"{{first_name|there}}"}.
              Values like your support number live in this app&apos;s Settings.
            </p>
          </div>

          <ol className="grid gap-3">
            {body.variants.map((v, i) => {
              const sample = samples.find((s) => s.variant === i);
              return (
                <li key={i} className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor={`variant-${i}`} className="text-small font-medium">
                      Wording {i + 1}
                    </label>
                    {body.variants.length > 1 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setBody({ ...body, variants: body.variants.filter((_, j) => j !== i) })
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <Textarea
                    id={`variant-${i}`}
                    value={v}
                    onFocus={(e) => (focus.current = { variant: i, el: e.currentTarget })}
                    onSelect={(e) => (focus.current = { variant: i, el: e.currentTarget })}
                    onChange={(e) =>
                      setBody({
                        ...body,
                        variants: body.variants.map((x, j) => (j === i ? e.target.value : x)),
                      })
                    }
                    className="min-h-20 font-mono text-[13px]"
                  />
                  {sample && v.trim() ? (
                    <div className="bg-surface-muted rounded-[var(--radius-control)] px-3 py-2">
                      <p className="text-caption text-muted flex justify-between gap-2">
                        <span>Preview for Priya</span>
                        <span
                          className={cn(
                            "tabular-nums",
                            sample.length > REPLY_MAX && "text-danger font-semibold",
                          )}
                        >
                          {sample.length}/{REPLY_MAX}
                        </span>
                      </p>
                      <p className="mt-1 text-[14px] leading-6">{sample.text}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {body.variants.length < 10 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="justify-self-start"
              onClick={() => setBody({ ...body, variants: [...body.variants, ""] })}
            >
              <Plus /> Add another wording
            </Button>
          ) : null}

          {problems.length ? (
            <ul className="border-warning/40 bg-warning-soft grid gap-1 rounded-[var(--radius-control)] border px-3 py-2">
              {problems.map((p, i) => (
                <li key={i} className="text-small flex gap-1.5">
                  <AlertTriangle className="text-warning mt-0.5 size-3.5 shrink-0" />
                  {languageLabel(p.language)}, wording {p.variant + 1}: {p.problem}
                </li>
              ))}
            </ul>
          ) : null}
          {save.isError ? (
            <p role="alert" className="text-small text-danger">
              {errorMessage(save.error)}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={save.isPending} disabled={!draft.name.trim()}>
              Save template
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
