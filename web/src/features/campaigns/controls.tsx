"use client";

import { useState, type ReactNode } from "react";

import { errorMessage } from "@/lib/api/errors";
import { useSetAdBudget, useSetAdStatus } from "@/lib/api/queries";
import type { AdLevel } from "@/lib/api/types";
import { Field } from "@/features/plans/plan-sections";
import {
  ConfirmDialog,
  RpDialogClose,
  RpDialogContent,
  RpDialogRoot,
} from "@/features/replyly/dialog";
import { Banner, Toggle, useToast } from "@/features/replyly/ui";

import { LEVEL_LABELS, MUTED, delivery, money } from "./labels";

export function DeliveryPill({ status }: { status: string }) {
  const d = delivery(status);
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        background: d.bg,
        color: d.fg,
        fontWeight: 500,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {d.label}
    </span>
  );
}

export function EmptyCard({
  title,
  text,
  action,
}: {
  title: string;
  text: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="rp-card"
      style={{
        padding: "32px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <span className="rp-serif" style={{ fontSize: 24 }}>
        {title}
      </span>
      <span style={{ fontSize: 13, color: MUTED, maxWidth: 440 }}>{text}</span>
      {action ? (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}

const PAUSE_TEXT: Record<AdLevel, string> = {
  campaign: "It stops spending right away. You can turn it back on any time.",
  adset: "This ad set stops spending right away. The rest of the campaign keeps running.",
  ad: "This ad stops showing right away. Other ads in the ad set keep running.",
};

const RESUME_TEXT: Record<AdLevel, string> = {
  campaign:
    "It starts spending its budget again as soon as Meta approves it. Paused ad sets and ads inside stay paused.",
  adset: "It starts spending its budget again as long as the campaign is on.",
  ad: "It starts showing again as long as its ad set and campaign are on.",
};

export function StatusSwitch({
  level,
  id,
  name,
  status,
  canManage,
}: {
  level: AdLevel;
  id: string;
  name: string;
  status: string;
  canManage: boolean;
}) {
  const toast = useToast();
  const mutation = useSetAdStatus();
  const [open, setOpen] = useState(false);
  const on = status === "ACTIVE";
  const next = on ? "PAUSED" : "ACTIVE";
  const kind = LEVEL_LABELS[level];
  return (
    <>
      <span title={canManage ? undefined : "Only workspace owners and admins can change this."}>
        <Toggle
          on={on}
          label={`${on ? "Pause" : "Turn on"} ${kind} ${name}`}
          disabled={!canManage || mutation.isPending}
          onChange={() => setOpen(true)}
        />
      </span>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={on ? `Pause “${name}”?` : `Turn on “${name}”?`}
        description={on ? PAUSE_TEXT[level] : RESUME_TEXT[level]}
        confirm={on ? `Pause ${kind}` : `Turn on ${kind}`}
        pending={mutation.isPending}
        onConfirm={() =>
          mutation.mutate(
            { level, id, status: next },
            {
              onSuccess: () => {
                setOpen(false);
                toast(on ? `Paused “${name}”` : `Turned on “${name}”`);
              },
              onError: (err) => {
                setOpen(false);
                toast(errorMessage(err));
              },
            },
          )
        }
      />
    </>
  );
}

export function budgetError(
  value: string,
  current: number | null,
  maxDailyBudget: number,
  currency: string,
): string | null {
  const amount = Number(value);
  if (!value.trim() || !Number.isFinite(amount) || amount <= 0) return "Enter an amount above 0.";
  if (Math.round(amount * 100) !== amount * 100) return "Use at most 2 decimal places.";
  if (amount > maxDailyBudget)
    return `Your limit is ${money(maxDailyBudget, currency)} a day. You can change it in Settings.`;
  if (current !== null && amount === current) return "That's already the daily budget.";
  return null;
}

export function BudgetDialog({
  open,
  onOpenChange,
  level,
  id,
  name,
  current,
  currency,
  maxDailyBudget,
  monthlyBudget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: "campaign" | "adset";
  id: string;
  name: string;
  current: number | null;
  currency: string;
  maxDailyBudget: number;
  monthlyBudget: number | null;
}) {
  const toast = useToast();
  const mutation = useSetAdBudget();
  const [value, setValue] = useState(current === null ? "" : String(current));
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const local = budgetError(value, current, maxDailyBudget, currency);
  const amount = Number(value);
  const kind = LEVEL_LABELS[level];

  const close = () => {
    setConfirming(false);
    onOpenChange(false);
  };

  const change = current && !local ? Math.round(((amount - current) / current) * 100) : null;

  return (
    <>
      <RpDialogRoot open={open && !confirming} onOpenChange={(next) => !next && close()}>
        <RpDialogContent
          title="Edit daily budget"
          description={`For the ${kind} “${name}”. The new budget applies right away.`}
        >
          <form
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              setTried(true);
              setServerError(null);
              if (!local) setConfirming(true);
            }}
          >
            <Field
              label={`Daily budget (${currency})`}
              error={tried ? local : null}
              hint={`Limit ${money(maxDailyBudget, currency)} a day${
                monthlyBudget ? ` · monthly budget ${money(monthlyBudget, currency)}` : ""
              }`}
            >
              <input
                className="rp-input"
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={value}
                autoFocus
                onChange={(e) => {
                  setValue(e.target.value);
                  setServerError(null);
                }}
              />
            </Field>
            {serverError ? (
              <Banner tone="error" title="Budget not changed">
                {serverError}
              </Banner>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <RpDialogClose type="button" className="rp-btn-light">
                Cancel
              </RpDialogClose>
              <button type="submit" className="rp-btn">
                Review change
              </button>
            </div>
          </form>
        </RpDialogContent>
      </RpDialogRoot>
      <ConfirmDialog
        open={open && confirming}
        onOpenChange={(next) => {
          if (!next) setConfirming(false);
        }}
        title={`Change the budget of “${name}”?`}
        description={
          current === null
            ? `It will spend up to ${money(amount, currency, 2)} a day.`
            : `From ${money(current, currency, 2)} to ${money(amount, currency, 2)} a day${
                change !== null ? ` (${change >= 0 ? "+" : ""}${change}%)` : ""
              }. Meta starts using the new budget right away.`
        }
        confirm="Change budget"
        pending={mutation.isPending}
        onConfirm={() =>
          mutation.mutate(
            { level, id, dailyBudget: amount },
            {
              onSuccess: (result) => {
                close();
                toast(result.warnings[0] ?? `Budget set to ${money(amount, currency, 2)} a day`);
              },
              onError: (err) => {
                setConfirming(false);
                setServerError(errorMessage(err));
              },
            },
          )
        }
      />
    </>
  );
}
