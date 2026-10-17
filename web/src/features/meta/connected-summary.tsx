"use client";

import { ArrowRight, CheckCircle2, RefreshCw, Unplug } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useDisconnectMeta } from "@/lib/api/queries";
import type { AssetKind, Connection } from "@/lib/api/types";
import { ConfirmDialog } from "@/features/replyly/dialog";
import { useToast } from "@/features/replyly/ui";

import { ASSET_LABELS } from "./asset-kinds";
import { CardTitle, CheckRow, Pill, SOFT, cardHead } from "./ui";

const ORDER: AssetKind[] = ["ad_account", "page", "instagram", "dataset", "business"];

export function ConnectedSummary({
  connection,
  celebrate,
  onReplace,
}: {
  connection: Connection;
  celebrate: boolean;
  onReplace: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const disconnect = useDisconnectMeta();
  const counts = ORDER.map((kind) => ({
    kind,
    count: connection.assets.filter((a) => a.kind === kind).length,
  })).filter((c) => c.count > 0);
  const invalid = connection.status === "invalid";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <motion.div
        className="rp-card"
        initial={celebrate ? { opacity: 0, y: 12, scale: 0.98 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{
          padding: 24,
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <motion.span
          initial={celebrate ? { scale: 0, rotate: -30 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.1 }}
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: invalid ? "#FDF0EE" : "#EAF3EE",
            color: invalid ? "#B42318" : "#0F6B4A",
          }}
        >
          {invalid ? <Unplug size={24} /> : <CheckCircle2 size={24} />}
        </motion.span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            flex: "1 1 260px",
            minWidth: 0,
          }}
        >
          <h2 className="rp-serif" style={{ fontSize: 28, lineHeight: 1.1, margin: 0 }}>
            {invalid ? "Your Meta connection stopped working" : "Meta is connected"}
          </h2>
          <span style={{ fontSize: 13.5, color: SOFT }}>
            {invalid
              ? "The token was revoked or expired. Generate a new one and replace it."
              : `Connected as ${connection.systemUser?.name ?? "your system user"} · token ending ${connection.tokenLast4}`}
          </span>
          {counts.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {counts.map(({ kind, count }) => (
                <Pill key={kind}>
                  {count} {count === 1 ? ASSET_LABELS[kind].one : ASSET_LABELS[kind].many}
                </Pill>
              ))}
            </div>
          ) : null}
        </div>
        {invalid ? (
          <button
            type="button"
            className="rp-btn"
            style={{ padding: "10px 16px" }}
            onClick={onReplace}
          >
            <RefreshCw size={14} /> Replace token
          </button>
        ) : (
          <Link href="/setup/accounts" className="rp-btn" style={{ padding: "10px 16px" }}>
            Choose accounts <ArrowRight size={14} />
          </Link>
        )}
      </motion.div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div className="rp-card" style={{ overflow: "hidden" }}>
          <div style={cardHead}>
            <CardTitle title="Connection checks" />
          </div>
          <div style={{ padding: "2px 18px" }}>
            {connection.checks.map((c, i) => (
              <CheckRow
                key={c.key}
                state={c.status}
                label={c.label}
                message={c.message}
                first={i === 0}
              />
            ))}
          </div>
        </div>
        <div
          className="rp-card"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, alignSelf: "start" }}
        >
          <CardTitle
            title="Manage connection"
            sub="Replace the token if you regenerate it in Meta, or disconnect to remove all access."
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {invalid ? null : (
              <button type="button" className="rp-btn-light" onClick={onReplace}>
                <RefreshCw size={14} /> Replace token
              </button>
            )}
            <button
              type="button"
              className="rp-btn-light rp-btn-danger"
              onClick={() => setOpen(true)}
            >
              <Unplug size={14} /> Disconnect
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Disconnect Meta?"
        description="We’ll delete the stored token and your asset list. Automation stops until you connect again."
        confirm="Disconnect"
        danger
        pending={disconnect.isPending}
        onConfirm={() =>
          disconnect.mutate(undefined, {
            onSuccess: () => {
              setOpen(false);
              toast("Meta disconnected");
            },
            onError: (err) => toast(errorMessage(err)),
          })
        }
      />
    </div>
  );
}
