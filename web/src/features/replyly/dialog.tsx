"use client";

import { X } from "lucide-react";
import { Dialog as Radix } from "radix-ui";
import type { ReactNode } from "react";

import { Spinner } from "./ui";

export const RpDialogRoot = Radix.Root;
export const RpDialogTrigger = Radix.Trigger;
export const RpDialogClose = Radix.Close;

const container = () =>
  typeof document === "undefined"
    ? undefined
    : (document.querySelector<HTMLElement>(".rp") ?? undefined);

export function RpDialogContent({
  title,
  description,
  children,
  width = 440,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  width?: number;
}) {
  return (
    <Radix.Portal container={container()}>
      <Radix.Overlay
        style={{ position: "fixed", inset: 0, background: "rgba(25,25,23,.35)", zIndex: 50 }}
      />
      <Radix.Content
        className="rp-in"
        style={{
          position: "fixed",
          top: "max(24px, 10vh)",
          left: "50%",
          translate: "-50% 0",
          width: `min(${width}px, calc(100vw - 32px))`,
          maxHeight: "calc(100vh - max(48px, 20vh))",
          overflowY: "auto",
          boxSizing: "border-box",
          padding: 24,
          borderRadius: 16,
          background: "#fff",
          border: "1px solid #E6E4DF",
          boxShadow: "0 24px 60px -20px rgba(25,25,23,.35)",
          zIndex: 51,
          display: "grid",
          alignContent: "start",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingRight: 28 }}>
          <Radix.Title className="rp-serif" style={{ fontSize: 26, lineHeight: 1.1, margin: 0 }}>
            {title}
          </Radix.Title>
          {description ? (
            <Radix.Description style={{ fontSize: 13.5, color: "#55534E", margin: 0 }}>
              {description}
            </Radix.Description>
          ) : null}
        </div>
        {children}
        <Radix.Close
          aria-label="Close"
          className="rp-btn-quiet"
          style={{ position: "absolute", top: 18, right: 18, display: "flex" }}
        >
          <X size={18} />
        </Radix.Close>
      </Radix.Content>
    </Radix.Portal>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  danger,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirm: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <RpDialogRoot open={open} onOpenChange={onOpenChange}>
      <RpDialogContent title={title} description={description}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <RpDialogClose className="rp-btn-light">Cancel</RpDialogClose>
          <button
            type="button"
            className="rp-btn"
            style={danger ? { background: "#B42318" } : undefined}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? <Spinner /> : null}
            {confirm}
          </button>
        </div>
      </RpDialogContent>
    </RpDialogRoot>
  );
}
