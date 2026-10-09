"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  "aria-describedby"?: string;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  autoFocus,
  ...aria
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function focus(index: number) {
    const el = refs.current[Math.max(0, Math.min(length - 1, index))];
    el?.focus();
    el?.select();
  }

  function commit(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  }

  function handleInput(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    if (typed.length > 1) {
      const merged = (value.slice(0, index) + typed).slice(0, length);
      commit(merged);
      focus(merged.length);
      return;
    }
    const chars = digits.slice();
    chars[index] = typed;
    commit(chars.join(""));
    focus(index + 1);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const chars = digits.slice();
      if (chars[index]) {
        chars[index] = "";
        onChange(chars.join(""));
      } else if (index > 0) {
        chars[index - 1] = "";
        onChange(chars.join(""));
        focus(index - 1);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focus(index + 1);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    commit(pasted);
    focus(Math.min(pasted.length, length - 1));
  }

  return (
    <div className="flex gap-2 sm:gap-3" role="group" aria-label="Verification code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={length}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          aria-describedby={aria["aria-describedby"]}
          className={cn(
            "border-border bg-surface text-foreground caret-accent size-12 rounded-[var(--radius-control)] border text-center font-mono text-[20px] font-semibold shadow-[var(--shadow-raised)] transition-[border-color,box-shadow,transform] outline-none sm:size-14 sm:text-[22px]",
            "focus:border-accent focus:ring-4 focus:ring-[var(--ring)]",
            digit && "border-border-strong",
            invalid && "border-danger focus:ring-danger/20 animate-[shake_0.35s_ease-in-out]",
          )}
        />
      ))}
    </div>
  );
}
