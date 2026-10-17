"use client";

import { Check, Download, ImagePlus, Smartphone, Trash2 } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { RadioGroup } from "radix-ui";
import { useId, useState, type CSSProperties, type ReactNode } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  useAddStoreToCreatives,
  useChooseStoreStyle,
  useDeleteStoreProject,
  useStoreProject,
} from "@/lib/api/queries";
import type { StoreAsset, StoreChoice, StoreProjectDetail } from "@/lib/api/types";
import { ConfirmDialog } from "@/features/replyly/dialog";
import { Banner, PageHead, Skel, Spinner, useToast } from "@/features/replyly/ui";

import {
  FEATURE_LABELS,
  SIZE_LABELS,
  STATUS,
  STYLE_LABELS,
  languageName,
  mediaSrc,
} from "./labels";
import { BackToStore, CopyButton, StatusPill } from "./store-projects";

const RENDER_PROMPT = "Render the Play Store set I chose in TreeVook and upload it.";
const MUTED = "#6C6962";
const GREEN = "#0F6B4A";

const LIST: CSSProperties = { margin: 0, padding: 0, listStyle: "none" };

export function StoreProjectView() {
  const { id } = useParams<{ id: string }>();
  const project = useStoreProject(id);
  if (project.isPending)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Skel h={80} r={14} />
        <Skel h={380} r={14} />
      </div>
    );
  if (project.isError)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <BackToStore />
        <Banner
          tone="error"
          title="Couldn’t load this project"
          action={
            <button type="button" className="rp-btn-light" onClick={() => void project.refetch()}>
              Try again
            </button>
          }
        >
          {errorMessage(project.error)}
        </Banner>
      </div>
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
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <BackToStore />
        <PageHead
          title={project.name}
          sub={status.hint}
          actions={
            <>
              <StatusPill status={project.status} />
              <DeleteProject project={project} />
            </>
          }
        />
      </div>
      {previews.length ? (
        <StyleChooser key={JSON.stringify(project.choice)} project={project} previews={previews} />
      ) : (
        <div
          className="rp-card"
          style={{
            padding: "32px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            textAlign: "center",
          }}
        >
          <Smartphone size={22} color={MUTED} aria-hidden />
          <span className="rp-serif" style={{ fontSize: 24 }}>
            Waiting for style previews
          </span>
          <span style={{ fontSize: 13, color: MUTED, maxWidth: 440, lineHeight: 1.5 }}>
            Claude Code is preparing your screens. Previews of every style appear here as soon as
            they&apos;re rendered.
          </span>
        </div>
      )}
      {project.choice && !finals.length ? <RenderNext /> : null}
      {finals.length ? <FinalSet project={project} assets={finals} /> : null}
      {screens.length ? <Screens screens={screens} /> : null}
    </div>
  );
}

function Section({
  title,
  desc,
  actions,
  children,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 260px" }}>
          <h2 style={{ fontWeight: 600, fontSize: 15 }}>{title}</h2>
          {desc ? (
            <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>{desc}</span>
          ) : null}
        </div>
        {actions ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="rp-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 12px",
        fontSize: 12.5,
        fontWeight: 500,
        ...(pressed
          ? { borderColor: GREEN, background: "#F1F5F2", color: GREEN }
          : { color: "#55534E" }),
      }}
    >
      {pressed ? <Check size={12} strokeWidth={3} aria-hidden /> : null}
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
  const toast = useToast();
  const langId = useId();
  const sizeId = useId();
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
      desc="Every style uses your screens and copy. Pick one, then the languages and sizes to render."
    >
      <RadioGroup.Root
        value={style}
        onValueChange={setStyle}
        aria-label="Screenshot style"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 14,
        }}
      >
        {styles.map((s) => {
          const preview = previewFor(previews, s);
          const label = STYLE_LABELS[s] ?? { name: s, description: "" };
          const on = style === s;
          return (
            <RadioGroup.Item
              key={s}
              value={s}
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                padding: 0,
                textAlign: "left",
                borderRadius: 14,
                border: `1.5px solid ${on ? "#191917" : "#E6E4DF"}`,
                boxShadow: on ? "0 0 0 1.5px #191917" : "none",
                background: "#fff",
                color: "#191917",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "block", background: "#F4F2EE" }}>
                {preview ? (
                  <Image
                    unoptimized
                    src={mediaSrc(preview.url)}
                    alt={`${label.name} style preview`}
                    width={540}
                    height={960}
                    loading="lazy"
                    style={{ display: "block", width: "100%", height: "auto" }}
                  />
                ) : null}
              </span>
              <span style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12 }}>
                <span
                  style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{label.name}</span>
                  <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
                    {label.description}
                  </span>
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    borderRadius: "50%",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `1.5px solid ${on ? "#191917" : "#C9C5BC"}`,
                    background: on ? "#191917" : "#fff",
                    color: "#fff",
                  }}
                >
                  {on ? <Check size={11} strokeWidth={3} /> : null}
                </span>
              </span>
            </RadioGroup.Item>
          );
        })}
      </RadioGroup.Root>

      <div
        className="rp-card"
        style={{
          padding: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 18,
        }}
      >
        <div
          role="group"
          aria-labelledby={langId}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <span id={langId} style={{ fontWeight: 500, fontSize: 13.5 }}>
            Languages
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {languages.map((l) => (
              <Chip key={l} pressed={langs.includes(l)} onClick={() => setLangs(toggle(langs, l))}>
                {languageName(l)}
              </Chip>
            ))}
          </div>
        </div>
        <div
          role="group"
          aria-labelledby={sizeId}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <span id={sizeId} style={{ fontWeight: 500, fontSize: 13.5 }}>
            Sizes
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {project.options.sizes.map((s) => (
              <Chip key={s} pressed={sizes.includes(s)} onClick={() => setSizes(toggle(sizes, s))}>
                {SIZE_LABELS[s] ?? s}
              </Chip>
            ))}
          </div>
          <span style={{ fontSize: 12, color: MUTED }}>
            Tablet screenshots are only needed if your app supports tablets.
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className="rp-btn"
          disabled={!valid || !dirty || choose.isPending}
          onClick={() =>
            choose.mutate({ style, languages: langs, sizes } as StoreChoice, {
              onSuccess: () => toast("Saved. Tell Claude Code to render the set."),
              onError: (err) => toast(errorMessage(err)),
            })
          }
        >
          {choose.isPending ? <Spinner /> : null}
          {saved ? "Update choice" : "Use this style"}
        </button>
        {!valid ? (
          <span style={{ fontSize: 13, color: MUTED }}>
            Choose at least one language and one size.
          </span>
        ) : null}
      </div>
    </Section>
  );
}

