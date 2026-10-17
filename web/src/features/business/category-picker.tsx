"use client";

import { Popover } from "radix-ui";
import { useEffect, useId, useState } from "react";

import { type GbpCategory, useBusinessCategories } from "@/lib/api/business";
import { Spinner } from "@/features/replyly/ui";

const MUTED = "#6C6962";

export function CategoryPicker({
  value,
  onChange,
  region,
  label,
  placeholder = "Search categories, like Dentist",
  exclude = [],
}: {
  value: GbpCategory | null;
  onChange: (category: GbpCategory | null) => void;
  region: string;
  label: string;
  placeholder?: string;
  exclude?: string[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value?.displayName ?? "");
  const [query, setQuery] = useState(text);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const categories = useBusinessCategories(query, region, open);
  const list = (categories.data?.data ?? []).filter((c) => !exclude.includes(c.name)).slice(0, 12);

  function choose(c: GbpCategory) {
    onChange(c);
    setText(c.displayName);
    setOpen(false);
  }

  return (
    <Popover.Root open={open && (list.length > 0 || categories.isFetching)} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input
            className="rp-input"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={open && list[active] ? `${id}-${active}` : undefined}
            value={text}
            placeholder={placeholder}
            style={{ width: "100%", paddingRight: 30 }}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setText(e.target.value);
              setActive(0);
              setOpen(true);
              if (value) onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(a + 1, list.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && open && list[active]) {
                e.preventDefault();
                choose(list[active]);
              } else if (e.key === "Escape") setOpen(false);
            }}
          />
          <span
            aria-hidden
            style={{ position: "absolute", right: 10, display: "flex", color: MUTED }}
          >
            {categories.isFetching && open ? (
              <Spinner size={11} dark />
            ) : value ? (
              <span style={{ color: "#0F6B4A", fontSize: 12, fontWeight: 700 }}>✓</span>
            ) : null}
          </span>
        </div>
      </Popover.Anchor>
      <Popover.Content
        className="rp-dd-menu"
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if ((e.target as HTMLElement | null)?.getAttribute("role") === "combobox")
            e.preventDefault();
        }}
        style={{ width: "var(--radix-popover-trigger-width)", minWidth: 220 }}
      >
        <div id={`${id}-list`} role="listbox" aria-label={label} style={{ padding: 4 }}>
          {list.map((c, i) => (
            <div
              key={c.name}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              className="rp-dd-item"
              data-highlighted={i === active ? "" : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c)}
            >
              {c.displayName}
            </div>
          ))}
          {!list.length ? (
            <div style={{ padding: "8px 10px", color: MUTED }}>Searching…</div>
          ) : null}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
