"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea, inputClass } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { useRemovePlayApp, useUpdatePlayApp } from "@/lib/api/queries";
import type { PlayAppDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { Switch, splitList } from "./controls";
import { LANGUAGES } from "./labels";

const HINTS: Record<string, string> = {
  team_name: "Team Acme",
  support_email: "help@acme.in",
  support_phone: "+91 98765 43210",
  support_url: "https://acme.in/help",
};

const ZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="grid gap-4 p-5">
      <div>
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {description ? <p className="text-small text-muted mt-1">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

export function SettingsTab({ app }: { app: PlayAppDetail }) {
  const update = useUpdatePlayApp(app.id);
  const [title, setTitle] = useState(app.title);
  const [rows, setRows] = useState<{ key: string; value: string }[]>(() => {
    const names = [...new Set([...app.suggestedVariables, ...Object.keys(app.variables)])];
    return names.map((key) => ({ key, value: app.variables[key] ?? "" }));
  });
  const [quiet, setQuiet] = useState(Boolean(app.settings.quietHours));
  const [start, setStart] = useState(app.settings.quietHours?.start ?? "22:00");
  const [end, setEnd] = useState(app.settings.quietHours?.end ?? "08:00");
  const [timezone, setTimezone] = useState(app.settings.timezone);
  const [limit, setLimit] = useState(app.settings.dailyAutoLimit);
  const [words, setWords] = useState(app.settings.neverAutoWords.join(", "));
  const [replyToEdited, setReplyToEdited] = useState(app.settings.replyToEdited);
  const [translateTo, setTranslateTo] = useState(app.settings.translateTo);

  const submit = () =>
    update.mutate(
      {
        title,
        variables: Object.fromEntries(
          rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]),
        ),
        settings: {
          timezone,
          quietHours: quiet ? { start, end } : null,
          dailyAutoLimit: limit,
          neverAutoWords: splitList(words),
          replyToEdited,
          translateTo,
        },
      },
      { onSuccess: () => toast.success("Settings saved") },
    );

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Section title="App">
        <Field label="Name shown in replies as {{app_name}}">
          {(p) => (
            <Input {...p} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          )}
        </Field>
      </Section>

      <Section
        title="Placeholder values"
        description="Templates fill these in. Empty values use the template's fallback, or hold the reply for you to finish."
      >
        <ul className="grid gap-2">
          {rows.map((row, i) => {
            const suggested = app.suggestedVariables.includes(row.key);
            return (
              <li
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2"
              >
                <Input
                  aria-label="Placeholder name"
                  className="h-10 font-mono text-[13px]"
                  value={row.key}
                  readOnly={suggested}
                  placeholder="placeholder_name"
                  onChange={(e) =>
                    setRows(
                      rows.map((r, j) =>
                        j === i
                          ? { ...r, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }
                          : r,
                      ),
                    )
                  }
                />
                <Input
                  aria-label={`Value for ${row.key || "placeholder"}`}
                  className="h-10 text-[14px]"
                  value={row.value}
                  placeholder={HINTS[row.key] ?? "Value"}
                  maxLength={200}
                  onChange={(e) =>
                    setRows(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                  }
                />
                {suggested ? (
                  <span className="size-9" />
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${row.key || "placeholder"}`}
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="justify-self-start"
          onClick={() => setRows([...rows, { key: "", value: "" }])}
        >
          <Plus /> Add a placeholder
        </Button>
        <p className="text-caption text-muted">
          {"{{first_name}}"}, {"{{app_name}}"} and {"{{latest_version}}"} are filled in
          automatically.
        </p>
      </Section>

      <Section title="Safeguards" description="Apply to rules that send automatically.">
        <Switch
          checked={quiet}
          onChange={setQuiet}
          label="Quiet hours"
          description="Automatic replies wait until quiet hours end."
        />
        <div className={cn("grid gap-3 sm:grid-cols-3", !quiet && "opacity-50")}>
          <Field label="From">
            {(p) => (
              <Input
                {...p}
                type="time"
                disabled={!quiet}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            )}
          </Field>
          <Field label="Until">
            {(p) => (
              <Input
                {...p}
                type="time"
                disabled={!quiet}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            )}
          </Field>
          <Field label="Time zone">
            {(p) => (
              <select
                {...p}
                className={inputClass}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {[...new Set([timezone, ...ZONES])].map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field
          label="Automatic replies per day"
          hint="After this many, replies wait for your approval until tomorrow."
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              min={0}
              max={500}
              className="sm:max-w-40"
              value={limit}
              onChange={(e) => setLimit(Math.max(0, Math.min(500, Number(e.target.value) || 0)))}
            />
          )}
        </Field>
        <Field
          label="Always ask me when a review mentions"
          hint="Comma separated. Matches inside words too, so “harass” covers “harassment”."
        >
          {(p) => (
            <Textarea
              {...p}
              className="min-h-20 text-[14px]"
              value={words}
              onChange={(e) => setWords(e.target.value)}
            />
          )}
        </Field>
        <Switch
          checked={replyToEdited}
          onChange={setReplyToEdited}
          label="Reply again when a reviewer updates their review"
          description="Useful for thanking people who raise their rating after you fixed something."
        />
      </Section>

      <Section
        title="Translation"
        description="Google translates reviews into this language for you. Replies are still written in the reviewer's language when a template has it."
      >
        <Field label="Show reviews in">
          {(p) => (
            <select
              {...p}
              className={cn(inputClass, "sm:max-w-60")}
              value={translateTo}
              onChange={(e) => setTranslateTo(e.target.value)}
            >
              <option value="">Original language</option>
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </Section>

      {update.isError ? (
        <p role="alert" className="text-small text-danger">
          {errorMessage(update.error)}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" loading={update.isPending}>
          Save settings
        </Button>
      </div>

      <RemoveApp app={app} />
    </form>
  );
}

function RemoveApp({ app }: { app: PlayAppDetail }) {
  const [open, setOpen] = useState(false);
  const remove = useRemovePlayApp();
  const router = useRouter();
  return (
    <Card className="border-danger/30 flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h2 className="text-[16px] font-semibold">Remove this app</h2>
        <p className="text-small text-muted mt-1">
          Deletes its review history, drafts and rules from Autopilot. Replies already on Google
          Play stay.
        </p>
      </div>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        Remove app
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Remove ${app.title}?`} description="This can't be undone.">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(app.id, {
                  onSuccess: () => {
                    toast.success(`${app.title} removed`);
                    router.push("/reviews");
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
