"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useBusinessStatus, useDisconnectGoogle, useDiscoverLocations } from "@/lib/api/business";
import { useToast } from "@/features/replyly/ui";

import { setOnboarded, useGoogleSignIn } from "./connect-page";
import { useGoogleConnected } from "./shell";
import { agoShort, GoogleMark, Notice, Skel } from "./ui";

import "./account.css";

type Connection = ReturnType<typeof useGoogleConnected>["connections"][number];

function checked(iso: string) {
  const a = agoShort(iso);
  return a === "now" ? "checked just now" : `checked ${a} ago`;
}

function Row({
  c,
  last,
  discovering,
  onDiscover,
  onReconnect,
  reconnecting,
}: {
  c: Connection;
  last: boolean;
  discovering: boolean;
  onDiscover: () => void;
  onReconnect: () => void;
  reconnecting: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const disconnect = useDisconnectGoogle();
  const [confirm, setConfirm] = useState(false);
  const failed = c.status === "error";
  return (
    <div className="gb-account-row">
      <span className="gb-account-mark">
        <GoogleMark size={18} />
      </span>
      <div className="gb-account-info">
        <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{c.email}</div>
        <div className="gb-account-meta" style={{ color: failed ? "var(--gb-red)" : undefined }}>
          <span
            className="gb-dot"
            style={{ background: failed ? "var(--gb-red)" : undefined }}
            aria-hidden
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {failed
              ? (c.error ?? "Google stopped accepting this sign-in")
              : `${c.locations} location${c.locations === 1 ? "" : "s"} · ${checked(c.discoveredAt ?? c.createdAt)}`}
          </span>
        </div>
      </div>
      {confirm ? (
        <div className="gb-account-confirm" role="group" aria-label={`Disconnect ${c.email}`}>
          <span style={{ fontSize: 12, color: "var(--gb-muted)" }}>
            Its locations, reviews and posts leave TreeVook. Nothing changes on Google.
          </span>
          <span style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="gb-btn gb-account-sm"
              disabled={disconnect.isPending}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="gb-btn gb-account-sm gb-account-danger-solid"
              disabled={disconnect.isPending}
              onClick={() =>
                disconnect.mutate(c.id, {
                  onSuccess: () => {
                    toast("Google disconnected");
                    if (last) {
                      setOnboarded(false);
                      router.push("/business/connect");
                    }
                  },
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
            </button>
          </span>
        </div>
      ) : (
        <span className="gb-account-actions">
          {failed ? (
            <button
              type="button"
              className="gb-btn gb-btn-dark gb-account-sm"
              disabled={reconnecting}
              onClick={onReconnect}
            >
              {reconnecting ? "Connecting…" : "Reconnect"}
            </button>
          ) : (
            <button
              type="button"
              className="gb-btn gb-account-sm"
              disabled={discovering}
              onClick={onDiscover}
            >
              {discovering ? "Checking…" : "Check for new"}
            </button>
          )}
          <button
            type="button"
            className="gb-btn gb-btn-danger gb-account-sm"
            style={{ padding: "0 10px" }}
            onClick={() => setConfirm(true)}
          >
            Disconnect
          </button>
        </span>
      )}
    </div>
  );
}

export function BusinessAccountPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const error = params.get("error");
  const status = useBusinessStatus();
  const { connected, connections, loading } = useGoogleConnected();
  const discover = useDiscoverLocations();
  const { busy, signIn } = useGoogleSignIn();

  useEffect(() => {
    if (!loading && !connected) router.replace("/business/connect");
  }, [loading, connected, router]);

  const runDiscover = () =>
    discover.mutate(undefined, {
      onSuccess: (r) => {
        const n = r.added.length + r.restored.length;
        toast(
          r.error
            ? r.error
            : n
              ? `Added ${n} location${n === 1 ? "" : "s"}`
              : "No new locations found",
        );
      },
      onError: (err) => toast(errorMessage(err)),
    });

  return (
    <div className="gb-narrow gb-pop" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {status.data?.mock ? (
        <Notice tone="warn">
          Demo mode: Google hasn’t approved Business Profile API access for this server yet, so
          accounts connect sample locations.
        </Notice>
      ) : null}
      {loading ? (
        <Skel h={130} r={14} />
      ) : (
        <div className="gb-card" style={{ overflow: "hidden" }}>
          {connections.map((c) => (
            <Row
              key={c.id}
              c={c}
              last={connections.length === 1}
              discovering={discover.isPending}
              onDiscover={runDiscover}
              onReconnect={signIn}
              reconnecting={busy}
            />
          ))}
          <button
            type="button"
            className="gb-account-add"
            disabled={busy || status.data?.configured === false}
            onClick={signIn}
          >
            <span style={{ fontSize: 16 }} aria-hidden>
              +
            </span>
            {busy ? "Opening Google…" : "Add another Google account"}
          </button>
        </div>
      )}
      <div className="gb-account-create">
        <span style={{ flex: 1, fontSize: 13, color: "var(--gb-muted)" }}>
          Business not on Google yet?
        </span>
        <button
          type="button"
          className="gb-btn gb-account-sm"
          onClick={() => router.push("/business/create")}
        >
          Create a profile
        </button>
      </div>
    </div>
  );
}
