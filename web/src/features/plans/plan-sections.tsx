"use client";

import { Globe2, MapPin, Plus, Sparkles, Tag, X } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";

import { errorMessage } from "@/lib/api/errors";
import { type TargetingType, useTargetingSearch } from "@/lib/api/queries";
import type { CampaignPlan, PlanStatus, TargetingOption } from "@/lib/api/types";
import { Spinner } from "@/features/replyly/ui";

import { displaySrc } from "./creative-picker";
import { CTA_LABELS, STATUS_LABELS } from "./labels";

export const MUTED = "#6C6962";

export function StatusPill({ status }: { status: PlanStatus }) {
  const s = STATUS_LABELS[status];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        fontWeight: 500,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  inRow,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  inRow?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rp-field" style={inRow ? { flex: "1 1 140px" } : { flex: "none" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="rp-label">{label}</span>
        {children}
      </label>
      {error ? (
        <span role="alert" style={{ fontSize: 12, color: "#B42318" }}>
          {error}
        </span>
      ) : hint ? (
        <span style={{ fontSize: 12, color: MUTED }}>{hint}</span>
      ) : null}
    </div>
  );
}

export function Group({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 500, fontSize: 13.5 }}>{title}</span>
        {desc ? <span style={{ fontSize: 12.5, color: MUTED }}>{desc}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function PlanSection({
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
    <section className="rp-card" style={{ overflow: "visible" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 20px",
          borderBottom: "1px solid #EFEDE8",
        }}
      >
        <span style={{ display: "flex", color: "#0F6B4A" }}>{icon}</span>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: 20 }}>
        <Reason text={reason} />
        {children}
      </div>
    </section>
  );
}

export function Reason({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: "#F1F5F2",
        color: "#0F3D2C",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <Sparkles size={14} color="#0F6B4A" style={{ marginTop: 3, flexShrink: 0 }} aria-hidden />
      <p>
        <span style={{ fontWeight: 600 }}>Why: </span>
        {text}
      </p>
    </div>
  );
}

function Chip({
  children,
  onRemove,
  label,
}: {
  children: ReactNode;
  onRemove?: () => void;
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: onRemove ? "4px 4px 4px 10px" : "4px 10px",
        borderRadius: 999,
        border: "1px solid #E6E4DF",
        background: "#fff",
        fontSize: 12.5,
        maxWidth: "100%",
      }}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="rp-btn-quiet"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: 999,
          }}
        >
          <X size={13} />
        </button>
      ) : null}
    </span>
  );
}

function Chips({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 13, color: MUTED }}>{children}</span>;
}

type Targeting = CampaignPlan["targeting"];

export function LocationsEditor({
  targeting,
  onChange,
  disabled,
  emptyText = "Whole of India (no locations chosen).",
}: {
  targeting: Targeting;
  onChange: (next: Targeting) => void;
  disabled: boolean;
  emptyText?: string;
}) {
  const empty =
    !targeting.cities.length && !targeting.regions.length && !targeting.countries.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Chips>
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
            <MapPin size={13} color={MUTED} aria-hidden />
            {c.name}
            {c.radiusKm ? <span style={{ color: MUTED }}>+{c.radiusKm} km</span> : null}
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
            <Globe2 size={13} color={MUTED} aria-hidden />
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
            <Globe2 size={13} color={MUTED} aria-hidden />
            {code}
          </Chip>
        ))}
        {empty ? <Empty>{emptyText}</Empty> : null}
      </Chips>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Chips>
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
            <Tag size={13} color={MUTED} aria-hidden />
            <span style={{ color: MUTED }}>{label}:</span> {item.name}
          </Chip>
        ))}
        {!chips.length ? <Empty>Anyone in the locations and ages above.</Empty> : null}
      </Chips>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Chips>
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
        {!behaviors.length ? <Empty>No extra condition.</Empty> : null}
      </Chips>
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

const compact = new Intl.NumberFormat("en-IN", { notation: "compact" });

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
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {types.length > 1 ? (
          <select
            aria-label="Location type"
            className="rp-select"
            style={{ flex: "0 0 auto" }}
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
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
          <Plus
            size={14}
            color={MUTED}
            aria-hidden
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            aria-label={placeholder}
            className="rp-input"
            style={{ width: "100%", paddingLeft: 30 }}
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      {open ? (
        <div
          className="rp-pop"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            marginTop: 6,
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {results.isError ? (
            <p role="alert" style={{ padding: 12, color: "#B42318" }}>
              {errorMessage(results.error)}
            </p>
          ) : results.isFetching && !results.data ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
              <Spinner dark />
            </div>
          ) : results.data?.results.length ? (
            <ul
              role="listbox"
              aria-label="Suggestions"
              style={{ listStyle: "none", margin: 0, padding: 4 }}
            >
              {results.data.results.map((o) => (
                <li key={`${o.type}${o.key}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="rp-tpl-item"
                    style={{ width: "100%", alignItems: "center" }}
                    onClick={() => {
                      onPick(o);
                      setQ("");
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      {o.name}
                      {o.region ? <span style={{ color: MUTED }}>, {o.region}</span> : null}
                    </span>
                    {o.audienceSize ? (
                      <span className="rp-mono" style={{ fontSize: 11.5, color: MUTED }}>
                        {compact.format(o.audienceSize)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ padding: 12, color: MUTED }}>No matches.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

const ellipsis = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

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
  const src = displaySrc(creative.post?.imageUrl ?? creative.imageUrl);
  return (
    <figure
      aria-label="Ad preview"
      style={{
        margin: 0,
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid #E6E4DF",
        background: "#fff",
        fontSize: 13,
        boxShadow: "0 8px 24px -16px rgba(25,25,23,.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "#0F6B4A",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {pageName.slice(0, 1)}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontWeight: 600 }}>{pageName}</span>
          <span style={{ fontSize: 11.5, color: MUTED }}>Sponsored</span>
        </span>
      </div>
      <p style={{ padding: "0 12px 12px", whiteSpace: "pre-line", lineHeight: 1.45 }}>
        {creative.post?.text ?? creative.primaryText}
      </p>
      <div
        style={{
          position: "relative",
          aspectRatio: "1.91 / 1",
          width: "100%",
          background: "#F4F2EE",
        }}
      >
        {src ? (
          <Image unoptimized fill src={src} alt="" sizes="480px" style={{ objectFit: "cover" }} />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              boxSizing: "border-box",
              textAlign: "center",
              color: MUTED,
            }}
          >
            {creative.imageIdea ? `Image idea: ${creative.imageIdea}` : "Add an image"}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          background: "#F7F6F3",
          borderTop: "1px solid #EFEDE8",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
          <span style={{ ...ellipsis, fontSize: 11.5, color: MUTED }}>{host}</span>
          <span style={{ ...ellipsis, fontWeight: 600 }}>{creative.headline}</span>
          {creative.description ? (
            <span style={{ ...ellipsis, fontSize: 11.5, color: MUTED }}>
              {creative.description}
            </span>
          ) : null}
        </div>
        <span
          style={{
            flexShrink: 0,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #E6E4DF",
            background: "#fff",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {CTA_LABELS[creative.callToAction] ?? creative.callToAction}
        </span>
      </div>
    </figure>
  );
}
