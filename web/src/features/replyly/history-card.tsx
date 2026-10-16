"use client";

import { useRef, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useImportHistory, useImportReport, useSetReportsBucket } from "@/lib/api/queries";
import type { PlayAppDetail } from "@/lib/api/types";

import { ago } from "./tokens";
import { Spinner, useToast } from "./ui";

export function HistoryCard({ app }: { app: PlayAppDetail }) {
  const toast = useToast();
  const upload = useImportReport(app.id);
  const setBucket = useSetReportsBucket();
  const history = useImportHistory(app.id);
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [uri, setUri] = useState("");
  const h = app.history;
  const connected = Boolean(h.bucket) && !editing;
  const fail = (err: unknown) => toast(errorMessage(err));

  return (
    <div
      className="rp-card"
      style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <span style={{ fontWeight: 500 }}>Import older reviews</span>
      {connected ? (
        <>
          <span style={{ fontSize: 12.5, color: "#6C6962", lineHeight: 1.5 }}>
            Reading monthly reports from{" "}
            <span className="rp-mono" style={{ color: "#191917", overflowWrap: "anywhere" }}>
              gs://{h.bucket}/reviews/
            </span>
            . New months import automatically every day.
          </span>
          <span className="rp-mono" style={{ fontSize: 11.5, color: "#6C6962" }}>
            {h.importedAt
              ? `${h.files} month${h.files === 1 ? "" : "s"} · last import ${ago(h.importedAt)}`
              : "Not imported yet"}
          </span>
          {h.error ? (
            <span style={{ fontSize: 12.5, color: "#B42318", lineHeight: 1.5 }}>
              {h.error} Replyly checks again every hour and imports as soon as access works.
            </span>
          ) : null}
          <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
            <button
              type="button"
              className="rp-btn"
              style={{ flex: "1 1 auto" }}
              disabled={history.isPending}
              onClick={() =>
                history.mutate(false, {
                  onSuccess: (r) =>
                    toast(
                      r.changed
                        ? `Imported ${r.imported.toLocaleString()} reviews from ${r.changed} report${r.changed === 1 ? "" : "s"}`
                        : "Already up to date",
                    ),
                  onError: fail,
                })
              }
            >
              {history.isPending ? <Spinner /> : null}
              {history.isPending ? "Importing…" : "Import from Play Console"}
            </button>
            <button
              type="button"
              className="rp-btn-light"
              onClick={() => {
                setUri(`gs://${h.bucket}/reviews/`);
                setEditing(true);
              }}
            >
              Change
            </button>
          </div>
        </>
      ) : (
        <form
          style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}
          onSubmit={(e) => {
            e.preventDefault();
            setBucket.mutate(
              { connectionId: app.connectionId, uri: uri.trim() },
              {
                onSuccess: () => {
                  setEditing(false);
                  toast("Reports connected. Importing history…");
                  history.mutate(false, {
                    onSuccess: (r) =>
                      toast(
                        `Imported ${r.imported.toLocaleString()} reviews from ${r.changed} reports`,
                      ),
                    onError: fail,
                  });
                },
                onError: fail,
              },
            );
          }}
        >
          <span style={{ fontSize: 12.5, color: "#6C6962", lineHeight: 1.5 }}>
            Google’s API only returns the last 7 days. In Play Console → Download reports → Reviews,
            copy the Cloud Storage URI and paste it here to import every month.
          </span>
          <input
            className="rp-input rp-mono"
            aria-label="Play Console reports URI"
            placeholder="gs://pubsite_prod_…/reviews/"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            style={{ fontSize: 12 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
            <button
              type="submit"
              className="rp-btn"
              style={{ flex: "1 1 auto" }}
              disabled={!uri.trim() || setBucket.isPending}
            >
              {setBucket.isPending ? <Spinner /> : null}
              Connect reports
            </button>
            {editing ? (
              <button type="button" className="rp-btn-light" onClick={() => setEditing(false)}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      )}
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          upload.mutate(f, {
            onSuccess: (r) =>
              toast(
                `Imported ${r.imported.toLocaleString()} reviews${r.alreadyHere ? ` · ${r.alreadyHere} already here` : ""}`,
              ),
            onError: fail,
          });
        }}
      />
      <button
        type="button"
        className="rp-btn-text"
        style={{ alignSelf: "flex-start", fontSize: 12.5 }}
        disabled={upload.isPending}
        onClick={() => input.current?.click()}
      >
        {upload.isPending ? "Uploading…" : "or upload a reviews CSV"}
      </button>
    </div>
  );
}
