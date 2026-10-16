"use client";

import { ArrowDown, ArrowUp, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, inputClass } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import { usePlayRules, usePlayTemplates, useSaveRules, useUpdatePlayApp } from "@/lib/api/queries";
import type { PlayAppDetail, PlayRule, PlayRuleInput, PlayTemplate } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { Segmented, Switch, splitList } from "./controls";
import { Chip } from "./reviews-tab";

type Draft = PlayRuleInput & { key: string };

const toDraft = (r: PlayRule, i: number): Draft => ({
  key: r.id ?? String(i),
  id: r.id,
  name: r.name,
  enabled: r.enabled,
  conditions: r.conditions,
  action: r.action,
  mode: r.mode,
  delayMinutes: r.delayMinutes,
});

export function RulesTab({
  app,
  onOpenSettings,
}: {
  app: PlayAppDetail;
  onOpenSettings: () => void;
}) {
  const rules = usePlayRules(app.id);
  const templates = usePlayTemplates(app.id);
  if (rules.isPending || templates.isPending) return <Skeleton className="h-96" />;
  if (rules.isError || templates.isError)
    return (
      <ErrorState
        message={errorMessage(rules.error ?? templates.error)}
        onRetry={() => {
          void rules.refetch();
          void templates.refetch();
        }}
      />
    );
  return (
    <RulesEditor
      key={rules.dataUpdatedAt}
      app={app}
      initial={rules.data.data.map(toDraft)}
      templates={templates.data.data}
      onOpenSettings={onOpenSettings}
    />
  );
}

