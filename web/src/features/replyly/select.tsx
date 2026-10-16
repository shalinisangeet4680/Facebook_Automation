"use client";

import { Select as Radix } from "radix-ui";
import type { ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: string;
  dot?: string;
  icon?: ReactNode;
}

function Lead({ option }: { option?: SelectOption }) {
  if (option?.icon) return <span style={{ display: "flex", flexShrink: 0 }}>{option.icon}</span>;
  if (option?.dot)
    return (
      <span
        aria-hidden
        style={{ width: 8, height: 8, borderRadius: 3, background: option.dot, flexShrink: 0 }}
      />
    );
  return null;
}

export function Select({
  value,
  onChange,
  options,
  label,
  minWidth = 160,
  block,
  align = "end",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  minWidth?: number;
  block?: boolean;
  align?: "start" | "end";
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Radix.Root value={value} onValueChange={onChange}>
      <Radix.Trigger
        className="rp-dd"
        aria-label={label}
        style={{ minWidth: block ? 0 : minWidth, width: block ? "100%" : undefined }}
      >
        <Lead option={current} />
        <span className="rp-dd-value">
          <Radix.Value>{current?.label}</Radix.Value>
        </span>
        <Radix.Icon className="rp-dd-chev" aria-hidden>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M2 3.5 5 6.5 8 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Radix.Icon>
      </Radix.Trigger>
      <Radix.Content
        className="rp-dd-menu"
        position="popper"
        sideOffset={6}
        align={align}
        style={{ minWidth: "var(--radix-select-trigger-width)" }}
      >
        <Radix.Viewport style={{ padding: 4 }}>
          {options.map((o) => (
            <Radix.Item key={o.value} value={o.value} className="rp-dd-item">
              <Lead option={o} />
              <Radix.ItemText>{o.label}</Radix.ItemText>
              <Radix.ItemIndicator className="rp-dd-check" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path
                    d="M2.5 6.2 5 8.5 9.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Radix.ItemIndicator>
            </Radix.Item>
          ))}
        </Radix.Viewport>
      </Radix.Content>
    </Radix.Root>
  );
}