function RenderNext() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "16px 18px",
        borderRadius: 14,
        background: "#F1F5F2",
        border: "1px solid #CFE3D8",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 260px" }}>
        <span style={{ fontWeight: 600, fontSize: 14.5, color: GREEN }}>
          Now go back to Claude Code
        </span>
        <span style={{ fontSize: 13, color: "#55534E" }}>
          Ask it to render the set. The screenshots appear here as they upload.
        </span>
      </div>
      <CopyButton value={RENDER_PROMPT} label="Copy request" done="Request copied" />
    </div>
  );
}

function variantLabel(a: StoreAsset) {
  if (a.kind === "feature_graphic") return FEATURE_LABELS[a.style] ?? "Feature graphic";
  return `${a.name} · ${SIZE_LABELS[a.size] ?? a.size}`;
}

function FinalSet({ project, assets }: { project: StoreProjectDetail; assets: StoreAsset[] }) {
  const toast = useToast();
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
      desc="Upload phone screenshots to Google Play in this order. Select images to reuse them in app-install ads."
      actions={
        <button
          type="button"
          className="rp-btn-light"
          disabled={!selected.length || add.isPending}
          onClick={() =>
            add.mutate(selected, {
              onSuccess: (res) => {
                toast(`${res.data.length} added to Creatives`);
                setSelected([]);
              },
              onError: (err) => toast(errorMessage(err)),
            })
          }
        >
          {add.isPending ? <Spinner dark /> : <ImagePlus size={14} aria-hidden />}
          Add {selected.length || ""} to Creatives
        </button>
      }
    >
      {styles.length > 1 || langs.length > 1 || sizes.length > 1 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
      ) : null}
      <ul
        style={{
          ...LIST,
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${size === "phone" ? 150 : 240}px, 1fr))`,
          gap: 14,
        }}
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
          <h3 style={{ margin: "14px 0 0", fontWeight: 600, fontSize: 14 }}>Feature graphic</h3>
          <ul
            style={{
              ...LIST,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
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
    <div
      role="group"
      aria-label={label}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
    >
      <span style={{ fontSize: 12.5, color: MUTED, width: 72, flexShrink: 0 }}>{label}</span>
      {values.map((v) => (
        <Chip key={v} pressed={value === v} onClick={() => onChange(v)}>
          {name(v)}
        </Chip>
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
  const feature = asset.kind === "feature_graphic";
  return (
    <li style={{ minWidth: 0 }}>
      <div
        className="rp-card"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          borderColor: selected ? GREEN : undefined,
          boxShadow: selected ? `0 0 0 1.5px ${GREEN}` : "none",
        }}
      >
        <a
          href={mediaSrc(asset.url)}
          target="_blank"
          rel="noreferrer"
          style={{ display: "block", background: "#F4F2EE" }}
        >
          <Image
            unoptimized
            src={mediaSrc(asset.url)}
            alt={label}
            width={feature ? 1024 : 540}
            height={feature ? 500 : 960}
            loading="lazy"
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 8px 8px 10px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: 1,
              minWidth: 0,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelect}
              style={{ width: 15, height: 15, margin: 0, flexShrink: 0, accentColor: GREEN }}
            />
            <span
              style={{
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
          </label>
          <a
            href={mediaSrc(asset.url)}
            download={fileName(asset)}
            aria-label={`Download ${label}`}
            className="rp-btn-quiet"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Download size={15} aria-hidden />
          </a>
        </div>
      </div>
    </li>
  );
}

function Screens({ screens }: { screens: StoreAsset[] }) {
  return (
    <Section title="Screens" desc="Captured from your app by Claude Code.">
      <ul style={{ ...LIST, display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {screens.map((s) => (
          <li key={s.id} style={{ width: 112, flexShrink: 0 }}>
            <Image
              unoptimized
              src={mediaSrc(s.url)}
              alt={s.name}
              width={540}
              height={1200}
              loading="lazy"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                borderRadius: 10,
                border: "1px solid #E6E4DF",
                boxSizing: "border-box",
              }}
            />
            <span
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 12,
                color: MUTED,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.name}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DeleteProject({ project }: { project: StoreProjectDetail }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const remove = useDeleteStoreProject();
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        className="rp-btn-light rp-btn-danger"
        style={{ padding: 7 }}
        aria-label={`Delete ${project.name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={15} aria-hidden />
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${project.name}?`}
        description="Its screens, previews and screenshots are removed from TreeVook. Images already added to Creatives stay there, and the files on your computer aren't touched."
        confirm="Delete"
        danger
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(project.id, {
            onSuccess: () => {
              toast("Project deleted");
              router.push("/store");
            },
            onError: (err) => toast(errorMessage(err)),
          })
        }
      />
    </>
  );
}