function RulesEditor({
  app,
  initial,
  templates,
  onOpenSettings,
}: {
  app: PlayAppDetail;
  initial: Draft[];
  templates: PlayTemplate[];
  onOpenSettings: () => void;
}) {
  const [rules, setRules] = useState<Draft[]>(initial);
  const save = useSaveRules(app.id);
  const update = useUpdatePlayApp(app.id);
  const dirty = JSON.stringify(rules) !== JSON.stringify(initial);
  const s = app.settings;

  const patch = (key: string, next: Partial<Draft>) =>
    setRules(rules.map((r) => (r.key === key ? { ...r, ...next } : r)));
  const move = (i: number, by: number) => {
    const next = [...rules];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    setRules(next);
  };

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4 p-5">
        <Switch
          checked={app.automation}
          onChange={(automation) =>
            update.mutate(
              { automation },
              {
                onSuccess: () => toast.success(automation ? "Rules are on" : "Rules are off"),
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
          label="Run rules on new reviews"
          description="Every hour Autopilot fetches new and updated reviews and runs them through these rules, top to bottom. The first rule that matches decides what happens."
        />
        <div className="text-small text-muted bg-surface-muted flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-control)] px-3 py-2">
          <ShieldCheck className="text-success size-4" />
          <span>
            Quiet hours {s.quietHours ? `${s.quietHours.start}–${s.quietHours.end}` : "off"}
          </span>
          <span>Up to {s.dailyAutoLimit} automatic replies a day</span>
          <span>{s.neverAutoWords.length} words always need approval</span>
          <span>Reviews found when the app was added always wait for approval</span>
          <button
            type="button"
            className="text-accent font-medium underline underline-offset-4"
            onClick={onOpenSettings}
          >
            Change
          </button>
        </div>
      </Card>

      <ol className="grid gap-3">
        {rules.map((rule, i) => (
          <RuleCard
            key={rule.key}
            index={i}
            rule={rule}
            templates={templates}
            first={i === 0}
            last={i === rules.length - 1}
            onChange={(next) => patch(rule.key, next)}
            onMove={(by) => move(i, by)}
            onRemove={() => setRules(rules.filter((r) => r.key !== rule.key))}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setRules([
              ...rules,
              {
                key: `new-${Date.now()}`,
                name: "New rule",
                enabled: true,
                conditions: {},
                action: templates[0]
                  ? { type: "template", templateId: templates[0].id }
                  : { type: "skip" },
                mode: "approval",
                delayMinutes: 60,
              },
            ])
          }
        >
          <Plus /> Add rule
        </Button>
        <span className="flex-1" />
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={() => setRules(initial)}>
            Undo changes
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={!dirty}
          loading={save.isPending}
          onClick={() =>
            save.mutate(
              rules.map((r) => ({
                id: r.id,
                name: r.name,
                enabled: r.enabled,
                conditions: r.conditions,
                action: r.action,
                mode: r.mode,
                delayMinutes: r.delayMinutes,
              })),
              {
                onSuccess: () => toast.success("Rules saved"),
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        >
          Save rules
        </Button>
      </div>
    </div>
  );
}

function ListInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string[];
  onChange: (v: string[] | undefined) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState((value ?? []).join(", "));
  return (
    <Field label={label}>
      {(p) => (
        <Input
          {...p}
          className="h-9 text-[14px]"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const list = splitList(text);
            onChange(list.length ? list : undefined);
          }}
        />
      )}
    </Field>
  );
}

function RuleCard({
  index,
  rule,
  templates,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  rule: Draft;
  templates: PlayTemplate[];
  first: boolean;
  last: boolean;
  onChange: (next: Partial<Draft>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const c = rule.conditions;
  const stars = c.stars ?? [];
  const actionValue =
    rule.action.type === "template" ? `t:${rule.action.templateId}` : rule.action.type;
  const [open, setOpen] = useState(rule.key.startsWith("new-"));
  const template =
    rule.action.type === "template" ? templates.find((t) => t.id === rule.action.templateId) : null;
  const when = [
    stars.length ? stars.map((n) => `${n}★`).join(" ") : "Any rating",
    c.keywordsAny?.length
      ? `mentions ${c.keywordsAny.slice(0, 3).join(", ")}${c.keywordsAny.length > 3 ? "…" : ""}`
      : null,
    c.keywordsNone?.length ? `not ${c.keywordsNone.slice(0, 2).join(", ")}` : null,
    c.languages?.length ? c.languages.join(", ") : null,
    c.appVersions?.length ? `version ${c.appVersions.join(", ")}` : null,
    c.edited === true ? "updated after our reply" : c.edited === false ? "not replied yet" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const then =
    rule.action.type === "claude"
      ? "Ask Claude to draft"
      : rule.action.type === "skip"
        ? "Don't reply"
        : `Reply with “${template?.name ?? "missing template"}” · ${rule.mode === "auto" ? "automatically" : "after I approve"} · wait ${rule.delayMinutes} min`;
  return (
    <li>
      <Card className={cn("grid gap-4 p-4 sm:p-5", !rule.enabled && "opacity-70")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-surface-muted text-muted grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold">
            {index + 1}
          </span>
          {open ? (
            <Input
              aria-label="Rule name"
              className="h-9 min-w-40 flex-1 text-[14px] font-medium"
              value={rule.name}
              maxLength={60}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          ) : (
            <div className="min-w-40 flex-1">
              <h3 className="text-[14px] font-semibold">{rule.name}</h3>
              <p className="text-small text-muted mt-0.5">
                <span className="text-foreground font-medium">When</span> {when}{" "}
                <span className="text-foreground font-medium">→</span> {then}
              </p>
            </div>
          )}
          <Button
            size="sm"
            variant={open ? "secondary" : "ghost"}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            {open ? "Done" : "Edit"}
          </Button>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label="Move up"
              disabled={first}
              onClick={() => onMove(-1)}
            >
              <ArrowUp />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label="Move down"
              disabled={last}
              onClick={() => onMove(1)}
            >
              <ArrowDown />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-danger hover:bg-danger-soft hover:text-danger size-8"
              aria-label={`Delete ${rule.name}`}
              onClick={onRemove}
            >
              <Trash2 />
            </Button>
          </div>
          <div className="w-full sm:w-auto">
            <Switch
              checked={rule.enabled}
              onChange={(enabled) => onChange({ enabled })}
              label="On"
            />
          </div>
        </div>

        {open ? (
          <>
            <fieldset className="grid gap-3">
              <legend className="text-small text-muted mb-1 font-medium tracking-wide uppercase">
                When
              </legend>
              <div role="group" aria-label="Stars" className="flex flex-wrap items-center gap-1.5">
                <span className="text-small mr-1">Stars</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Chip
                    key={n}
                    pressed={stars.includes(n)}
                    onClick={() => {
                      const next = stars.includes(n)
                        ? stars.filter((s) => s !== n)
                        : [...stars, n].sort();
                      onChange({ conditions: { ...c, stars: next.length ? next : undefined } });
                    }}
                  >
                    {n}★
                  </Chip>
                ))}
                {!stars.length ? <span className="text-caption text-muted">any rating</span> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ListInput
                  label="Contains any of these words"
                  value={c.keywordsAny}
                  placeholder="Any words, e.g. crash, refund"
                  onChange={(keywordsAny) => onChange({ conditions: { ...c, keywordsAny } })}
                />
                <ListInput
                  label="But none of these"
                  value={c.keywordsNone}
                  placeholder="optional"
                  onChange={(keywordsNone) => onChange({ conditions: { ...c, keywordsNone } })}
                />
                <ListInput
                  label="Languages"
                  value={c.languages}
                  placeholder="Any language, or en, hi"
                  onChange={(languages) => onChange({ conditions: { ...c, languages } })}
                />
                <ListInput
                  label="App versions"
                  value={c.appVersions}
                  placeholder="Any version, or 2.3"
                  onChange={(appVersions) => onChange({ conditions: { ...c, appVersions } })}
                />
              </div>
              <Field label="Review">
                {(p) => (
                  <select
                    {...p}
                    className={cn(inputClass, "h-9 text-[14px] sm:max-w-sm")}
                    value={c.edited === undefined ? "any" : c.edited ? "edited" : "new"}
                    onChange={(e) =>
                      onChange({
                        conditions: {
                          ...c,
                          edited:
                            e.target.value === "any" ? undefined : e.target.value === "edited",
                        },
                      })
                    }
                  >
                    <option value="any">New or updated</option>
                    <option value="new">Only reviews we haven&apos;t replied to</option>
                    <option value="edited">Only reviews updated after our reply</option>
                  </select>
                )}
              </Field>
            </fieldset>

            <fieldset className="grid gap-3">
              <legend className="text-small text-muted mb-1 font-medium tracking-wide uppercase">
                Then
              </legend>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Reply with" className="min-w-56 flex-1">
                  {(p) => (
                    <select
                      {...p}
                      className={cn(inputClass, "h-9 text-[14px]")}
                      value={actionValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        onChange({
                          action: v.startsWith("t:")
                            ? { type: "template", templateId: v.slice(2) }
                            : { type: v as "claude" | "skip" },
                          ...(v.startsWith("t:") ? {} : { mode: "approval" as const }),
                        });
                      }}
                    >
                      <optgroup label="Templates">
                        {templates.map((t) => (
                          <option key={t.id} value={`t:${t.id}`}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                      <option value="claude">Ask Claude to draft a reply</option>
                      <option value="skip">Don&apos;t reply</option>
                    </select>
                  )}
                </Field>
                <div className="grid gap-1.5">
                  <span className="text-small font-medium">Send</span>
                  <Segmented
                    label="Send mode"
                    value={rule.mode}
                    disabled={rule.action.type !== "template"}
                    onChange={(mode) => onChange({ mode })}
                    options={[
                      { value: "approval", label: "After I approve" },
                      { value: "auto", label: "Automatically" },
                    ]}
                  />
                </div>
                <Field label="Wait (minutes)" className="w-32">
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      min={0}
                      max={1440}
                      className="h-9 text-[14px]"
                      value={rule.delayMinutes}
                      onChange={(e) =>
                        onChange({
                          delayMinutes: Math.max(0, Math.min(1440, Number(e.target.value) || 0)),
                        })
                      }
                    />
                  )}
                </Field>
              </div>
              {rule.mode === "auto" && rule.action.type === "template" ? (
                <p className="text-small text-warning">
                  Replies from this rule go out on their own after the wait, outside quiet hours and
                  within the daily limit.
                </p>
              ) : rule.action.type === "claude" ? (
                <p className="text-small text-muted">
                  These reviews wait in “For Claude”. Ask Claude to draft them; drafts come back for
                  your approval.
                </p>
              ) : null}
            </fieldset>
          </>
        ) : null}
      </Card>
    </li>
  );
}
