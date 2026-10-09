"use client";

import { Globe2, MapPin, Plus, Sparkles, Tag, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/errors";
import { type TargetingType, useTargetingSearch } from "@/lib/api/queries";
import type { CampaignPlan, TargetingOption } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { displaySrc } from "./creative-picker";
import { CTA_LABELS } from "./labels";

export function Section({
  title,
  icon,
  reason,
  children,
}: {
  title: string;
  icon: ReactNode;
  reason: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="grid grid-cols-1 gap-5 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="text-accent">{icon}</span>
          <h2 className="text-[15px] font-semibold">{title}</h2>
        </div>
        <Reason text={reason} />
        {children}
      </div>
    </Card>
  );
}

export function Reason({ text }: { text: string }) {
  return (
    <div className="bg-accent-soft/60 border-accent/15 flex gap-2.5 rounded-lg border px-3.5 py-3">
      <Sparkles className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="text-[13px] leading-5">
        <span className="font-medium">Why: </span>
        {text}
      </p>
    </div>
  );
}

export function Chip({
  children,
  onRemove,
  label,
}: {
  children: ReactNode;
  onRemove?: () => void;
  label: string;
}) {
  return (
    <span className="border-border bg-surface inline-flex items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-3 text-[13px]">
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="text-muted hover:bg-surface-muted hover:text-foreground grid size-5 place-items-center rounded-full"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </span>
  );
}

type Targeting = CampaignPlan["targeting"];

export function LocationsEditor({
  targeting,
  onChange,
  disabled,
}: {
  targeting: Targeting;
  onChange: (next: Targeting) => void;
  disabled: boolean;
}) {
  const empty =
    !targeting.cities.length && !targeting.regions.length && !targeting.countries.length;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {targeting.cities.map((c) => (
          <Chip
            key={`c${c.key}`}
            label={c.name}
            onRemove={
              disabled
                ? undefined
                : () =>
                    onChange({
                      ...targeting,
                      cities: targeting.cities.filter((x) => x.key !== c.key),
                    })
            }
          >
            <MapPin className="text-muted size-3.5" aria-hidden />
            {c.name}
            {c.radiusKm ? <span className="text-muted">+{c.radiusKm} km</span> : null}
          </Chip>
        ))}
        {targeting.regions.map((r) => (
          <Chip
            key={`r${r.key}`}
            label={r.name}
            onRemove={
              disabled
                ? undefined
                : () =>
                    onChange({
                      ...targeting,
                      regions: targeting.regions.filter((x) => x.key !== r.key),
                    })
            }
          >
            <Globe2 className="text-muted size-3.5" aria-hidden />
            {r.name}
          </Chip>
        ))}
        {targeting.countries.map((code) => (
          <Chip
            key={`n${code}`}
            label={code}
            onRemove={
              disabled
                ? undefined
                : () =>
                    onChange({
                      ...targeting,
                      countries: targeting.countries.filter((x) => x !== code),
                    })
            }
          >
            <Globe2 className="text-muted size-3.5" aria-hidden />
            {code}
          </Chip>
        ))}
        {empty ? (
          <p className="text-small text-muted">Whole of India (no locations chosen).</p>
        ) : null}
      </div>
      {disabled ? null : (
        <Search
          types={["city", "region"]}
          placeholder="Add a city or state"
          onPick={(o) =>
            o.type === "region"
              ? onChange({
                  ...targeting,
                  regions: dedupe([...targeting.regions, { key: o.key, name: o.name }]),
                })
              : onChange({
                  ...targeting,
                  cities: dedupe([...targeting.cities, { key: o.key, name: o.name, radiusKm: 25 }]),
                })
          }
        />
      )}
    </div>
  );
}

const TYPE_LABELS: Record<TargetingType, string> = {
  city: "City",
  region: "State",
  interest: "Interest",
  work_position: "Job title",
  industry: "Industry",
  behavior: "Behaviour",
};

type Named = { id: string; name: string };
type WhoKey = "interests" | "workPositions" | "industries";
const WHO_FIELDS: { field: WhoKey; type: TargetingType; label: string }[] = [
  { field: "workPositions", type: "work_position", label: "Job title" },
  { field: "industries", type: "industry", label: "Industry" },
  { field: "interests", type: "interest", label: "Interest" },
];

export function WhoEditor({
  targeting,
  onChange,
  disabled,
}: {
  targeting: Targeting;
  onChange: (next: Targeting) => void;
  disabled: boolean;
}) {
  const chips = WHO_FIELDS.flatMap(({ field, label }) =>
    ((targeting[field] ?? []) as Named[]).map((item) => ({ field, label, item })),
  );
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {chips.map(({ field, label, item }) => (
          <Chip
            key={`${field}${item.id}`}
            label={item.name}
            onRemove={
              disabled
                ? undefined
                : () =>
                    onChange({
                      ...targeting,
                      [field]: ((targeting[field] ?? []) as Named[]).filter(
                        (x) => x.id !== item.id,
                      ),
                    })
            }
          >
            <Tag className="text-muted size-3.5" aria-hidden />
            <span className="text-muted">{label}:</span> {item.name}
          </Chip>
        ))}
        {!chips.length ? (
          <p className="text-small text-muted">Anyone in the locations and ages above.</p>
        ) : null}
      </div>
      {disabled ? null : (
        <Search
          types={["work_position", "industry", "interest"]}
          placeholder="Add a job title, industry or interest"
          onPick={(o) => {
            const target =
              WHO_FIELDS.find((w) => w.type === o.type) ??
              WHO_FIELDS.find((w) => w.field === "interests")!;
            const list = (targeting[target.field] ?? []) as Named[];
            if (list.some((x) => x.id === o.key)) return;
            onChange({ ...targeting, [target.field]: [...list, { id: o.key, name: o.name }] });
          }}
        />
      )}
    </div>
  );
}

