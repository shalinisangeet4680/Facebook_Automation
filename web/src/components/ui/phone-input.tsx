"use client";

import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { inputClass } from "./input";

export function formatIndianPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

interface PhoneInputProps extends Omit<ComponentProps<"input">, "value" | "onChange"> {
  value: string;
  onChange: (digits: string) => void;
}

export function PhoneInput({ value, onChange, className, ...props }: PhoneInputProps) {
  return (
    <div className={cn("relative", className)}>
      <span className="text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center gap-2 pl-3.5 text-[15px]">
        <span aria-hidden>🇮🇳</span>
        <span>+91</span>
        <span className="bg-border h-5 w-px" />
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={formatIndianPhone(value)}
        onChange={(e) => {
          let digits = e.target.value.replace(/\D/g, "");
          if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
          onChange(digits.slice(0, 10));
        }}
        className={cn(inputClass, "h-12 pl-[92px] font-medium tracking-wide")}
        placeholder="98765 43210"
        {...props}
      />
    </div>
  );
}
