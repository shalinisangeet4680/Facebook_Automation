"use client";

import { ArrowLeft, Check, Copy, Smartphone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useStoreProjects } from "@/lib/api/queries";
import type { StoreProject } from "@/lib/api/types";
import { Banner, copyText, PageHead, Skel, useToast } from "@/features/replyly/ui";

import { STATUS, TONES, languageName, mediaSrc } from "./labels";

const COMMAND = "/store-creatives:store-creatives";
const MUTED = "#6C6962";
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: 16,
  margin: 0,
  padding: 0,
  listStyle: "none",
};

export function StatusPill({ status }: { status: StoreProject["status"] }) {
  const s = STATUS[status];
  const tone = TONES[s.tone];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        background: tone.bg,
        color: tone.fg,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  done = "Copied",
}: {
  value: string;
  label?: string;
  done?: string;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="rp-btn-light"
      style={{ padding: "6px 12px", fontSize: 12.5, flexShrink: 0 }}
      onClick={() =>
        void copyText(value).then((ok) => {
          if (ok) {
            setCopied(true);
            toast(done);
          } else toast("Couldn’t copy. Select the text and copy it instead.");
        })
      }
    >
      {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function StoreProjects() {
  const projects = useStoreProjects();
  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHead
        title="Store listing"
        sub="Google Play screenshots and feature graphics made from your app. Claude Code reads your app, captures its screens and renders the images on your computer; you choose the style here."
      />
      {projects.isPending ? (
        <div style={GRID}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skel key={i} h={290} r={14} />
          ))}
        </div>
      ) : projects.isError ? (
        <Banner
          tone="error"
          title="Couldn’t load your store listings"
          action={
            <button type="button" className="rp-btn-light" onClick={() => void projects.refetch()}>
              Try again
            </button>
          }
        >
          {errorMessage(projects.error)}
        </Banner>
      ) : projects.data.data.length === 0 ? (
        <GetStarted />
      ) : (
        <ul style={GRID}>
          {projects.data.data.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function GetStarted() {
  const steps = [
    <>
      Connect TreeVook to Claude Code on the <Link href="/claude">Claude page</Link>.
    </>,
    <>Install the store-creatives plugin in Claude Code.</>,
    <>
      Open Claude Code in your Android app&apos;s folder and run the command below. Claude writes
      the copy, captures the screens from your emulator and sends style previews here.
    </>,
  ];
  return (
    <div className="rp-card" style={{ overflow: "hidden", maxWidth: 760 }}>
      <div
        style={{
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderBottom: "1px solid #EFEDE8",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#EAF3EE",
            color: "#0F6B4A",
          }}
        >
          <Smartphone size={17} />
        </span>
        <h2 style={{ fontWeight: 600, fontSize: 15 }}>Make your store listing images</h2>
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {steps.map((step, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              padding: "14px 20px",
              borderTop: i ? "1px solid #EFEDE8" : "none",
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "#55534E",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontFamily: "var(--rp-mono)",
                background: "#EFEDE8",
                color: "#191917",
              }}
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div style={{ padding: "0 20px 20px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 10px 10px 14px",
            borderRadius: 10,
            background: "#191917",
            color: "#E9E7E1",
          }}
        >
          <code className="rp-mono" style={{ fontSize: 13, overflowWrap: "anywhere" }}>
            {COMMAND}
          </code>
          <CopyButton value={COMMAND} done="Command copied" />
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: StoreProject }) {
  const { counts } = project;
  return (
    <li style={{ minWidth: 0 }}>
      <Link
        href={`/store/${project.id}`}
        className="rp-card rp-row"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          color: "inherit",
        }}
      >
        <span
          style={{
            height: 190,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: "#F4F2EE",
            borderBottom: "1px solid #EFEDE8",
          }}
        >
          {project.coverUrl ? (
            <Image
              unoptimized
              src={mediaSrc(project.coverUrl)}
              alt=""
              width={107}
              height={190}
              loading="lazy"
              style={{ height: "100%", width: "auto", objectFit: "contain" }}
            />
          ) : (
            <Smartphone size={28} color="#9C9890" aria-hidden />
          )}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 6, padding: 16, flex: 1 }}>
          <span
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: 14.5,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {project.name}
            </span>
            <StatusPill status={project.status} />
          </span>
          <span style={{ fontSize: 12.5, color: MUTED }}>
            {project.languages.map(languageName).join(", ") || "No languages yet"}
          </span>
          <span style={{ fontSize: 12.5, color: MUTED, marginTop: "auto" }}>
            {counts.screenshots
              ? `${counts.screenshots} screenshots`
              : `${counts.screens} screens, ${counts.previews} previews`}{" "}
            · Updated {date.format(new Date(project.updatedAt))}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function BackToStore() {
  return (
    <Link
      href="/store"
      className="rp-btn-quiet"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
    >
      <ArrowLeft size={14} aria-hidden /> Store listing
    </Link>
  );
}