export function BehaviorsEditor({
  targeting,
  onChange,
  disabled,
}: {
  targeting: Targeting;
  onChange: (next: Targeting) => void;
  disabled: boolean;
}) {
  const behaviors = (targeting.behaviors ?? []) as Named[];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {behaviors.map((b) => (
          <Chip
            key={b.id}
            label={b.name}
            onRemove={
              disabled
                ? undefined
                : () =>
                    onChange({ ...targeting, behaviors: behaviors.filter((x) => x.id !== b.id) })
            }
          >
            {b.name}
          </Chip>
        ))}
        {!behaviors.length ? <p className="text-small text-muted">No extra condition.</p> : null}
      </div>
      {disabled ? null : (
        <Search
          types={["behavior"]}
          placeholder="Add a behaviour, e.g. Small business owners"
          onPick={(o) => {
            if (behaviors.some((x) => x.id === o.key)) return;
            onChange({ ...targeting, behaviors: [...behaviors, { id: o.key, name: o.name }] });
          }}
        />
      )}
    </div>
  );
}

function dedupe<T extends { key: string }>(items: T[]): T[] {
  return [...new Map(items.map((i) => [i.key, i])).values()];
}

function Search({
  types,
  placeholder,
  onPick,
}: {
  types: TargetingType[];
  placeholder: string;
  onPick: (option: TargetingOption) => void;
}) {
  const [type, setType] = useState(types[0]!);
  const [q, setQ] = useState("");
  const results = useTargetingSearch(type, q);
  const open = q.trim().length >= 2;
  return (
    <div className="relative">
      <div className="flex gap-2">
        {types.length > 1 ? (
          <select
            aria-label="Location type"
            className={cn(inputClass, "w-28 shrink-0")}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        ) : null}
        <div className="relative flex-1">
          <Plus
            className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            aria-label={placeholder}
            className={cn(inputClass, "pl-9")}
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      {open ? (
        <div className="border-border bg-surface absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border shadow-[var(--shadow-floating)]">
          {results.isError ? (
            <p role="alert" className="text-small text-danger p-3">
              {errorMessage(results.error)}
            </p>
          ) : results.isFetching && !results.data ? (
            <div className="flex justify-center p-4">
              <Spinner />
            </div>
          ) : results.data?.results.length ? (
            <ul role="listbox" aria-label="Suggestions">
              {results.data.results.map((o) => (
                <li key={`${o.type}${o.key}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="hover:bg-surface-muted flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[14px]"
                    onClick={() => {
                      onPick(o);
                      setQ("");
                    }}
                  >
                    <span>
                      {o.name}
                      {o.region ? <span className="text-muted">, {o.region}</span> : null}
                    </span>
                    {o.audienceSize ? (
                      <span className="text-caption text-muted">
                        {new Intl.NumberFormat("en-IN", { notation: "compact" }).format(
                          o.audienceSize,
                        )}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-muted p-3">No matches.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AdPreview({
  pageName,
  creative,
}: {
  pageName: string;
  creative: CampaignPlan["creative"];
}) {
  let host = "";
  try {
    host = new URL(creative.linkUrl).host.replace(/^www\./, "").toUpperCase();
  } catch {
    host = "";
  }
  return (
    <figure
      aria-label="Ad preview"
      className="border-border bg-surface overflow-hidden rounded-xl border text-[13px] shadow-[var(--shadow-raised)]"
    >
      <div className="flex items-center gap-2 p-3">
        <span className="bg-accent text-accent-foreground grid size-8 place-items-center rounded-full text-[12px] font-semibold">
          {pageName.slice(0, 1)}
        </span>
        <div>
          <p className="font-semibold">{pageName}</p>
          <p className="text-caption text-muted">Sponsored</p>
        </div>
      </div>
      <p className="px-3 pb-3 whitespace-pre-line">{creative.post?.text ?? creative.primaryText}</p>
      <div className="bg-surface-muted aspect-[1.91/1] w-full">
        {displaySrc(creative.post?.imageUrl ?? creative.imageUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displaySrc(creative.post?.imageUrl ?? creative.imageUrl)!}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="text-muted grid size-full place-items-center p-6 text-center text-[13px]">
            {creative.imageIdea ? `Image idea: ${creative.imageIdea}` : "Add an image"}
          </div>
        )}
      </div>
      <div className="bg-surface-muted border-border flex items-center gap-3 border-t px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-caption text-muted truncate">{host}</p>
          <p className="truncate font-semibold">{creative.headline}</p>
          {creative.description ? (
            <p className="text-caption text-muted truncate">{creative.description}</p>
          ) : null}
        </div>
        <span className="border-border bg-surface shrink-0 rounded-md border px-3 py-1.5 text-[12px] font-semibold">
          {CTA_LABELS[creative.callToAction] ?? creative.callToAction}
        </span>
      </div>
    </figure>
  );
}
