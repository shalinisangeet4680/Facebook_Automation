"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useUpdateAd } from "@/lib/api/queries";
import type { AdCreativeUpdate, AdRow } from "@/lib/api/types";
import { CTA_LABELS } from "@/features/plans/labels";
import { CreativePicker, displaySrc } from "@/features/plans/creative-picker";
import { Field } from "@/features/plans/plan-sections";
import { RpDialogClose, RpDialogContent, RpDialogRoot } from "@/features/replyly/dialog";
import { Banner, Spinner, useToast } from "@/features/replyly/ui";

import { MUTED } from "./labels";

interface Draft {
  primaryText: string;
  headline: string;
  description: string;
  callToAction: string;
  link: string;
  imageUrl: string | null;
}

type Errors = Partial<Record<keyof Draft, string>>;

function validate(d: Draft): Errors {
  const errors: Errors = {};
  if (!d.primaryText.trim()) errors.primaryText = "Add the text people read above the image.";
  else if (d.primaryText.length > 2000) errors.primaryText = "Keep it under 2,000 characters.";
  if (!d.headline.trim()) errors.headline = "Add a headline.";
  else if (d.headline.length > 255) errors.headline = "Keep it under 255 characters.";
  if (d.description.length > 255) errors.description = "Keep it under 255 characters.";
  try {
    const url = new URL(d.link.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
  } catch {
    errors.link = "Enter the full web address, starting with https://";
  }
  return errors;
}

function changes(initial: Draft, d: Draft): AdCreativeUpdate {
  const body: AdCreativeUpdate = {};
  if (d.primaryText.trim() !== initial.primaryText.trim()) body.primaryText = d.primaryText.trim();
  if (d.headline.trim() !== initial.headline.trim()) body.headline = d.headline.trim();
  if (d.description.trim() !== initial.description.trim())
    body.description = d.description.trim() || null;
  if (d.callToAction !== initial.callToAction)
    body.callToAction = d.callToAction as AdCreativeUpdate["callToAction"];
  if (d.link.trim() !== initial.link.trim()) body.link = d.link.trim();
  if (d.imageUrl && d.imageUrl !== initial.imageUrl) body.imageUrl = d.imageUrl;
  return body;
}

export function EditAdDialog({
  ad,
  open,
  onOpenChange,
}: {
  ad: AdRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const update = useUpdateAd();
  const c = ad.creative;
  const [initial] = useState<Draft>(() => ({
    primaryText: c.primaryText ?? "",
    headline: c.headline ?? "",
    description: c.description ?? "",
    callToAction: c.callToAction ?? "LEARN_MORE",
    link: c.link ?? "",
    imageUrl: c.imageUrl,
  }));
  const [draft, setDraft] = useState<Draft>(initial);
  const [tried, setTried] = useState(false);
  const [picking, setPicking] = useState(false);
  const errors = tried ? validate(draft) : {};
  const body = changes(initial, draft);
  const dirty = Object.keys(body).length > 0;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const image = displaySrc(draft.imageUrl);

  const submit = () => {
    setTried(true);
    if (Object.keys(validate(draft)).length || !dirty) return;
    update.mutate(
      { id: ad.id, body },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast("Ad updated. Meta reviews the new version before it runs.");
        },
      },
    );
  };

  return (
    <>
      <RpDialogRoot open={open && !picking} onOpenChange={onOpenChange}>
        <RpDialogContent
          width={560}
          title="Edit ad"
          description={`“${ad.name}”. Saving creates a new version of the ad, and Meta reviews it again before it runs.`}
        >
          <form
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span
                style={{
                  position: "relative",
                  width: 96,
                  aspectRatio: "1.91 / 1",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#F4F2EE",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: MUTED,
                }}
              >
                {image ? (
                  <Image
                    unoptimized
                    fill
                    src={image}
                    alt=""
                    sizes="96px"
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  <ImageIcon size={18} aria-hidden />
                )}
              </span>
              <button type="button" className="rp-btn-light" onClick={() => setPicking(true)}>
                Change image
              </button>
            </div>
            <Field label="Primary text" error={errors.primaryText}>
              <textarea
                className="rp-input rp-textarea"
                rows={4}
                value={draft.primaryText}
                onChange={(e) => set({ primaryText: e.target.value })}
              />
            </Field>
            <Field label="Headline" error={errors.headline}>
              <input
                className="rp-input"
                value={draft.headline}
                onChange={(e) => set({ headline: e.target.value })}
              />
            </Field>
            <Field
              label="Description"
              hint="Optional. Shown under the headline on some placements."
              error={errors.description}
            >
              <input
                className="rp-input"
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Field inRow label="Button">
                <select
                  className="rp-select"
                  style={{ width: "100%" }}
                  value={draft.callToAction}
                  onChange={(e) => set({ callToAction: e.target.value })}
                >
                  {Object.entries(CTA_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field inRow label="Link" error={errors.link}>
                <input
                  className="rp-input"
                  type="url"
                  inputMode="url"
                  value={draft.link}
                  onChange={(e) => set({ link: e.target.value })}
                />
              </Field>
            </div>
            {tried && !dirty ? (
              <span role="status" style={{ fontSize: 12.5, color: MUTED }}>
                Nothing has changed yet.
              </span>
            ) : null}
            {update.isError ? (
              <Banner tone="error" title="The ad wasn’t changed">
                {errorMessage(update.error)}
              </Banner>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <RpDialogClose type="button" className="rp-btn-light">
                Cancel
              </RpDialogClose>
              <button type="submit" className="rp-btn" disabled={update.isPending}>
                {update.isPending ? <Spinner /> : null}
                Save changes
              </button>
            </div>
          </form>
        </RpDialogContent>
      </RpDialogRoot>
      <CreativePicker
        imagesOnly
        open={open && picking}
        onOpenChange={setPicking}
        creative={{ imageUrl: draft.imageUrl, post: null }}
        onPick={(patch) => {
          if (patch.imageUrl) set({ imageUrl: patch.imageUrl });
        }}
      />
    </>
  );
}
