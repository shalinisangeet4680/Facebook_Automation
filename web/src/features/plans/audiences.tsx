"use client";

import { Bookmark, Trash2, Users, X } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  useCustomAudiences,
  useDeleteAudience,
  useSaveAudience,
  useSavedAudiences,
} from "@/lib/api/queries";
import type { CustomAudience, PlanTargeting, SavedAudience } from "@/lib/api/types";
import { RpDialogClose, RpDialogContent, RpDialogRoot } from "@/features/replyly/dialog";
import { Spinner, useToast } from "@/features/replyly/ui";

import { Field, MUTED } from "./plan-sections";

const full = { width: "100%", boxSizing: "border-box" } as const;
const compact = new Intl.NumberFormat("en-IN", { notation: "compact" });

export function fullTargeting(t: PlanTargeting): PlanTargeting {
  return {
    ...t,
    customAudiences: t.customAudiences ?? [],
    excludedCustomAudiences: t.excludedCustomAudiences ?? [],
  };
}

export function audienceSummary(t: PlanTargeting): string {
  const places = [...t.cities.map((c) => c.name), ...t.regions.map((r) => r.name), ...t.countries];
  const where =
    places.length > 2
      ? `${places.slice(0, 2).join(", ")} +${places.length - 2}`
      : places.join(", ");
  const who = [...t.interests, ...t.workPositions, ...t.industries, ...t.behaviors].length;
  return [
    where || "Any location",
    `${t.ageMin}–${t.ageMax === 65 ? "65+" : t.ageMax}`,
    t.genders === "female" ? "Women" : t.genders === "male" ? "Men" : null,
    who ? `${who} interest${who === 1 ? "" : "s"} or job titles` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function SavedAudiencePicker({
  onPick,
  disabled,
}: {
  onPick: (audience: SavedAudience) => void;
  disabled?: boolean;
}) {
  const audiences = useSavedAudiences();
  const remove = useDeleteAudience();
  const toast = useToast();
  const [managing, setManaging] = useState(false);
  const list = audiences.data?.data ?? [];
  if (audiences.isPending || !list.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select
        className="rp-select"
        aria-label="Use a saved audience"
        style={{ flex: "1 1 220px", minWidth: 0 }}
        value=""
        disabled={disabled}
        onChange={(e) => {
          const picked = list.find((a) => a.id === e.target.value);
          if (picked) onPick(picked);
        }}
      >
        <option value="">Use a saved audience…</option>
        {list.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="rp-btn-quiet"
        style={{ fontSize: 12.5 }}
        onClick={() => setManaging(true)}
      >
        Manage
      </button>
      <RpDialogRoot open={managing} onOpenChange={setManaging}>
        <RpDialogContent
          width={520}
          title="Saved audiences"
          description="Delete audiences you no longer use. Plans that used them keep their settings."
        >
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {list.map((a) => (
              <li
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #EFEDE8",
                }}
              >
                <span
                  style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}
                >
                  <span style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{a.name}</span>
                  <span style={{ fontSize: 12, color: MUTED }}>{audienceSummary(a.targeting)}</span>
                </span>
                <button
                  type="button"
                  className="rp-btn-light"
                  aria-label={`Delete ${a.name}`}
                  style={{ padding: "6px 8px" }}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(a.id, {
                      onSuccess: () => toast(`Deleted “${a.name}”`),
                      onError: (err) => toast(errorMessage(err)),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </RpDialogContent>
      </RpDialogRoot>
    </div>
  );
}

export function SaveAudienceButton({
  targeting,
  disabled,
}: {
  targeting: PlanTargeting;
  disabled?: boolean;
}) {
  const toast = useToast();
  const save = useSaveAudience();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tried, setTried] = useState(false);
  const error = tried && !name.trim() ? "Give the audience a name." : null;
  const submit = () => {
    setTried(true);
    if (!name.trim()) return;
    save.mutate(
      { name: name.trim(), targeting: fullTargeting(targeting) },
      {
        onSuccess: (saved) => {
          setOpen(false);
          setName("");
          setTried(false);
          toast(`Saved “${saved.name}”`);
        },
      },
    );
  };
  return (
    <>
      <button
        type="button"
        className="rp-btn-light"
        style={{ padding: "6px 10px", alignSelf: "flex-start" }}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Bookmark size={14} /> Save this audience
      </button>
      <RpDialogRoot open={open} onOpenChange={setOpen}>
        <RpDialogContent
          title="Save this audience"
          description={`${audienceSummary(targeting)}. Use it again in any new campaign.`}
        >
          <form
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field
              label="Audience name"
              error={error ?? (save.isError ? errorMessage(save.error) : null)}
            >
              <input
                className="rp-input"
                maxLength={80}
                style={full}
                placeholder="e.g. Clinic owners in Bihar"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <RpDialogClose type="button" className="rp-btn-light">
                Cancel
              </RpDialogClose>
              <button type="submit" className="rp-btn" disabled={save.isPending}>
                {save.isPending ? <Spinner /> : null}
                Save audience
              </button>
            </div>
          </form>
        </RpDialogContent>
      </RpDialogRoot>
    </>
  );
}

type Ref = { id: string; name: string };

function AudienceChip({
  item,
  label,
  onRemove,
}: {
  item: Ref;
  label: string;
  onRemove?: () => void;
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
      <Users size={13} color={MUTED} aria-hidden />
      <span style={{ color: MUTED }}>{label}:</span> {item.name}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.name}`}
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

export function CustomAudiencesEditor({
  targeting,
  onChange,
  disabled,
}: {
  targeting: PlanTargeting;
  onChange: (next: PlanTargeting) => void;
  disabled: boolean;
}) {
  const audiences = useCustomAudiences(!disabled);
  const included = targeting.customAudiences ?? [];
  const excluded = targeting.excludedCustomAudiences ?? [];
  const used = new Set([...included, ...excluded].map((a) => a.id));
  const available = (audiences.data?.data ?? []).filter((a) => !used.has(a.id));
  const add = (a: CustomAudience, mode: "include" | "exclude") => {
    const ref = { id: a.id, name: a.name };
    onChange(
      mode === "include"
        ? { ...targeting, customAudiences: [...included, ref] }
        : { ...targeting, excludedCustomAudiences: [...excluded, ref] },
    );
  };
  const [pick, setPick] = useState("");
  const chosen = available.find((a) => a.id === pick);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {included.map((a) => (
          <AudienceChip
            key={`i${a.id}`}
            item={a}
            label="Include"
            onRemove={
              disabled
                ? undefined
                : () =>
                    onChange({
                      ...targeting,
                      customAudiences: included.filter((x) => x.id !== a.id),
                    })
            }
          />
        ))}
        {excluded.map((a) => (
          <AudienceChip
            key={`e${a.id}`}
            item={a}
            label="Exclude"
            onRemove={
              disabled
                ? undefined
                : () =>
                    onChange({
                      ...targeting,
                      excludedCustomAudiences: excluded.filter((x) => x.id !== a.id),
                    })
            }
          />
        ))}
        {!included.length && !excluded.length ? (
          <span style={{ fontSize: 13, color: MUTED }}>No custom audiences.</span>
        ) : null}
      </div>
      {disabled ? null : audiences.isPending ? null : audiences.isError ? (
        <span style={{ fontSize: 12.5, color: MUTED }}>
          Couldn’t load your custom audiences from Meta.
        </span>
      ) : !audiences.data?.data.length ? (
        <span style={{ fontSize: 12.5, color: MUTED }}>
          This ad account has no custom audiences. Create them in Meta Ads Manager.
        </span>
      ) : available.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            className="rp-select"
            aria-label="Custom audience"
            style={{ flex: "1 1 200px", minWidth: 0 }}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">Choose a custom audience…</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.approximateCount ? ` (${compact.format(a.approximateCount)}+)` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "6px 10px" }}
            disabled={!chosen}
            onClick={() => {
              if (chosen) add(chosen, "include");
              setPick("");
            }}
          >
            Include
          </button>
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "6px 10px" }}
            disabled={!chosen}
            onClick={() => {
              if (chosen) add(chosen, "exclude");
              setPick("");
            }}
          >
            Exclude
          </button>
        </div>
      ) : null}
    </div>
  );
}
