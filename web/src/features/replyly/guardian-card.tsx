"use client";

import { useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useCheckGuardian, useUpdateGuardian, type Guardian } from "@/lib/api/play-releases";

import { ago } from "./tokens";
import { Spinner, Toggle, useToast } from "./ui";

const STATUS: Record<string, [string, string]> = {
  ok: ["#0F6B4A", "Healthy"],
  waiting: ["#8A5A00", "Waiting for data"],
  halted: ["#B42318", "Halted a rollout"],
  idle: ["#55534E", "No rollout to watch"],
  error: ["#B42318", "Couldn't check"],
};

export function GuardianCard({ appId, guardian }: { appId: string; guardian: Guardian }) {
  return (
    <Form
      key={`${appId}:${guardian.maxCrashRate}:${guardian.maxAnrRate}:${guardian.minUsers}`}
      appId={appId}
      guardian={guardian}
    />
  );
}

function Form({ appId, guardian }: { appId: string; guardian: Guardian }) {
  const toast = useToast();
  const update = useUpdateGuardian(appId);
  const check = useCheckGuardian(appId);
  const [crash, setCrash] = useState(String(guardian.maxCrashRate));
  const [anr, setAnr] = useState(String(guardian.maxAnrRate));
  const [users, setUsers] = useState(String(guardian.minUsers));
  const dirty =
    Number(crash) !== guardian.maxCrashRate ||
    Number(anr) !== guardian.maxAnrRate ||
    Number(users) !== guardian.minUsers;
  const valid =
    Number(crash) > 0 &&
    Number(crash) <= 100 &&
    Number(anr) > 0 &&
    Number(anr) <= 100 &&
    Number.isInteger(Number(users)) &&
    Number(users) >= 0;
  const fail = (err: unknown) => toast(errorMessage(err));
  const [color, statusLabel] = guardian.lastStatus
    ? (STATUS[guardian.lastStatus] ?? ["#55534E", guardian.lastStatus])
    : ["#6C6962", "Not checked yet"];
  const d = guardian.defaults;

  return (
    <div
      className="rp-card"
      style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 600 }}>Rollout guardian</span>
          <span style={{ fontSize: 12.5, color: "#6C6962", lineHeight: 1.5 }}>
            Watches staged rollouts and halts one when its crash or ANR rate goes over your limit
            and is worse than the version before. Alerts go to your Slack channel.
          </span>
        </div>
        <Toggle
          label="Rollout guardian"
          on={guardian.enabled}
          disabled={update.isPending}
          onChange={() =>
            update.mutate(
              { enabled: !guardian.enabled },
              {
                onSuccess: (g) =>
                  toast(g.enabled ? "Guardian is watching rollouts" : "Guardian is off"),
                onError: fail,
              },
            )
          }
        />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label className="rp-field" style={{ flex: "1 1 100px" }}>
          Max crash rate %
          <input
            className="rp-input rp-mono"
            type="number"
            min={0.01}
            max={100}
            step={0.01}
            value={crash}
            onChange={(e) => setCrash(e.target.value)}
          />
        </label>
        <label className="rp-field" style={{ flex: "1 1 100px" }}>
          Max ANR rate %
          <input
            className="rp-input rp-mono"
            type="number"
            min={0.01}
            max={100}
            step={0.01}
            value={anr}
            onChange={(e) => setAnr(e.target.value)}
          />
        </label>
        <label className="rp-field" style={{ flex: "1 1 100px" }}>
          Min users
          <input
            className="rp-input rp-mono"
            type="number"
            min={0}
            step={1}
            value={users}
            onChange={(e) => setUsers(e.target.value)}
          />
        </label>
      </div>
      <span style={{ fontSize: 12, color: "#6C6962", lineHeight: 1.5 }}>
        Google&apos;s bad-behaviour thresholds are {d.maxCrashRate}% user-perceived crashes and{" "}
        {d.maxAnrRate}% ANRs.
        {Number(crash) !== d.maxCrashRate ||
        Number(anr) !== d.maxAnrRate ||
        Number(users) !== d.minUsers ? (
          <>
            {" "}
            <button
              type="button"
              className="rp-btn-text"
              style={{ fontSize: 12 }}
              onClick={() => {
                setCrash(String(d.maxCrashRate));
                setAnr(String(d.maxAnrRate));
                setUsers(String(d.minUsers));
              }}
            >
              Use Google&apos;s
            </button>
          </>
        ) : null}
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="rp-btn"
          disabled={!dirty || !valid || update.isPending}
          onClick={() =>
            update.mutate(
              { maxCrashRate: Number(crash), maxAnrRate: Number(anr), minUsers: Number(users) },
              { onSuccess: () => toast("Guardian limits saved"), onError: fail },
            )
          }
        >
          {update.isPending ? <Spinner /> : null} Save limits
        </button>
        <button
          type="button"
          className="rp-btn-light"
          disabled={!guardian.enabled || check.isPending}
          onClick={() =>
            check.mutate(undefined, {
              onSuccess: (g) =>
                toast(
                  g.halted.length
                    ? `Halted version ${g.halted.join(", ")}`
                    : "Checked: nothing to halt",
                ),
              onError: fail,
            })
          }
        >
          {check.isPending ? <Spinner dark /> : null} Check now
        </button>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: 12,
          borderRadius: 10,
          background: "#F7F6F3",
          fontSize: 12.5,
          lineHeight: 1.5,
        }}
      >
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
          <span style={{ fontWeight: 500, color }}>{guardian.enabled ? statusLabel : "Off"}</span>
          {guardian.lastCheckedAt ? (
            <span className="rp-mono" style={{ fontSize: 11.5, color: "#6C6962" }}>
              {ago(guardian.lastCheckedAt)}
            </span>
          ) : null}
        </span>
        {guardian.enabled && guardian.lastMessage ? <span>{guardian.lastMessage}</span> : null}
        {guardian.enabled && guardian.ignoredVersion ? (
          <span style={{ color: "#6C6962" }}>
            Version {guardian.ignoredVersion} is skipped because you resumed it after a halt.
          </span>
        ) : null}
      </div>
    </div>
  );
}
