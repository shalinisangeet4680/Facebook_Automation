"use client";

import { useState } from "react";

import {
  type BrandKit,
  type SocialPlatform,
  useBrandKit,
  usePrefillBrandKit,
  useResetBrandKit,
  useSaveBrandKit,
} from "@/lib/api/autopost";
import { errorMessage } from "@/lib/api/errors";
import { Select } from "@/features/replyly/select";
import { PageHead, Section, Seg, Skel, Spinner, useToast } from "@/features/replyly/ui";

import { Field, MUTED } from "./common";
import { useSocialAccounts } from "./shell";

const FONTS = ["Helvetica", "Georgia", "Arial", "Verdana", "Trebuchet MS", "Courier New"];

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

const words = (s: string) =>
  s
    .split(/[,\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);

interface Form {
  name: string;
  businessType: string;
  audience: string;
  voice: BrandKit["voice"];
  topics: string;
  offers: string;
  hashtagSets: string;
  bannedWords: string;
  primary: string;
  secondary: string;
  accent: string;
  heading: string;
  body: string;
  cta: string;
  link: string;
  websiteUrl: string;
  city: string;
  language: "en" | "hi" | "hinglish";
  logoUrl: string;
}

const toForm = (k: BrandKit): Form => ({
  name: k.name,
  businessType: k.businessType,
  audience: k.audience,
  voice: k.voice,
  topics: k.topics.join(", "),
  offers: k.offers.join("\n"),
  hashtagSets: k.hashtagSets
    .map((s) => `${s.name}: ${s.tags.map((t) => `#${t}`).join(" ")}`)
    .join("\n"),
  bannedWords: k.bannedWords.join(", "),
  primary: k.colors.primary,
  secondary: k.colors.secondary,
  accent: k.colors.accent,
  heading: k.fonts.heading,
  body: k.fonts.body,
  cta: k.cta,
  link: k.link ?? "",
  websiteUrl: k.websiteUrl ?? "",
  city: k.city ?? "",
  language: (["hi", "hinglish"].includes(k.language) ? k.language : "en") as Form["language"],
  logoUrl: k.logoUrl ?? "",
});

const toPatch = (f: Form) => ({
  name: f.name.trim(),
  businessType: f.businessType.trim(),
  audience: f.audience.trim(),
  voice: f.voice,
  topics: words(f.topics),
  offers: lines(f.offers),
  hashtagSets: lines(f.hashtagSets).map((l) => {
    const [name, rest] = l.includes(":")
      ? [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1)]
      : ["Brand", l];
    return {
      name: name!.trim() || "Brand",
      tags: (rest ?? "")
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#+/, "").trim())
        .filter(Boolean),
    };
  }),
  bannedWords: words(f.bannedWords),
  colors: { primary: f.primary, secondary: f.secondary, accent: f.accent },
  fonts: { heading: f.heading, body: f.body },
  cta: f.cta.trim(),
  link: f.link.trim() || null,
  websiteUrl: f.websiteUrl.trim() || null,
  city: f.city.trim() || null,
  language: f.language,
  logoUrl: f.logoUrl.trim() || null,
});

function Slide({ f }: { f: Form }) {
  return (
    <div
      aria-label="Brand image preview"
      style={{
        aspectRatio: "1 / 1",
        borderRadius: 12,
        background: f.primary,
        color: f.secondary,
        position: "relative",
        overflow: "hidden",
        padding: "9%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: `${f.heading}, Helvetica, sans-serif`,
        maxWidth: 300,
      }}
    >
      <span
        style={{
          position: "absolute",
          right: "-30%",
          bottom: "-30%",
          width: "84%",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          background: f.accent,
        }}
      />
      <span
        style={{
          position: "relative",
          fontSize: 11,
          letterSpacing: 2,
          opacity: 0.8,
          fontFamily: `${f.body}, Helvetica`,
        }}
      >
        <span
          style={{
            display: "block",
            width: 34,
            height: 4,
            borderRadius: 2,
            background: f.accent,
            marginBottom: 8,
          }}
        />
        TIP
      </span>
      <span style={{ position: "relative", fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>
        {f.topics ? `A quick tip about ${words(f.topics)[0]}` : "Your headline here"}
      </span>
      <span
        style={{
          position: "relative",
          fontSize: 11,
          fontWeight: 600,
          fontFamily: `${f.body}, Helvetica`,
        }}
      >
        {[f.name, f.cta].filter(Boolean).join(" · ") || "Your business"}
      </span>
    </div>
  );
}

function Editor({
  initial,
  accountId,
  custom,
}: {
  initial: BrandKit;
  accountId?: string;
  custom: boolean;
}) {
  const toast = useToast();
  const save = useSaveBrandKit(accountId);
  const prefill = usePrefillBrandKit();
  const reset = useResetBrandKit(accountId ?? "");
  const [f, setF] = useState(() => toForm(initial));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))",
        gap: 18,
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Section
          title="Start from your website"
          desc="AI reads your website and recent posts and fills in what it can. Review before saving."
        >
          <div
            className="rp-card"
            style={{ padding: 16, display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <input
              className="rp-input"
              style={{ flex: "1 1 240px" }}
              value={f.websiteUrl}
              onChange={(e) => set("websiteUrl", e.target.value)}
              placeholder="https://yourbusiness.com"
              aria-label="Website"
            />
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "8px 14px" }}
              disabled={prefill.isPending}
              onClick={() =>
                prefill.mutate(
                  { accountId, websiteUrl: f.websiteUrl || undefined },
                  {
                    onSuccess: (r) => {
                      setF(toForm(r.kit));
                      toast("Filled in from your website and posts. Review and save.");
                    },
                    onError: (err) => toast(errorMessage(err)),
                  },
                )
              }
            >
              {prefill.isPending ? <Spinner size={11} dark /> : "✦"} Prefill with AI
            </button>
          </div>
        </Section>
        <Section title="Business">
          <div
            className="rp-card"
            style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Name">
                <input
                  className="rp-input"
                  value={f.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field label="Business type">
                <input
                  className="rp-input"
                  value={f.businessType}
                  onChange={(e) => set("businessType", e.target.value)}
                  placeholder="Dental clinic"
                />
              </Field>
              <Field label="City">
                <input
                  className="rp-input"
                  value={f.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Patna"
                />
              </Field>
              <Field label="Language">
                <Select
                  label="Language"
                  value={f.language}
                  onChange={(v) => set("language", v as Form["language"])}
                  block
                  align="start"
                  options={[
                    { value: "en", label: "English" },
                    { value: "hi", label: "Hindi" },
                    { value: "hinglish", label: "Hinglish" },
                  ]}
                />
              </Field>
            </div>
            <Field label="Audience">
              <input
                className="rp-input"
                value={f.audience}
                onChange={(e) => set("audience", e.target.value)}
                placeholder="Families nearby who want painless dental care"
              />
            </Field>
            <Field label="Voice">
              <Seg
                label="Voice"
                value={f.voice}
                small
                onChange={(v) => set("voice", v)}
                options={[
                  { id: "friendly", label: "Friendly" },
                  { id: "professional", label: "Professional" },
                  { id: "playful", label: "Playful" },
                ]}
              />
            </Field>
          </div>
        </Section>
        <Section title="What to post about">
          <div
            className="rp-card"
            style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <Field label="Topics" hint="Separated by commas.">
              <input
                className="rp-input"
                value={f.topics}
                onChange={(e) => set("topics", e.target.value)}
                placeholder="oral hygiene tips, braces, kids' dental care"
              />
            </Field>
            <Field label="Offers and products" hint="One per line.">
              <textarea
                className="rp-textarea"
                rows={3}
                value={f.offers}
                onChange={(e) => set("offers", e.target.value)}
              />
            </Field>
            <Field label="Hashtag sets" hint="One set per line, like Brand: #dentist #patna">
              <textarea
                className="rp-textarea"
                rows={3}
                value={f.hashtagSets}
                onChange={(e) => set("hashtagSets", e.target.value)}
              />
            </Field>
            <Field
              label="Banned words"
              hint="AI never uses these, and posts with them aren’t published automatically."
            >
              <input
                className="rp-input"
                value={f.bannedWords}
                onChange={(e) => set("bannedWords", e.target.value)}
                placeholder="guaranteed, cure"
              />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Call to action">
                <input
                  className="rp-input"
                  value={f.cta}
                  onChange={(e) => set("cta", e.target.value)}
                  placeholder="Book an appointment"
                />
              </Field>
              <Field label="Link">
                <input
                  className="rp-input"
                  value={f.link}
                  onChange={(e) => set("link", e.target.value)}
                  placeholder="https://"
                />
              </Field>
            </div>
          </div>
        </Section>
        <Section title="Look">
          <div
            className="rp-card"
            style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {(["primary", "secondary", "accent"] as const).map((k) => (
                <label
                  key={k}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
                >
                  <input
                    type="color"
                    value={f[k]}
                    onChange={(e) => set(k, e.target.value.toUpperCase())}
                    aria-label={`${k} colour`}
                    style={{
                      width: 34,
                      height: 28,
                      border: "1px solid #E6E4DF",
                      borderRadius: 6,
                      padding: 0,
                      background: "none",
                    }}
                  />
                  <span style={{ textTransform: "capitalize" }}>{k}</span>
                  <span className="rp-mono" style={{ color: MUTED, fontSize: 12 }}>
                    {f[k]}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Heading font">
                <Select
                  label="Heading font"
                  value={f.heading}
                  onChange={(v) => set("heading", v)}
                  block
                  align="start"
                  options={FONTS.map((x) => ({ value: x, label: x }))}
                />
              </Field>
              <Field label="Body font">
                <Select
                  label="Body font"
                  value={f.body}
                  onChange={(v) => set("body", v)}
                  block
                  align="start"
                  options={FONTS.map((x) => ({ value: x, label: x }))}
                />
              </Field>
            </div>
            <Field label="Logo link" hint="A public https image of your logo.">
              <input
                className="rp-input"
                value={f.logoUrl}
                onChange={(e) => set("logoUrl", e.target.value)}
                placeholder="https://"
              />
            </Field>
          </div>
        </Section>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {accountId && custom ? (
            <button
              type="button"
              className="rp-btn-text"
              disabled={reset.isPending}
              onClick={() =>
                reset.mutate(undefined, {
                  onSuccess: (r) => {
                    setF(toForm(r.kit));
                    toast("This account uses the workspace brand kit again");
                  },
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              Use the workspace kit
            </button>
          ) : null}
          <button
            type="button"
            className="rp-btn"
            style={{ padding: "9px 18px" }}
            disabled={save.isPending}
            onClick={() =>
              save.mutate(toPatch(f), {
                onSuccess: () => toast("Brand kit saved"),
                onError: (err) => toast(errorMessage(err)),
              })
            }
          >
            {save.isPending ? <Spinner size={11} /> : null}
            Save brand kit
          </button>
        </div>
      </div>
      <div
        style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 10 }}
      >
        <span className="rp-label">Brand image preview</span>
        <Slide f={f} />
        <span style={{ fontSize: 12, color: MUTED, maxWidth: 300, lineHeight: 1.5 }}>
          Planned posts use these colours and fonts for their images. Upload your own photos in the
          composer any time.
        </span>
      </div>
    </div>
  );
}

export function BrandKitPage({ platform }: { platform: SocialPlatform }) {
  const { accounts, label } = useSocialAccounts(platform);
  const [scope, setScope] = useState("workspace");
  const accountId = scope === "workspace" ? undefined : scope;
  const kit = useBrandKit(accountId);
  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHead
        title="Brand kit"
        sub="Your voice, topics, offers, hashtags and look. Every caption and image follows it, on Instagram and Facebook."
        actions={
          accounts.length ? (
            <Select
              label="Brand kit for"
              value={scope}
              onChange={setScope}
              minWidth={220}
              options={[
                { value: "workspace", label: "All accounts" },
                ...accounts.map((a) => ({ value: a.id, label: `Only ${label(a.id)}` })),
              ]}
            />
          ) : null
        }
      />
      {kit.isPending || !kit.data ? (
        <Skel h={320} />
      ) : (
        <Editor
          key={`${scope}:${kit.data.prefilledAt ?? ""}`}
          initial={kit.data.kit}
          accountId={accountId}
          custom={kit.data.custom}
        />
      )}
    </div>
  );
}
