"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import {
  useDraftNotes,
  useSaveNotes,
  type Release,
  type ReleaseTrack,
  type ReleasesOverview,
} from "@/lib/api/play-releases";

import { Select } from "./select";
import { Spinner, useToast } from "./ui";

const FIELD = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #E6E4DF",
  background: "#FAF9F7",
  fontSize: 13,
  lineHeight: 1.55,
  resize: "vertical",
  outline: "none",
  color: "#191917",
} as const;

interface Choice {
  key: string;
  track: ReleaseTrack;
  release: Release;
}

function choices(tracks: ReleaseTrack[]): Choice[] {
  return tracks.flatMap((track) =>
    track.releases.map((release) => ({
      key: `${track.track}|${release.versionCodes[0]}`,
      track,
      release,
    })),
  );
}

function preferred(list: Choice[]) {
  const rank = (c: Choice) =>
    c.release.status === "inProgress" || c.release.status === "halted"
      ? 0
      : c.release.status === "draft"
        ? 1
        : 2;
  return [...list].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

export function ReleaseNotesCard({ data }: { data: ReleasesOverview }) {
  const list = choices(data.tracks);
  const [key, setKey] = useState<string | null>(null);
  const current = list.find((c) => c.key === key) ?? preferred(list);
  return (
    <div
      className="rp-card"
      style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontWeight: 600 }}>Release notes</span>
        <span style={{ fontSize: 12.5, color: "#6C6962", lineHeight: 1.5 }}>
          Paste the changelog and let AI write What&apos;s new in every store language, then edit
          and save it on the release.
        </span>
      </div>
      {current ? (
        <>
          <Select
            label="Release"
            block
            align="start"
            value={current.key}
            onChange={setKey}
            options={list.map((c) => ({
              value: c.key,
              label: `${c.track.label} · ${c.release.name ?? "Release"} (${c.release.versionCodes.join(", ")})`,
            }))}
          />
          <Editor
            key={current.key}
            appId={data.app.id}
            choice={current}
            languages={data.languages}
            max={data.noteMax}
          />
        </>
      ) : (
        <span style={{ fontSize: 13, color: "#6C6962" }}>Upload a build to a track first.</span>
      )}
    </div>
  );
}

function Editor({
  appId,
  choice,
  languages,
  max,
}: {
  appId: string;
  choice: Choice;
  languages: string[];
  max: number;
}) {
  const toast = useToast();
  const draft = useDraftNotes(appId);
  const save = useSaveNotes(appId);
  const initial = Object.fromEntries(choice.release.notes.map((n) => [n.language, n.text]));
  const langs = [...new Set([...languages, ...Object.keys(initial)])];
  const [notes, setNotes] = useState<Record<string, string>>(initial);
  const [changelog, setChangelog] = useState("");
  const over = langs.filter((l) => (notes[l] ?? "").trim().length > max);

  return (
    <>
      <label className="rp-field">
        Changelog
        <textarea
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          rows={4}
          placeholder={"- New checkout\n- Saved addresses\n- Fixed a crash on the orders screen"}
          style={{ ...FIELD, fontFamily: "var(--rp-mono)", fontSize: 12.5 }}
        />
      </label>
      <button
        type="button"
        className="rp-btn-light"
        style={{ alignSelf: "flex-start" }}
        disabled={changelog.trim().length < 3 || draft.isPending}
        onClick={() =>
          draft.mutate(
            {
              changelog,
              versionName: choice.release.name ?? undefined,
              languages: langs.length ? langs : undefined,
            },
            {
              onSuccess: (r) => {
                setNotes((n) => ({
                  ...n,
                  ...Object.fromEntries(r.notes.map((x) => [x.language, x.text])),
                }));
                toast(
                  `Drafted notes in ${r.notes.length} language${r.notes.length === 1 ? "" : "s"}`,
                );
              },
              onError: (err) => toast(errorMessage(err)),
            },
          )
        }
      >
        {draft.isPending ? <Spinner dark /> : null} Write with AI
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {langs.map((lang) => {
          const n = (notes[lang] ?? "").trim().length;
          return (
            <label key={lang} className="rp-field">
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span className="rp-mono">{lang}</span>
                <span className="rp-mono" style={{ color: n > max ? "#B42318" : "#6C6962" }}>
                  {n}/{max}
                </span>
              </span>
              <textarea
                value={notes[lang] ?? ""}
                onChange={(e) => setNotes((x) => ({ ...x, [lang]: e.target.value }))}
                rows={3}
                style={FIELD}
              />
            </label>
          );
        })}
      </div>
      <button
        type="button"
        className="rp-btn"
        style={{ alignSelf: "flex-start" }}
        disabled={save.isPending || over.length > 0}
        onClick={() =>
          save.mutate(
            {
              track: choice.track.track,
              versionCode: choice.release.versionCodes[0]!,
              notes: langs.map((language) => ({ language, text: notes[language] ?? "" })),
            },
            {
              onSuccess: () => toast("Release notes saved on Google Play"),
              onError: (err) => toast(errorMessage(err)),
            },
          )
        }
      >
        {save.isPending ? <Spinner /> : null} Save notes
      </button>
      {over.length ? (
        <span style={{ fontSize: 12.5, color: "#B42318" }}>
          Shorten {over.join(", ")} to {max} characters.
        </span>
      ) : null}
    </>
  );
}
