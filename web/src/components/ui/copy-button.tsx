"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button, type ButtonProps } from "./button";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  ...props
}: { value: string; label?: string; copiedLabel?: string } & Omit<ButtonProps, "onClick">) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      {...props}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}
