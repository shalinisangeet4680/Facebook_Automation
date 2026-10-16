"use client";

import { Check, Download, ImagePlus, Smartphone, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { RadioGroup } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { mediaSrc } from "@/features/creatives/creatives-page";
import { errorMessage } from "@/lib/api/errors";
import {
  useAddStoreToCreatives,
  useChooseStoreStyle,
  useDeleteStoreProject,
  useStoreProject,
} from "@/lib/api/queries";
import type { StoreAsset, StoreChoice, StoreProjectDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { FEATURE_LABELS, SIZE_LABELS, STATUS, STYLE_LABELS, languageName } from "./labels";
import { BackToStore } from "./store-projects";

const RENDER_PROMPT = "Render the Play Store set I chose in Autopilot and upload it.";

export function StoreProjectView() {
  const { id } = useParams<{ id: string }>();
  const project = useStoreProject(id);
  if (project.isPending)
    return (
      <div className="grid gap-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (project.isError)
    return (
      <ErrorState message={errorMessage(project.error)} onRetry={() => void project.refetch()} />
    );
  return <ProjectBody project={project.data} />;
}

function ProjectBody({ project }: { project: StoreProjectDetail }) {
  const status = STATUS[project.status];
  const screens = project.assets.filter((a) => a.kind === "screen");
  const previews = project.assets.filter((a) => a.kind === "preview");
  const finals = project.assets.filter(
    (a) => a.kind === "screenshot" || a.kind === "feature_graphic",
  );
  return (
    <>
      <PageHeader
        eyebrow={<BackToStore />}
        title={project.name}
        description={status.hint}
        actions={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            <DeleteProject project={project} />
          </>
        }
      />
      <div className="grid gap-8">
        {previews.length ? (
          <StyleChooser
            key={JSON.stringify(project.choice)}
            project={project}
            previews={previews}
          />
        ) : (
          <Card>
            <EmptyState
              icon={<Smartphone className="size-5" />}
              title="Waiting for style previews"
              description="Claude Code is preparing your screens. Previews of every style appear here as soon as they're rendered."
            />
          </Card>
        )}
        {project.choice && !finals.length ? <RenderNext /> : null}
        {finals.length ? <FinalSet project={project} assets={finals} /> : null}
        {screens.length ? <Screens screens={screens} /> : null}
      </div>
    </>
  );
}

function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {description ? <p className="text-small text-muted mt-1">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium transition-colors outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
        pressed
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      {pressed ? <Check className="size-3.5" strokeWidth={3} /> : null}
      {children}
    </button>
  );
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function previewFor(previews: StoreAsset[], style: string) {
  const own = previews.filter((p) => p.style === style);
  return own.find((p) => p.size === "phone") ?? own[0];
}

function StyleChooser({
  project,
  previews,
}: {
  project: StoreProjectDetail;
  previews: StoreAsset[];
}) {
  const choose = useChooseStoreStyle(project.id);
  const styles = project.options.styles.filter((s) => previews.some((p) => p.style === s));
  const languages = project.languages.length
    ? project.languages
    : [...new Set(previews.map((p) => p.lang))];
  const [style, setStyle] = useState(project.choice?.style ?? styles[0] ?? "callouts");
  const [langs, setLangs] = useState<string[]>(project.choice?.languages ?? languages);
  const [sizes, setSizes] = useState<string[]>(project.choice?.sizes ?? ["phone"]);
  const valid = langs.length > 0 && sizes.length > 0;
  const saved = project.choice;
  const dirty =
    !saved ||
    saved.style !== style ||
    [...saved.languages].sort().join() !== [...langs].sort().join() ||
    [...saved.sizes].sort().join() !== [...sizes].sort().join();

  return (
    <Section
      title="Choose a style"
      description="Every style uses your screens and copy. Pick one, then the languages and sizes to render."
    >
      <RadioGroup.Root
        value={style}
        onValueChange={setStyle}
        aria-label="Screenshot style"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {styles.map((s) => {
          const preview = previewFor(previews, s);
          const label = STYLE_LABELS[s] ?? { name: s, description: "" };
          return (
            <RadioGroup.Item
              key={s}
              value={s}
              className={cn(
                "group border-border bg-surface flex flex-col overflow-hidden rounded-[var(--radius-card)] border text-left shadow-[var(--shadow-raised)] transition-[border-color,box-shadow] outline-none",
                "hover:border-border-strong focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
                "data-[state=checked]:border-accent data-[state=checked]:ring-accent data-[state=checked]:ring-2",
              )}
            >
              <span className="bg-surface-muted block">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaSrc(preview.url)}
                    alt={`${label.name} style preview`}
                    loading="lazy"
                    className="block h-auto w-full"
                  />
                ) : null}
              </span>
              <span className="flex items-start gap-2 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{label.name}</span>
                  <span className="text-caption text-muted mt-0.5 block">{label.description}</span>
                </span>
                <span className="border-border-strong group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border">
                  <RadioGroup.Indicator>
                    <Check className="text-accent-foreground size-3" strokeWidth={3} />
                  </RadioGroup.Indicator>
                </span>
              </span>
            </RadioGroup.Item>
          );
        })}
      </RadioGroup.Root>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <fieldset>
          <legend className="text-small mb-2 font-medium">Languages</legend>
          <div className="flex flex-wrap gap-2">
            {languages.map((l) => (
              <Toggle
                key={l}
                pressed={langs.includes(l)}
                onClick={() => setLangs(toggle(langs, l))}
              >
                {languageName(l)}
              </Toggle>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-small mb-2 font-medium">Sizes</legend>
          <div className="flex flex-wrap gap-2">
            {project.options.sizes.map((s) => (
              <Toggle
                key={s}
                pressed={sizes.includes(s)}
                onClick={() => setSizes(toggle(sizes, s))}
              >
                {SIZE_LABELS[s] ?? s}
              </Toggle>
            ))}
          </div>
          <p className="text-caption text-muted mt-2">
            Tablet screenshots are only needed if your app supports tablets.
          </p>
        </fieldset>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          disabled={!valid || !dirty}
          loading={choose.isPending}
          onClick={() =>
            choose.mutate({ style, languages: langs, sizes } as StoreChoice, {
              onSuccess: () => toast.success("Saved. Tell Claude Code to render the set."),
              onError: (err) => toast.error(errorMessage(err)),
            })
          }
        >
          {saved ? "Update choice" : "Use this style"}
        </Button>
        {!valid ? (
          <p className="text-small text-muted">Choose at least one language and one size.</p>
        ) : null}
      </div>
    </Section>
  );
}

function RenderNext() {
  return (
    <Card className="border-accent/40 bg-accent-soft/30 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[15px] font-semibold">Now go back to Claude Code</p>
        <p className="text-small text-muted mt-1">
          Ask it to render the set. The screenshots appear here as they upload.
        </p>
      </div>
      <CopyButton value={RENDER_PROMPT} label="Copy request" />
    </Card>
  );
}

function variantLabel(a: StoreAsset) {
  if (a.kind === "feature_graphic") return FEATURE_LABELS[a.style] ?? "Feature graphic";
  return `${a.name} · ${SIZE_LABELS[a.size] ?? a.size}`;
}

function FinalSet({ project, assets }: { project: StoreProjectDetail; assets: StoreAsset[] }) {
  const add = useAddStoreToCreatives(project.id);
  const shots = assets.filter((a) => a.kind === "screenshot");
  const features = assets.filter((a) => a.kind === "feature_graphic");
  const options = (key: "style" | "lang" | "size") => [...new Set(shots.map((a) => a[key]))];
  const preferred = project.choice;
  const styles = options("style");
  const langs = options("lang");
  const sizes = options("size");
  const [style, setStyle] = useState(
    preferred && styles.includes(preferred.style) ? preferred.style : (styles[0] ?? ""),
  );
  const [lang, setLang] = useState(langs[0] ?? "");
  const [size, setSize] = useState(sizes.includes("phone") ? "phone" : (sizes[0] ?? ""));
  const [selected, setSelected] = useState<string[]>([]);
  const visible = shots.filter((a) => a.style === style && a.lang === lang && a.size === size);

  return (
    <Section
      title="Your store set"
      description="Upload phone screenshots to Google Play in this order. Select images to reuse them in app-install ads."
      actions={
        <Button
          variant="secondary"
          size="sm"
          disabled={!selected.length}
          loading={add.isPending}
          onClick={() =>
            add.mutate(selected, {
              onSuccess: (res) => {
                toast.success(`${res.data.length} added to Creatives`);
                setSelected([]);
              },
              onError: (err) => toast.error(errorMessage(err)),
            })
          }
        >
          <ImagePlus /> Add {selected.length || ""} to Creatives
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-3">
        {styles.length > 1 ? (
          <FilterRow
            label="Style"
            values={styles}
            value={style}
            onChange={setStyle}
            name={(s) => STYLE_LABELS[s]?.name ?? s}
          />
        ) : null}
        {langs.length > 1 ? (
          <FilterRow
            label="Language"
            values={langs}
            value={lang}
            onChange={setLang}
            name={languageName}
          />
        ) : null}
        {sizes.length > 1 ? (
          <FilterRow
            label="Size"
            values={sizes}
            value={size}
            onChange={setSize}
            name={(s) => SIZE_LABELS[s] ?? s}
          />
        ) : null}
      </div>
      <ul
        className={cn(
          "grid gap-4",
          size === "phone"
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {visible.map((a, i) => (
          <AssetTile
            key={a.id}
            asset={a}
            label={`${i + 1}. ${variantLabel(a)}`}
            selected={selected.includes(a.id)}
            onSelect={() => setSelected(toggle(selected, a.id))}
          />
        ))}
      </ul>
      {features.length ? (
        <>
          <h3 className="mt-8 mb-3 text-[15px] font-semibold">Feature graphic</h3>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map((a) => (
              <AssetTile
                key={a.id}
                asset={a}
                label={variantLabel(a)}
                selected={selected.includes(a.id)}
                onSelect={() => setSelected(toggle(selected, a.id))}
              />
            ))}
          </ul>
        </>
      ) : null}
    </Section>
  );
}

function FilterRow({
  label,
  values,
  value,
  onChange,
  name,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
  name: (v: string) => string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-small text-muted w-20 shrink-0">{label}</span>
      {values.map((v) => (
        <Toggle key={v} pressed={value === v} onClick={() => onChange(v)}>
          {name(v)}
        </Toggle>
      ))}
    </div>
  );
}

function fileName(a: StoreAsset) {
  const ext = a.url.split(".").pop() ?? "png";
  return a.kind === "feature_graphic"
    ? `feature_graphic_${a.style}.${ext}`
    : `${a.name}_${a.style}_${a.lang}_${a.size}.${ext}`;
}

function AssetTile({
  asset,
  label,
  selected,
  onSelect,
}: {
  asset: StoreAsset;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <Card
        className={cn(
          "flex h-full flex-col overflow-hidden",
          selected && "border-accent ring-accent ring-2",
        )}
      >
        <a
          href={mediaSrc(asset.url)}
          target="_blank"
          rel="noreferrer"
          className="bg-surface-muted block outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaSrc(asset.url)}
            alt={label}
            loading="lazy"
            className="block h-auto w-full"
          />
        </a>
        <div className="flex items-center gap-2 p-2.5">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelect}
              className="size-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-caption truncate">{label}</span>
          </label>
          <Button asChild variant="ghost" size="icon" className="size-8">
            <a
              href={mediaSrc(asset.url)}
              download={fileName(asset)}
              aria-label={`Download ${label}`}
            >
              <Download />
            </a>
          </Button>
        </div>
      </Card>
    </li>
  );
}

function Screens({ screens }: { screens: StoreAsset[] }) {
  return (
    <Section title="Screens" description="Captured from your app by Claude Code.">
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {screens.map((s) => (
          <li key={s.id} className="w-28 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaSrc(s.url)}
              alt={s.name}
              loading="lazy"
              className="border-border block h-auto w-full rounded-lg border"
            />
            <p className="text-caption text-muted mt-1 truncate">{s.name}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DeleteProject({ project }: { project: StoreProjectDetail }) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteStoreProject();
  const router = useRouter();
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-danger hover:bg-danger-soft hover:text-danger"
        aria-label={`Delete ${project.name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={`Delete ${project.name}?`}
          description="Its screens, previews and screenshots are removed from Autopilot. Images already added to Creatives stay there, and the files on your computer aren't touched."
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(project.id, {
                  onSuccess: () => {
                    toast.success("Project deleted");
                    router.push("/store");
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
