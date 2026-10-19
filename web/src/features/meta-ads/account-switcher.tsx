"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";

import { errorMessage } from "@/lib/api/errors";
import { useMetaAssets, useSwitchAdAccount } from "@/lib/api/queries";
import type { Asset } from "@/lib/api/types";
import { Spinner, useToast } from "@/features/replyly/ui";

const MUTED = "#6C6962";

function currencyOf(asset: Asset): string | null {
  return typeof asset.details.currency === "string" ? asset.details.currency : null;
}

export function useAdAccounts() {
  const assets = useMetaAssets();
  const accounts = (assets.data?.data ?? []).filter((a) => a.kind === "ad_account");
  const active = accounts.find((a) => a.isPrimary) ?? null;
  return { accounts, active, loading: assets.isPending };
}

export function AdAccountSwitcher({ inline }: { inline?: boolean }) {
  const { accounts, active, loading } = useAdAccounts();
  const switchAccount = useSwitchAdAccount();
  const toast = useToast();
  if (loading || !active) return null;
  const currency = currencyOf(active);
  const label = (
    <>
      <span style={{ color: MUTED }}>Ad account:</span>{" "}
      <span style={{ fontWeight: 500, color: "#191917", overflowWrap: "anywhere" }}>
        {active.name}
      </span>
      {currency ? (
        <span className="rp-mono" style={{ color: MUTED, fontSize: 11.5 }}>
          {" "}
          · {currency}
        </span>
      ) : null}
    </>
  );
  const style = inline
    ? {
        fontSize: 13,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap" as const,
      }
    : { fontSize: 12, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" as const };

  if (accounts.length < 2) return <span style={style}>{label}</span>;

  const choose = (asset: Asset) => {
    if (asset.isPrimary || switchAccount.isPending) return;
    switchAccount.mutate(asset.externalId, {
      onSuccess: (result) =>
        toast(
          result.needsReview
            ? `Switched to ${result.adAccount.name}. Choose a dataset (Pixel) for it in Meta account settings.`
            : `Switched to ${result.adAccount.name}`,
        ),
      onError: (err) => toast(errorMessage(err)),
    });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="rp-btn-quiet"
        aria-label={`Ad account: ${active.name}. Switch ad account`}
        style={{
          ...style,
          padding: inline ? "2px 6px" : "4px 0",
          margin: inline ? "0 -6px" : 0,
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        {label}
        {switchAccount.isPending ? (
          <Spinner size={10} dark />
        ) : (
          <ChevronDown size={13} color={MUTED} aria-hidden />
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal
        container={
          typeof document === "undefined"
            ? undefined
            : (document.querySelector<HTMLElement>(".rp") ?? undefined)
        }
      >
        <DropdownMenu.Content
          className="rp-dd-menu"
          align="start"
          sideOffset={6}
          style={{
            minWidth: 240,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: 320,
            overflowY: "auto",
            padding: 4,
          }}
        >
          <DropdownMenu.Label style={{ padding: "6px 10px", fontSize: 11.5, color: MUTED }}>
            Switch ad account
          </DropdownMenu.Label>
          {accounts.map((a) => (
            <DropdownMenu.Item
              key={a.id}
              className="rp-dd-item"
              onSelect={() => choose(a)}
              aria-current={a.isPrimary ? "true" : undefined}
            >
              <span
                style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}
              >
                <span style={{ overflowWrap: "anywhere" }}>{a.name}</span>
                <span className="rp-mono" style={{ fontSize: 11, color: MUTED }}>
                  {a.externalId}
                  {currencyOf(a) ? ` · ${currencyOf(a)}` : ""}
                </span>
              </span>
              {a.isPrimary ? (
                <span className="rp-dd-check" aria-hidden>
                  <Check size={13} />
                </span>
              ) : null}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator style={{ height: 1, background: "#EFEDE8", margin: "4px 0" }} />
          <DropdownMenu.Item asChild className="rp-dd-item">
            <Link href="/setup/accounts" style={{ color: "inherit" }}>
              Page, Instagram and dataset…
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
